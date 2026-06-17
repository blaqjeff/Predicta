"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthDialog } from "@/components/AuthDialog";
import { useSession } from "@/components/SessionProvider";

const errorMessages: Record<string, string> = {
  x_not_configured: "X sign-in is unavailable right now. Try email or wallet instead.",
  x_state: "X sign-in session expired. Please try again.",
  x_failed: "X sign-in failed. Please try again.",
};

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useSession();
  const [open, setOpen] = useState(true);
  const error = params.get("error");

  if (user) {
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <p className="mb-3">
          Signed in as <span className="font-semibold">@{user.username}</span>
        </p>
        <Link href="/matches" className="btn-primary">
          Start predicting
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {errorMessages[error] ?? "Something went wrong. Please try again."}
        </div>
      )}
      <AuthDialog
        open={open}
        onClose={() => {
          setOpen(false);
          router.push("/");
        }}
      />
      {!open && (
        <button className="btn-primary" onClick={() => setOpen(true)}>
          Open sign-in
        </button>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-[var(--muted)]">Loading...</p>}>
      <LoginInner />
    </Suspense>
  );
}
