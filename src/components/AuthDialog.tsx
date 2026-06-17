"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/fetcher";
import { useSession, SessionUser } from "./SessionProvider";
import { connectWallet, signLoginMessage } from "@/lib/solanaClient";

type Method = "email" | "wallet" | "x";

export function AuthDialog({
  open,
  onClose,
  title = "Sign in",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
}) {
  const { refresh } = useSession();
  const [method, setMethod] = useState<Method>("email");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card my-auto w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="auth-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 rounded-lg border border-[var(--border)] p-1">
          {(["email", "wallet", "x"] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                method === m
                  ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {m === "x" ? "X" : m}
            </button>
          ))}
        </div>

        {method === "email" && (
          <EmailLogin
            onDone={async () => {
              await refresh();
              onClose();
            }}
          />
        )}
        {method === "wallet" && (
          <WalletLogin
            onDone={async () => {
              await refresh();
              onClose();
            }}
          />
        )}
        {method === "x" && <XLogin />}
      </div>
    </div>,
    document.body
  );
}

function EmailLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/email/start", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setStage("code");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      await api<{ user: SessionUser }>("/api/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Email</label>
        <input
          className="input"
          type="email"
          placeholder="you@example.com"
          value={email}
          disabled={stage === "code"}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {stage === "code" && (
        <div>
          <label className="label">6-digit code</label>
          <input
            className="input tracking-widest"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Check your email — the code expires in 10 minutes.
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {stage === "email" ? (
        <button className="btn-primary w-full" disabled={busy || !email} onClick={sendCode}>
          {busy ? "Sending..." : "Send code"}
        </button>
      ) : (
        <button className="btn-primary w-full" disabled={busy || code.length !== 6} onClick={verify}>
          {busy ? "Verifying..." : "Verify & sign in"}
        </button>
      )}
    </div>
  );
}

function WalletLogin({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setError(null);
    setBusy(true);
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
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        Connect a Solana wallet and sign a message to prove ownership. This address
        saves automatically — probably nothing. No fee, no transaction.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-accent2 w-full" disabled={busy} onClick={signIn}>
        {busy ? "Waiting for wallet..." : "Connect & sign"}
      </button>
    </div>
  );
}

function XLogin() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        Sign in with X. Your X handle becomes your prediction username.
      </p>
      <a className="btn-ghost w-full" href="/api/auth/x/start">
        Continue with X
      </a>
    </div>
  );
}
