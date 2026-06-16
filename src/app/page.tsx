import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Trophy,
  ChartLineUp,
  ShieldCheck,
  Lightning,
  SoccerBall,
} from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { CATEGORY_DEFS } from "@/lib/categories";
import { formatKickoff, formatPoints, isPredictionOpen } from "@/lib/format";
import { apiMatchWhere } from "@/lib/matchQuery";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

const categoryIcon: Record<string, React.ReactNode> = {
  exact_score: <SoccerBall weight="duotone" className="size-6" />,
  total_goals: <ChartLineUp weight="duotone" className="size-6" />,
  corners: <Lightning weight="duotone" className="size-6" />,
  correct_result: <Trophy weight="duotone" className="size-6" />,
  btts: <ShieldCheck weight="duotone" className="size-6" />,
};

export default async function Home() {
  const mainTrack = await prisma.track.findFirst({ where: { isMain: true } });
  const topEntries = mainTrack
    ? await prisma.leaderboardEntry.findMany({
        where: { trackId: mainTrack.id, totalPoints: { gt: 0 } },
        orderBy: { totalPoints: "desc" },
        take: 4,
        include: { user: { select: { username: true } } },
      })
    : [];
  const upcomingRaw = await prisma.match.findMany({
    where: apiMatchWhere({ kickoffAt: { gt: new Date() } }),
    orderBy: { kickoffAt: "asc" },
    take: 6,
  });
  const upcoming = upcomingRaw.filter((m) => isPredictionOpen(m.kickoffAt)).slice(0, 3);

  return (
    <div className="space-y-24 pb-8">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-4 lg:min-h-[calc(100dvh-9rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal className="space-y-7">
          <span className="eyebrow">
            <Lightning weight="fill" className="size-3.5" />
            probably nothing
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Call the match.
            <br />
            Own the{" "}
            <span className="text-[var(--accent)]">leaderboard</span>.
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-[var(--muted)]">
            Predict scores, corners, goals and winners. Harder calls score
            bigger. Results settle automatically and land onchain.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/matches" className="btn-primary">
              Make predictions
              <ArrowRight weight="bold" className="size-4" />
            </Link>
            <Link href="/leaderboard" className="btn-ghost">
              View leaderboard
            </Link>
          </div>
          <dl className="flex gap-8 pt-2">
            {[
              { v: "5", l: "categories" },
              { v: "1000", l: "top points / pick" },
              { v: "100%", l: "auto-settled" },
            ].map((s) => (
              <div key={s.l}>
                <dt className="font-mono text-2xl font-bold text-[var(--foreground)]">
                  {s.v}
                </dt>
                <dd className="text-xs text-[var(--muted)]">{s.l}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={0.12} className="relative">
          <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
            <Image
              src="/hero-stadium.png"
              alt="Floodlit stadium at dusk"
              width={1024}
              height={683}
              priority
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent" />
          </div>

          {/* Floating top-predictors card */}
          <div className="card absolute -bottom-6 -left-4 w-64 p-4 shadow-2xl sm:left-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Trophy weight="fill" className="size-4 text-[var(--accent)]" />
              Top predictors
            </div>
            {topEntries.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">
                No scores yet. Be first.
              </p>
            ) : (
              <ol className="space-y-2">
                {topEntries.slice(0, 3).map((e, i) => (
                  <li
                    key={e.userId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-4 font-mono text-xs text-[var(--muted)]">
                        {i + 1}
                      </span>
                      <span className="font-medium">@{e.user.username}</span>
                    </span>
                    <span className="font-mono text-xs text-[var(--accent)]">
                      {formatPoints(e.totalPoints)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Reveal>
      </section>

      {/* Scoring bento */}
      <section className="space-y-8">
        <Reveal className="max-w-2xl">
          <span className="eyebrow">
            <ChartLineUp weight="fill" className="size-3.5" />
            Weighted scoring
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Every category pays differently
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            The harder a call is to get right, the more it is worth. Nail the
            exact score and you bank ten times a corner-range guess.
          </p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_DEFS.map((c, i) => (
            <Reveal
              key={c.key}
              delay={i * 0.05}
              className={c.key === "exact_score" ? "lg:col-span-2" : ""}
            >
              <div className="card card-hover flex h-full flex-col justify-between gap-6 p-5">
                <div className="flex items-start justify-between">
                  <span className="text-[var(--accent)]">
                    {categoryIcon[c.key]}
                  </span>
                  <span className="font-mono text-lg font-bold">
                    {formatPoints(c.baseWeight)}
                    <span className="ml-1 text-xs font-normal text-[var(--muted)]">
                      pts
                    </span>
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold">{c.label}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {c.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works - 2-col editorial */}
      <section className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <Reveal>
          <span className="eyebrow">How it works</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Sign in once. Predict all tournament.
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            Use X, email, or a Solana wallet. Picks lock at kickoff and carry
            across every match day.
          </p>
        </Reveal>

        <div className="divide-y divide-[var(--border)]">
          {[
            {
              icon: <Trophy weight="duotone" className="size-5" />,
              t: "Predict before kickoff",
              d: "One pick per category, per match. Changed your mind? A small onchain fee unlocks an edit.",
            },
            {
              icon: <ShieldCheck weight="duotone" className="size-5" />,
              t: "Results verified onchain",
              d: "Each final result is hashed and committed to Solana, so the settlement is auditable by anyone.",
            },
            {
              icon: <Lightning weight="duotone" className="size-5" />,
              t: "Auto-scored, ranked instantly",
              d: "Points apply the moment a match settles and your leaderboard rank updates with it.",
            },
          ].map((step, i) => (
            <Reveal key={step.t} delay={i * 0.06}>
              <div className="flex gap-4 py-5">
                <span className="text-[var(--accent)]">{step.icon}</span>
                <div>
                  <h3 className="font-semibold">{step.t}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{step.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Next matches */}
      <section className="space-y-6">
        <Reveal className="flex items-end justify-between">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Next matches
          </h2>
          <Link
            href="/matches"
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            All matches
          </Link>
        </Reveal>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No upcoming matches yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {upcoming.map((m, i) => (
              <Reveal key={m.id} delay={i * 0.06}>
                <Link
                  href={`/matches/${m.id}`}
                  className="card card-hover block h-full p-5"
                >
                  <div className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <SoccerBall weight="duotone" className="size-4" />
                    {m.stage}
                  </div>
                  <div className="text-lg font-semibold leading-snug">
                    {m.homeTeam}
                    <span className="px-1 text-[var(--muted)]">v</span>
                    {m.awayTeam}
                  </div>
                  <div className="mt-3 text-sm text-[var(--muted)]">
                    {formatKickoff(m.kickoffAt)}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* CTA band */}
      <Reveal>
        <section className="card relative overflow-hidden p-10 text-center sm:p-14">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(600px_240px_at_50%_-20%,rgba(41,211,106,0.18),transparent)]" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Your bracket is just bragging. This is onchain.
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-[var(--muted)]">
            Start predicting today and stake your claim on the global board.
          </p>
          <div className="relative mt-6 flex justify-center">
            <Link href="/matches" className="btn-primary">
              Make your first pick
              <ArrowRight weight="bold" className="size-4" />
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
