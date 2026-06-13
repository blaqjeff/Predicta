import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatKickoff, formatPoints } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const mainTrack = await prisma.track.findFirst({ where: { isMain: true } });
  const topEntries = mainTrack
    ? await prisma.leaderboardEntry.findMany({
        where: { trackId: mainTrack.id },
        orderBy: { totalPoints: "desc" },
        take: 5,
        include: { user: { select: { username: true } } },
      })
    : [];
  const upcoming = await prisma.match.findMany({
    where: { kickoffAt: { gt: new Date() } },
    orderBy: { kickoffAt: "asc" },
    take: 3,
  });
  const categoryCount = await prisma.category.count();
  const trackCount = await prisma.track.count({ where: { active: true } });

  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <span className="chip">Hybrid · Solana · Onchain rewards</span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Predict the World Cup.
            <br />
            Climb the{" "}
            <span className="text-[var(--accent)]">onchain leaderboard</span>.
          </h1>
          <p className="max-w-lg text-[var(--muted)]">
            Call exact scores, corners, winners, total goals and more. Harder
            categories are worth more points. Results settle automatically and
            every result is committed onchain for anyone to verify.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/matches" className="btn-primary">
              Make predictions
            </Link>
            <Link href="/leaderboard" className="btn-ghost">
              View leaderboard
            </Link>
          </div>
          <div className="flex gap-6 pt-2 text-sm text-[var(--muted)]">
            <div>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {categoryCount}
              </div>
              categories
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {trackCount}
              </div>
              tracks
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                1000
              </div>
              max pts / pick
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Top predictors</h3>
            <Link
              href="/leaderboard"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Full board →
            </Link>
          </div>
          {topEntries.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No scores yet. Be the first to predict.
            </p>
          ) : (
            <ol className="space-y-2">
              {topEntries.map((e, i) => (
                <li
                  key={e.userId}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-[var(--muted)]">
                      {i + 1}
                    </span>
                    <span className="font-medium">@{e.user.username}</span>
                  </span>
                  <span className="font-mono text-[var(--accent)]">
                    {formatPoints(e.totalPoints)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-semibold">Next matches</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {upcoming.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No upcoming matches yet.</p>
          ) : (
            upcoming.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="card p-4 transition hover:border-[var(--accent)]"
              >
                <div className="mb-2 text-xs text-[var(--muted)]">{m.stage}</div>
                <div className="text-lg font-semibold">
                  {m.homeTeam} <span className="text-[var(--muted)]">vs</span>{" "}
                  {m.awayTeam}
                </div>
                <div className="mt-2 text-sm text-[var(--muted)]">
                  {formatKickoff(m.kickoffAt)}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
