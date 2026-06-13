"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "./SessionProvider";
import { AuthDialog } from "./AuthDialog";

const links = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/matches", label: "Matches" },
];

export function Nav() {
  const { user, loading, logout } = useSession();
  const pathname = usePathname();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Image
            src="/predicta-icon.png"
            alt="Predicta"
            width={30}
            height={30}
            className="rounded-md"
            priority
          />
          <span className="text-lg">
            predict<span className="text-[var(--accent)]">a</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname.startsWith(l.href)
                  ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link
              href="/admin"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname.startsWith("/admin")
                  ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Admin
            </Link>
          )}

          {!loading && user ? (
            <div className="ml-1 flex items-center gap-2">
              <Link href="/profile" className="chip hover:text-[var(--foreground)]">
                @{user.username}
              </Link>
              <button className="btn-ghost px-3 py-1.5" onClick={logout}>
                Sign out
              </button>
            </div>
          ) : (
            <button
              className="btn-primary ml-1 px-3 py-1.5"
              onClick={() => setAuthOpen(true)}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}
