import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const tracks = await prisma.track.findMany({
    where: { active: true },
    orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
    include: {
      trackCategories: {
        where: { enabled: true },
        include: { category: true },
      },
    },
  });

  return ok({
    tracks: tracks.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      sponsor: t.sponsor,
      branding: t.branding ? JSON.parse(t.branding) : null,
      isMain: t.isMain,
      startAt: t.startAt,
      endAt: t.endAt,
      categories: t.trackCategories
        .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
        .map((tc) => ({
          id: tc.category.id,
          key: tc.category.key,
          label: tc.category.label,
          weight: tc.weight,
          schema: JSON.parse(tc.category.schema),
        })),
    })),
  });
});

/** Admin: create a sponsored track with a category subset + weight overrides. */
export const POST = route(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();
  const {
    slug,
    name,
    sponsor,
    branding,
    startAt,
    endAt,
    categories,
  } = body as {
    slug?: string;
    name?: string;
    sponsor?: string;
    branding?: { color?: string; logoUrl?: string; tagline?: string };
    startAt?: string;
    endAt?: string;
    categories?: { key: string; weight: number }[];
  };

  if (!slug || !name || !categories?.length) {
    return fail("slug, name and at least one category are required", 422);
  }

  const existing = await prisma.track.findUnique({ where: { slug } });
  if (existing) return fail("A track with that slug already exists", 409);

  const cats = await prisma.category.findMany({
    where: { key: { in: categories.map((c) => c.key) } },
  });
  const catByKey = Object.fromEntries(cats.map((c) => [c.key, c]));

  const track = await prisma.track.create({
    data: {
      slug,
      name,
      sponsor: sponsor ?? null,
      branding: branding ? JSON.stringify(branding) : null,
      startAt: startAt ? new Date(startAt) : null,
      endAt: endAt ? new Date(endAt) : null,
      isMain: false,
      trackCategories: {
        create: categories
          .filter((c) => catByKey[c.key])
          .map((c) => ({
            categoryId: catByKey[c.key].id,
            weight: c.weight ?? catByKey[c.key].baseWeight,
            enabled: true,
          })),
      },
    },
  });

  return ok({ trackId: track.id, slug: track.slug });
});
