"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { formatPoints } from "@/lib/format";
import { useSession } from "@/components/SessionProvider";

interface Track {
  id: string;
  slug: string;
  name: string;
  sponsor: string | null;
  isMain: boolean;
  branding: { color?: string; tagline?: string } | null;
}

interface Entry {
  userId: string;
  username: string;
  xHandle: string | null;
  totalPoints: number;
  rank: number | null;
}

export default function LeaderboardPage() {
  const { user } = useSession();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [myEntry, setMyEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ tracks: Track[] }>("/api/tracks").then((d) => {
      setTracks(d.tracks);
      const main = d.tracks.find((t) => t.isMain) ?? d.tracks[0];
      if (main) setActiveTrack(main.id);
    });
  }, []);

  useEffect(() => {
    if (!activeTrack) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api<{ entries: Entry[]; myEntry: Entry | null }>(
      `/api/leaderboard?trackId=${activeTrack}`
    )
      .then((d) => {
        setEntries(d.entries);
        setMyEntry(d.myEntry);
      })
      .finally(() => setLoading(false));
  }, [activeTrack, user?.id]);

  const current = tracks.find((t) => t.id === activeTrack);
  const accent = current?.branding?.color ?? "#22c55e";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-[var(--muted)]">
          Points are weighted by how hard each category is to call.
        </p>
      </div>

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
            {t.sponsor && (
              <span className="ml-1 opacity-70">· {t.sponsor}</span>
            )}
          </button>
        ))}
      </div>

      {current?.branding?.tagline && (
        <p className="text-sm italic" style={{ color: accent }}>
          {current.branding.tagline}
        </p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--muted)]">
                  Loading...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--muted)]">
                  No settled predictions on this track yet.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr
                  key={e.userId}
                  className={`border-b border-[var(--border)]/50 ${
                    e.userId === user?.id ? "bg-[var(--surface-2)]" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-bold" style={{ color: accent }}>
                    #{e.rank}
                  </td>
                  <td className="px-4 py-3">
                    @{e.username}
                    {e.xHandle && (
                      <span className="ml-2 chip">X · @{e.xHandle}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatPoints(e.totalPoints)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {myEntry && (
        <div className="card flex items-center justify-between p-4">
          <span className="text-sm text-[var(--muted)]">Your position</span>
          <span className="font-semibold">
            #{myEntry.rank} · {formatPoints(myEntry.totalPoints)} pts
          </span>
        </div>
      )}
    </div>
  );
}
