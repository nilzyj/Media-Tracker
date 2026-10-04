import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { getLibrary, getSeasonLibrary, getUserTags, type LibraryFilters } from "@/lib/queries";
import { LibraryFilters as FilterBar } from "@/components/library-filters";
import { LibraryResults } from "@/components/library-results";
import { Skeleton } from "@/components/ui/skeleton";
import { isWatchStatus } from "@/lib/constants";
import type { WorkKind } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "片库" };

function parseFilters(params: Record<string, string | string[] | undefined>): LibraryFilters {
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };

  const status = one("status");
  const kind = one("kind");
  const source = one("source");
  const sort = one("sort");
  const view = one("view");
  const page = Number(one("page") ?? "1");

  return {
    status: status && isWatchStatus(status) ? status : "ALL",
    kind: kind === "MOVIE" || kind === "TV" || kind === "ANIME" ? (kind as WorkKind) : "ALL",
    source:
      source === "TMDB" || source === "ANILIST" || source === "MANUAL" ? source : "ALL",
    sort:
      sort === "added" || sort === "title" || sort === "score" || sort === "year"
        ? sort
        : "updated",
    view: view === "season" ? "season" : "work",
    tagId: one("tagId"),
    genreId: one("genreId"),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export default async function LibraryPage(props: PageProps<"/library">) {
  const params = await props.searchParams;
  const filters = parseFilters(params);
  const user = await requireUser();

  const [tags, genres, workResult, seasonResult] = await Promise.all([
    getUserTags(user.id),
    prisma.genre.findMany({
      where: { media: { some: { media: { entries: { some: { userId: user.id } } } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 60,
    }),
    getLibrary(user.id, filters),
    filters.view === "season" ? getSeasonLibrary(user.id, filters) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">片库</h1>
        <p className="text-sm text-muted-foreground">
          默认按作品聚合；切到「按季」可以直接筛选和更新每一季的状态。
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
        <FilterBar
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          genres={genres}
          total={filters.view === "season" ? (seasonResult?.total ?? 0) : workResult.total}
        />
      </Suspense>

      <LibraryResults
        view={filters.view ?? "work"}
        works={workResult.rows}
        seasons={seasonResult?.rows ?? []}
        page={(seasonResult ?? workResult).page}
        pageCount={(seasonResult ?? workResult).pageCount}
      />
    </div>
  );
}
