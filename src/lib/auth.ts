import { prisma } from "./prisma";
import { getSessionUserId } from "./session";
import { validateUsername } from "./validation";

export type SafeUser = {
  id: string;
  username: string;
  xHandle: string | null;
  email: string | null;
  rewardWallet: string | null;
  isAdmin: boolean;
};

export async function getCurrentUser(): Promise<SafeUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    xHandle: user.xHandle,
    email: user.email,
    rewardWallet: user.rewardWallet,
    isAdmin: user.isAdmin,
  };
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not authenticated");
  return user;
}

export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new AuthError("Admin only", 403);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Generates a unique, valid username, deriving from a desired base when possible. */
export async function generateUniqueUsername(base: string): Promise<string> {
  let candidate = base
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 20)
    .toLowerCase();
  if (candidate.length < 3) candidate = `player${candidate}`;
  candidate = candidate.slice(0, 20);

  let attempt = candidate;
  let suffix = 0;
  // Try base, then base1, base2, ... until free.
  while (await prisma.user.findUnique({ where: { username: attempt } })) {
    suffix += 1;
    const tail = String(suffix);
    attempt = `${candidate.slice(0, 20 - tail.length)}${tail}`;
  }
  return attempt;
}

/**
 * Finds the user for an existing auth identity, or creates a new user + identity.
 * `desiredUsername` is used for new users; falls back to a generated one.
 */
export async function findOrCreateUserByIdentity(opts: {
  provider: "x" | "email" | "wallet";
  providerId: string;
  desiredUsername?: string;
  email?: string;
  xHandle?: string;
  rewardWallet?: string;
}): Promise<{ userId: string; isNew: boolean }> {
  const existing = await prisma.authIdentity.findUnique({
    where: {
      provider_providerId: {
        provider: opts.provider,
        providerId: opts.providerId,
      },
    },
  });
  if (existing) return { userId: existing.userId, isNew: false };

  const username = await generateUniqueUsername(
    opts.desiredUsername || opts.xHandle || opts.email?.split("@")[0] || "player"
  );

  const user = await prisma.user.create({
    data: {
      username,
      xHandle: opts.xHandle ?? null,
      email: opts.email ?? null,
      rewardWallet: opts.rewardWallet ?? null,
      identities: {
        create: {
          provider: opts.provider,
          providerId: opts.providerId,
        },
      },
    },
  });
  return { userId: user.id, isNew: true };
}

/** Links a new identity to an already-signed-in user (account linking). */
export async function linkIdentity(opts: {
  userId: string;
  provider: "x" | "email" | "wallet";
  providerId: string;
}): Promise<void> {
  const existing = await prisma.authIdentity.findUnique({
    where: {
      provider_providerId: {
        provider: opts.provider,
        providerId: opts.providerId,
      },
    },
  });
  if (existing && existing.userId !== opts.userId) {
    throw new AuthError("That login is already linked to another account", 409);
  }
  if (existing) return;
  await prisma.authIdentity.create({
    data: {
      userId: opts.userId,
      provider: opts.provider,
      providerId: opts.providerId,
    },
  });
}

export { validateUsername };
