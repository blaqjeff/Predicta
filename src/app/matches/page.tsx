import Link from "next/link";
import { SoccerBall, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { formatKickoff, isLocked } from "@/lib/format";
import { MatchResult } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function ResultBadge({ result }: { result: string | null }) {
  const r = parseJson<MatchResult | null>(result, null);
  if (!r) return null;
  return (
    <span className="font-mono text-[var(--accent)]">
      {r.homeGoals} - {r.awayGoals}
    </span>
  );
}

export default async function MatchesPage() {
  const matches = await prisma.match.findMany({ orderBy: { kickoffAt: "asc" } });
  const upcoming = matches.filter((m) => !isLocked(m.kickoffAt));
  const past = matches
    .filter((m) => isLocked(m.kickoffAt))
    .sort((a, b) => +new Date(b.kickoffAt) - +new Date(a.kickoffAt));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <SoccerBall weight="duotone" className="size-7 text-[var(--accent)]" />
          Matches
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Predictions lock at kickoff. One prediction per category per match.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Open for predictions
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No open matches right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="card card-hover flex items-center justify-between p-5"
              >
                <div>
                  <div className="mb-1 text-xs text-[var(--muted)]">{m.stage}</div>
                  <div className="text-lg font-semibold">
                    {m.homeTeam}{" "}
                    <span className="text-[var(--muted)]">v</span> {m.awayTeam}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {formatKickoff(m.kickoffAt)}
                  </div>
                </div>
                <span className="chip">
                  Predict
                  <ArrowRight weight="bold" className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Locked / finished
        </h2>
        {past.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing here yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {past.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="card card-hover flex items-center justify-between p-5 opacity-90"
              >
                <div>
                  <div className="mb-1 text-xs text-[var(--muted)]">{m.stage}</div>
                  <div className="text-lg font-semibold">
                    {m.homeTeam}{" "}
                    <span className="text-[var(--muted)]">vs</span> {m.awayTeam}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {m.status === "settled"
                      ? "Settled"
                      : m.status === "finished"
                      ? "Awaiting settlement"
                      : "Locked"}
                  </div>
                </div>
                <ResultBadge result={m.result} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
