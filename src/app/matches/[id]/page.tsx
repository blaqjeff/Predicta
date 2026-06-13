import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { formatKickoff, isLocked } from "@/lib/format";
import { MatchResult } from "@/lib/scoring";
import { solanaCluster } from "@/lib/config";
import { MatchPredictions, MatchData } from "@/components/MatchPredictions";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) notFound();

  const tracksRaw = await prisma.track.findMany({
    where: { active: true },
    orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
    include: {
      trackCategories: {
        where: { enabled: true },
        include: { category: true },
      },
    },
  });

  const tracks = tracksRaw.map((t) => ({
    id: t.id,
    name: t.name,
    sponsor: t.sponsor,
    isMain: t.isMain,
    branding: t.branding ? JSON.parse(t.branding) : null,
    categories: t.trackCategories
      .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
      .map((tc) => ({
        id: tc.category.id,
        key: tc.category.key,
        label: tc.category.label,
        weight: tc.weight,
        schema: JSON.parse(tc.category.schema),
      })),
  }));

  const result = parseJson<MatchResult | null>(match.result, null);
  const matchData: MatchData = {
    id: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    locked: isLocked(match.kickoffAt),
    status: match.status,
    result,
  };

  const explorerBase = "https://explorer.solana.com/tx";

  return (
    <div className="space-y-6">
      <Link href="/matches" className="text-sm text-[var(--muted)] hover:underline">
        ← All matches
      </Link>

      <div className="card p-6">
        <div className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
          {match.stage}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">
            {match.homeTeam}{" "}
            <span className="text-[var(--muted)]">vs</span> {match.awayTeam}
          </h1>
          {result ? (
            <div className="text-right">
              <div className="font-mono text-2xl text-[var(--accent)]">
                {result.homeGoals} - {result.awayGoals}
              </div>
              {result.corners !== undefined && (
                <div className="text-xs text-[var(--muted)]">
                  {result.corners} corners
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">
              {matchData.locked ? "Locked" : `Kickoff ${formatKickoff(match.kickoffAt)}`}
            </div>
          )}
        </div>

        {match.resultCommitmentTx && (
          <div className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
            Result committed onchain:{" "}
            <a
              className="text-[var(--accent)] hover:underline"
              href={`${explorerBase}/${match.resultCommitmentTx}?cluster=${solanaCluster}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              view on Solana Explorer
            </a>
          </div>
        )}
      </div>

      <MatchPredictions match={matchData} tracks={tracks} />
    </div>
  );
}
