"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { useSession, SessionUser } from "@/components/SessionProvider";
import { shortAddress } from "@/lib/format";
import { connectWallet, signLoginMessage } from "@/lib/solanaClient";

interface Identity {
  provider: string;
  createdAt: string;
}

export default function ProfilePage() {
  const { user, loading, refresh, setUser } = useSession();
  const [identities, setIdentities] = useState<Identity[]>([]);

  useEffect(() => {
    if (!user) return;
    api<{ identities: Identity[] }>("/api/profile").then((d) =>
      setIdentities(d.identities)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading) return <p className="text-[var(--muted)]">Loading...</p>;
  if (!user)
    return (
      <div className="card p-6">
        <p className="text-[var(--muted)]">Sign in to view your profile.</p>
      </div>
    );

  const providers = new Set(identities.map((i) => i.provider));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <UsernameCard user={user} onSaved={(u) => setUser(u)} />
      <RewardWalletCard user={user} onSaved={(u) => setUser(u)} />

      <div className="card p-5">
        <h2 className="mb-1 font-semibold">Linked sign-in methods</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Link more ways to sign in. They all map to this same account.
        </p>
        <div className="space-y-2">
          <LinkRow
            label="X (Twitter)"
            connected={providers.has("x")}
            detail={user.xHandle ? `@${user.xHandle}` : undefined}
            action={
              providers.has("x") ? null : (
                <a className="btn-ghost px-3 py-1.5" href="/api/auth/x/start">
                  Link X
                </a>
              )
            }
          />
          <LinkEmailRow
            connected={providers.has("email")}
            email={user.email}
            onLinked={refresh}
          />
          <LinkWalletRow
            connected={providers.has("wallet")}
            onLinked={refresh}
          />
        </div>
      </div>
    </div>
  );
}

function UsernameCard({
  user,
  onSaved,
}: {
  user: SessionUser;
  onSaved: (u: SessionUser) => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = Boolean(user.xHandle);

  async function save() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const d = await api<{ user: SessionUser }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ username }),
      });
      onSaved(d.user);
      setMsg("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-semibold">Username</h2>
      <p className="mb-3 text-sm text-[var(--muted)]">
        {locked
          ? "Your username comes from your X handle and can't be changed."
          : "This is your public name on the leaderboard."}
      </p>
      <div className="flex gap-2">
        <input
          className="input"
          value={username}
          disabled={locked}
          onChange={(e) => setUsername(e.target.value)}
        />
        {!locked && (
          <button className="btn-primary" disabled={busy} onClick={save}>
            Save
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-xs text-[var(--accent)]">{msg}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function RewardWalletCard({
  user,
  onSaved,
}: {
  user: SessionUser;
  onSaved: (u: SessionUser) => void;
}) {
  const [wallet, setWallet] = useState(user.rewardWallet ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const d = await api<{ user: SessionUser }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ rewardWallet: wallet || null }),
      });
      onSaved(d.user);
      setMsg("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-semibold">Reward wallet</h2>
      <p className="mb-3 text-sm text-[var(--muted)]">
        Solana address where prizes are paid. Wallet sign-in sets this
        automatically; otherwise add it here.
      </p>
      <div className="flex gap-2">
        <input
          className="input font-mono"
          placeholder="Solana address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
        />
        <button className="btn-primary" disabled={busy} onClick={save}>
          Save
        </button>
      </div>
      {user.rewardWallet && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Current: {shortAddress(user.rewardWallet)}
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-[var(--accent)]">{msg}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function LinkRow({
  label,
  connected,
  detail,
  action,
}: {
  label: string;
  connected: boolean;
  detail?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div>
        <span className="text-sm font-medium">{label}</span>
        {detail && <span className="ml-2 text-xs text-[var(--muted)]">{detail}</span>}
      </div>
      {connected ? (
        <span className="chip text-[var(--accent)]">Linked</span>
      ) : (
        action
      )}
    </div>
  );
}

function LinkEmailRow({
  connected,
  email,
  onLinked,
}: {
  connected: boolean;
  email: string | null;
  onLinked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    try {
      await api("/api/auth/email/start", {
        method: "POST",
        body: JSON.stringify({ email: value }),
      });
      setStage("code");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function verify() {
    setError(null);
    try {
      await api("/api/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ email: value, code }),
      });
      setOpen(false);
      onLinked();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Email</span>
          {email && <span className="ml-2 text-xs text-[var(--muted)]">{email}</span>}
        </div>
        {connected ? (
          <span className="chip text-[var(--accent)]">Linked</span>
        ) : (
          <button className="btn-ghost px-3 py-1.5" onClick={() => setOpen(!open)}>
            Link email
          </button>
        )}
      </div>
      {open && !connected && (
        <div className="mt-3 space-y-2">
          {stage === "email" ? (
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="you@example.com"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button className="btn-primary" onClick={send}>
                Send code
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className="input tracking-widest"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button className="btn-primary" onClick={verify}>
                Verify
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

function LinkWalletRow({
  connected,
  onLinked,
}: {
  connected: boolean;
  onLinked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link() {
    setBusy(true);
    setError(null);
    try {
      const pubkey = await connectWallet();
      const { nonce, message } = await api<{ nonce: string; message: string }>(
        `/api/auth/wallet/nonce?pubkey=${encodeURIComponent(pubkey)}`
      );
      const signature = await signLoginMessage(message);
      await api("/api/auth/wallet/verify", {
        method: "POST",
        body: JSON.stringify({ pubkey, signature, nonce }),
      });
      onLinked();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Solana wallet</span>
        {connected ? (
          <span className="chip text-[var(--accent)]">Linked</span>
        ) : (
          <button className="btn-ghost px-3 py-1.5" disabled={busy} onClick={link}>
            {busy ? "..." : "Link wallet"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
