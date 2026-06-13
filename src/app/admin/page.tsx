"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { useSession } from "@/components/SessionProvider";
import { formatKickoff } from "@/lib/format";

interface AdminMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  stage: string;
  status: string;
  result: string | null;
  resultCommitmentTx: string | null;
}

interface TrackCategory {
  id: string;
  key: string;
  label: string;
  weight: number;
}

interface Track {
  id: string;
  name: string;
  isMain: boolean;
  categories: TrackCategory[];
}

export default function AdminPage() {
  const { user, loading } = useSession();

  if (loading) return <p className="text-[var(--muted)]">Loading...</p>;
  if (!user?.isAdmin)
    return (
      <div className="card p-6">
        <p className="text-[var(--muted)]">Admins only.</p>
      </div>
    );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <SettlementCard />
      <MatchesCard />
      <TracksCard />
    </div>
  );
}

function SettlementCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const d = await api<{ settledMatches: number; sync: unknown }>(
        "/api/settlement",
        { method: "POST" }
      );
      setResult(
        `Synced from sports API and settled ${d.settledMatches} match(es).`
      );
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-semibold">Settlement</h2>
      <p className="mb-3 text-sm text-[var(--muted)]">
        Pull results from the free sports API and auto-score every finished match.
        A cron can hit <code>/api/settlement</code> with the <code>x-cron-secret</code> header.
      </p>
      <button className="btn-primary" disabled={busy} onClick={run}>
        {busy ? "Running..." : "Run settlement now"}
      </button>
      {result && <p className="mt-2 text-sm text-[var(--accent)]">{result}</p>}
    </div>
  );
}

function MatchesCard() {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [form, setForm] = useState({
    homeTeam: "",
    awayTeam: "",
    kickoffAt: "",
    stage: "Group Stage",
  });

  const load = useCallback(() => {
    api<{ matches: AdminMatch[] }>("/api/admin/matches").then((d) =>
      setMatches(d.matches)
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    await api("/api/admin/matches", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        kickoffAt: new Date(form.kickoffAt).toISOString(),
      }),
    });
    setForm({ homeTeam: "", awayTeam: "", kickoffAt: "", stage: "Group Stage" });
    load();
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">Matches</h2>

      <div className="mb-5 grid gap-2 sm:grid-cols-5">
        <input
          className="input"
          placeholder="Home"
          value={form.homeTeam}
          onChange={(e) => setForm({ ...form, homeTeam: e.target.value })}
        />
        <input
          className="input"
          placeholder="Away"
          value={form.awayTeam}
          onChange={(e) => setForm({ ...form, awayTeam: e.target.value })}
        />
        <input
          className="input"
          type="datetime-local"
          value={form.kickoffAt}
          onChange={(e) => setForm({ ...form, kickoffAt: e.target.value })}
        />
        <input
          className="input"
          placeholder="Stage"
          value={form.stage}
          onChange={(e) => setForm({ ...form, stage: e.target.value })}
        />
        <button
          className="btn-primary"
          disabled={!form.homeTeam || !form.awayTeam || !form.kickoffAt}
          onClick={create}
        >
          Add match
        </button>
      </div>

      <div className="space-y-2">
        {matches.map((m) => (
          <AdminMatchRow key={m.id} match={m} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function AdminMatchRow({
  match,
  onChanged,
}: {
  match: AdminMatch;
  onChanged: () => void;
}) {
  const existing = match.result ? JSON.parse(match.result) : null;
  const [home, setHome] = useState(existing?.homeGoals ?? "");
  const [away, setAway] = useState(existing?.awayGoals ?? "");
  const [corners, setCorners] = useState(existing?.corners ?? "");
  const [busy, setBusy] = useState(false);

  async function saveResult() {
    setBusy(true);
    try {
      await api("/api/admin/matches", {
        method: "POST",
        body: JSON.stringify({
          id: match.id,
          result: {
            homeGoals: Number(home),
            awayGoals: Number(away),
            ...(corners !== "" ? { corners: Number(corners) } : {}),
          },
        }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    setBusy(true);
    try {
      await api("/api/admin/settle", {
        method: "POST",
        body: JSON.stringify({ matchId: match.id }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">
            {match.homeTeam} vs {match.awayTeam}
          </span>
          <span className="ml-2 text-xs text-[var(--muted)]">
            {match.stage} · {formatKickoff(match.kickoffAt)} · {match.status}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input w-16 text-center"
          type="number"
          placeholder="H"
          value={home}
          onChange={(e) => setHome(e.target.value)}
        />
        <input
          className="input w-16 text-center"
          type="number"
          placeholder="A"
          value={away}
          onChange={(e) => setAway(e.target.value)}
        />
        <input
          className="input w-24 text-center"
          type="number"
          placeholder="corners"
          value={corners}
          onChange={(e) => setCorners(e.target.value)}
        />
        <button
          className="btn-ghost px-3 py-1.5"
          disabled={busy || home === "" || away === ""}
          onClick={saveResult}
        >
          Save result
        </button>
        <button
          className="btn-primary px-3 py-1.5"
          disabled={busy || !match.result}
          onClick={settle}
        >
          Settle
        </button>
        {match.resultCommitmentTx && (
          <span className="chip text-[var(--accent)]">committed onchain</span>
        )}
      </div>
    </div>
  );
}

function TracksCard() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [allCategories, setAllCategories] = useState<TrackCategory[]>([]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    sponsor: "",
    color: "#9945FF",
    tagline: "",
    startAt: "",
    endAt: "",
  });
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ tracks: Track[] }>("/api/tracks").then((d) => {
      setTracks(d.tracks);
      const main = d.tracks.find((t) => t.isMain) ?? d.tracks[0];
      if (main) setAllCategories(main.categories);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(cat: TrackCategory) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[cat.key] !== undefined) delete next[cat.key];
      else next[cat.key] = cat.weight;
      return next;
    });
  }

  async function create() {
    setMsg(null);
    try {
      await api("/api/tracks", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          sponsor: form.sponsor || undefined,
          branding: { color: form.color, tagline: form.tagline || undefined },
          startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
          endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
          categories: Object.entries(selected).map(([key, weight]) => ({
            key,
            weight: Number(weight),
          })),
        }),
      });
      setMsg("Track created");
      setForm({
        name: "",
        slug: "",
        sponsor: "",
        color: "#9945FF",
        tagline: "",
        startAt: "",
        endAt: "",
      });
      setSelected({});
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">Tracks</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {tracks.map((t) => (
          <span key={t.id} className="chip">
            {t.name}
            {t.isMain && " (main)"}
          </span>
        ))}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">
        Create sponsored track
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="input"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="input"
          placeholder="slug (url-friendly)"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <input
          className="input"
          placeholder="Sponsor"
          value={form.sponsor}
          onChange={(e) => setForm({ ...form, sponsor: e.target.value })}
        />
        <input
          className="input"
          placeholder="Tagline"
          value={form.tagline}
          onChange={(e) => setForm({ ...form, tagline: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          Color
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input"
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.target.value })}
          />
          <input
            className="input"
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm({ ...form, endAt: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="label">Categories &amp; weights</p>
        <div className="space-y-2">
          {allCategories.map((cat) => (
            <div key={cat.key} className="flex items-center gap-3">
              <label className="flex w-48 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected[cat.key] !== undefined}
                  onChange={() => toggle(cat)}
                />
                {cat.label}
              </label>
              {selected[cat.key] !== undefined && (
                <input
                  className="input w-28"
                  type="number"
                  value={selected[cat.key]}
                  onChange={(e) =>
                    setSelected({ ...selected, [cat.key]: Number(e.target.value) })
                  }
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn-primary mt-4"
        disabled={!form.name || !form.slug || Object.keys(selected).length === 0}
        onClick={create}
      >
        Create track
      </button>
      {msg && <p className="mt-2 text-sm text-[var(--accent)]">{msg}</p>}
    </div>
  );
}
