"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/fetcher";
import { useSession } from "./SessionProvider";
import { AuthDialog } from "./AuthDialog";
import { RevertPanel } from "./RevertPanel";
import { formatPoints } from "@/lib/format";

interface CategoryDef {
  id: string;
  key: string;
  label: string;
  weight: number;
  schema: { inputType: "score" | "options" | "boolean"; options: { value: string; label: string }[] | null };
}

interface TrackDef {
  id: string;
  name: string;
  sponsor: string | null;
  isMain: boolean;
  branding: { color?: string; tagline?: string } | null;
  categories: CategoryDef[];
}

interface ExistingPrediction {
  id: string;
  categoryId: string;
  trackId: string;
  value: string;
  pointsAwarded: number | null;
  status: string;
  editUnlocked: boolean;
}

export interface MatchData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  locked: boolean;
  predictable: boolean;
  tooEarly: boolean;
  opensAtLabel: string;
  status: string;
  result: { homeGoals: number; awayGoals: number; corners?: number } | null;
}

export function MatchPredictions({
  match,
  tracks,
}: {
  match: MatchData;
  tracks: TrackDef[];
}) {
  const { user } = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [activeTrack, setActiveTrack] = useState<string>(
    tracks.find((t) => t.isMain)?.id ?? tracks[0]?.id ?? ""
  );
  const [predictions, setPredictions] = useState<Record<string, ExistingPrediction>>(
    {}
  );

  async function loadPredictions() {
    if (!user) {
      setPredictions({});
      return;
    }
    const d = await api<{ predictions: ExistingPrediction[] }>(
      `/api/predictions?matchId=${match.id}`
    );
    const map: Record<string, ExistingPrediction> = {};
    for (const p of d.predictions) {
      map[`${p.trackId}:${p.categoryId}`] = p;
    }
    setPredictions(map);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, match.id]);

  const track = tracks.find((t) => t.id === activeTrack);
  const accent = track?.branding?.color ?? "#22c55e";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {tracks.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTrack(t.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              activeTrack === t.id
                ? "border-transparent text-black"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            style={
              activeTrack === t.id
                ? { background: t.branding?.color ?? "#22c55e" }
                : undefined
            }
          >
            {t.name}
            {t.sponsor && <span className="ml-1 opacity-70">· {t.sponsor}</span>}
          </button>
        ))}
      </div>

      {match.tooEarly && (
        <div className="card border-[var(--border)] p-4 text-sm text-[var(--muted)]">
          Predictions open at <span className="text-[var(--foreground)]">{match.opensAtLabel}</span>{" "}
          (midnight the day before kickoff, WAT).
        </div>
      )}

      {match.locked && (
        <div className="card p-4 text-sm text-[var(--muted)]">
          This match has kicked off. Predictions are locked.
        </div>
      )}

      {track && (
        <div className="space-y-3">
          {track.categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              match={match}
              trackId={track.id}
              category={cat}
              accent={accent}
              inputsEnabled={match.predictable}
              requiresSignIn={!user}
              onRequireSignIn={() => setAuthOpen(true)}
              existing={predictions[`${track.id}:${cat.id}`]}
              onChanged={loadPredictions}
            />
          ))}
        </div>
      )}

      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title="Sign in to save your pick"
      />
    </div>
  );
}

function describeValue(key: string, value: unknown): string {
  const v = value as Record<string, unknown>;
  switch (key) {
    case "exact_score":
      return `${v.homeGoals} - ${v.awayGoals}`;
    case "correct_result":
      return String(v.outcome);
    case "total_goals":
    case "corners":
      return String(v.range);
    case "btts":
      return String(v.btts);
    default:
      return JSON.stringify(value);
  }
}

function CategoryRow({
  match,
  trackId,
  category,
  accent,
  inputsEnabled,
  requiresSignIn,
  onRequireSignIn,
  existing,
  onChanged,
}: {
  match: MatchData;
  trackId: string;
  category: CategoryDef;
  accent: string;
  inputsEnabled: boolean;
  requiresSignIn: boolean;
  onRequireSignIn: () => void;
  existing?: ExistingPrediction;
  onChanged: () => void;
}) {
  const existingValue = useMemo(
    () => (existing ? JSON.parse(existing.value) : null),
    [existing]
  );

  const [home, setHome] = useState<string>("");
  const [away, setAway] = useState<string>("");
  const [option, setOption] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revertPredictionId, setRevertPredictionId] = useState<string | null>(null);

  useEffect(() => {
    if (!existingValue) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (category.key === "exact_score") {
      setHome(String(existingValue.homeGoals));
      setAway(String(existingValue.awayGoals));
    } else if (category.key === "correct_result") {
      setOption(String(existingValue.outcome));
    } else if (category.key === "btts") {
      setOption(String(existingValue.btts));
    } else {
      setOption(String(existingValue.range));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [existingValue, category.key]);

  function buildValue(): unknown {
    switch (category.key) {
      case "exact_score":
        return { homeGoals: Number(home), awayGoals: Number(away) };
      case "correct_result":
        return { outcome: option };
      case "btts":
        return { btts: option };
      default:
        return { range: option };
    }
  }

  const hasInput =
    category.key === "exact_score" ? home !== "" && away !== "" : option !== "";

  const draftLabel = hasInput
    ? describeValue(category.key, buildValue())
    : null;

  async function submit() {
    setError(null);
    setMessage(null);

    if (requiresSignIn) {
      onRequireSignIn();
      return;
    }

    setBusy(true);
    try {
      const res = await api<{ action: string }>("/api/predictions", {
        method: "POST",
        body: JSON.stringify({
          matchId: match.id,
          categoryId: category.id,
          trackId,
          value: buildValue(),
        }),
      });
      setMessage(res.action === "created" ? "Prediction placed" : "Prediction updated");
      onChanged();
    } catch (e) {
      const err = e as ApiError;
      const details = err.details as { code?: string; predictionId?: string } | undefined;
      if (err.status === 402 && details?.code === "REVERT_REQUIRED") {
        setRevertPredictionId(details.predictionId ?? existing?.id ?? null);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const settled = existing?.status === "settled";
  const correct = settled && (existing?.pointsAwarded ?? 0) > 0;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{category.label}</div>
          <span className="chip mt-1" style={{ color: accent }}>
            {formatPoints(category.weight)} pts
          </span>
        </div>
        {settled && (
          <span
            className={`chip ${correct ? "text-[var(--accent)]" : "text-red-400"}`}
          >
            {correct ? `+${formatPoints(existing!.pointsAwarded!)}` : "0 pts"}
          </span>
        )}
      </div>

      {category.schema.inputType === "score" ? (
        <div className="flex items-center gap-2">
          <input
            className="input w-20 text-center"
            type="number"
            min={0}
            value={home}
            disabled={!inputsEnabled}
            onChange={(e) => setHome(e.target.value)}
            placeholder="0"
          />
          <span className="text-[var(--muted)]">:</span>
          <input
            className="input w-20 text-center"
            type="number"
            min={0}
            value={away}
            disabled={!inputsEnabled}
            onChange={(e) => setAway(e.target.value)}
            placeholder="0"
          />
          <span className="ml-2 text-xs text-[var(--muted)]">
            {match.homeTeam} : {match.awayTeam}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(category.schema.options ?? []).map((o) => (
            <button
              key={o.value}
              disabled={!inputsEnabled}
              onClick={() => setOption(o.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                option === o.value
                  ? "border-[var(--accent)] bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-[var(--muted)]">
          {existing
            ? `Your pick: ${describeValue(category.key, existingValue)}`
            : draftLabel
              ? `Selected: ${draftLabel}`
              : "No prediction yet"}
        </div>
        {inputsEnabled && (
          <button
            className="btn-primary px-3 py-1.5"
            disabled={busy || !hasInput}
            onClick={submit}
          >
            {busy
              ? "Saving..."
              : requiresSignIn
                ? "Sign in to place"
                : existing
                  ? "Update"
                  : "Place"}
          </button>
        )}
      </div>

      {message && <p className="mt-2 text-xs text-[var(--accent)]">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {revertPredictionId && (
        <RevertPanel
          predictionId={revertPredictionId}
          onClose={() => setRevertPredictionId(null)}
          onUnlocked={async () => {
            setRevertPredictionId(null);
            await submit();
          }}
        />
      )}
    </div>
  );
}
