"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { Poster } from "@/components/poster";
import { MediaCard } from "@/components/media-card";
import { ProgressBump, SeasonStatusSelect } from "@/components/entry-controls";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { displayTitle, formatSeasonLabel, percent } from "@/lib/format";
import type { WatchStatus, WorkKind, MediaSource } from "@/generated/prisma/client";

type MediaBrief = {
  id: string;
  kind: WorkKind;
  source: MediaSource;
  titleZh: string | null;
  titleOriginal: string;
  titleEn: string | null;
  posterUrl: string | null;
  releaseDate: Date | null;
  runtimeMin: number | null;
  totalSeasons: number | null;
  siteUrl: string | null;
};

type WorkRow = {
  id: string;
  status: WatchStatus;
  score: number | null;
  isFavorite: boolean;
  watchCount: number;
  media: MediaBrief;
  tags: { tag: { id: string; name: string; color: string | null } }[];
  seasons: {
    id: string;
    status: WatchStatus;
    progress: number;
    totalEpisodes: number | null;
    season: {
      id: string;
      seasonNumber: number;
      title: string | null;
      totalEpisodes: number | null;
    };
  }[];
};

type SeasonRow = {
  id: string;
  status: WatchStatus;
  progress: number;
  totalEpisodes: number | null;
  score: number | null;
  season: {
    id: string;
    seasonNumber: number;
    title: string | null;
    totalEpisodes: number | null;
  };
  entry: { id: string; status: WatchStatus; media: MediaBrief };
};

type LibraryResultsProps = {
  view: "work" | "season";
  works: WorkRow[];
  seasons: SeasonRow[];
  page: number;
  pageCount: number;
};

export function LibraryResults({ view, works, seasons, page, pageCount }: LibraryResultsProps) {
  if (view === "season") {
    if (seasons.length === 0) return <EmptyState />;
    return (
      <div className="space-y-2">
        <ul className="space-y-2">
          {seasons.map((row) => {
            const total = row.totalEpisodes ?? row.season.totalEpisodes;
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-2.5">
                <Link
                  href={`/media/${row.entry.media.id}`}
                  className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded bg-muted"
                >
                  <Poster
                    src={row.entry.media.posterUrl}
                    alt={displayTitle(row.entry.media)}
                    sizes="48px"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link href={`/media/${row.entry.media.id}`} className="block min-w-0">
                    <p className="truncate text-sm font-medium hover:underline">
                      {displayTitle(row.entry.media)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatSeasonLabel(row.season.seasonNumber, row.season.title)}
                    </p>
                  </Link>
                  {total ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={percent(row.progress, total)} className="w-28" />
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {row.progress}/{total}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <SeasonStatusSelect seasonEntryId={row.id} status={row.status} />
                  <ProgressBump seasonEntryId={row.id} progress={row.progress} total={total} />
                </div>
              </li>
            );
          })}
        </ul>
        <Pagination page={page} pageCount={pageCount} />
      </div>
    );
  }

  if (works.length === 0) return <EmptyState />;

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {works.map((row) => {
          const isMovie = row.media.kind === "MOVIE";
          const progress = isMovie ? null : summarizeProgress(row.seasons);

          return (
            <li key={row.id}>
              <MediaCard
                media={row.media}
                status={row.status}
                score={row.score}
                isFavorite={row.isFavorite}
                progress={progress}
                tags={row.tags.map(({ tag }) => tag)}
              />
              {!isMovie && row.seasons.length > 0 && (
                <p className="mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                  <Layers className="size-3" />
                  已追踪 {row.seasons.length} 季
                </p>
              )}
              {isMovie && row.watchCount > 0 && (
                <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                  已看 {row.watchCount} 次
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Pagination page={page} pageCount={pageCount} />
    </div>
  );
}

function summarizeProgress(
  seasons: WorkRow["seasons"],
): { current: number; total: number | null } | null {
  if (seasons.length === 0) return null;
  const current = seasons.reduce((sum, s) => sum + s.progress, 0);
  const totals = seasons.map((s) => s.totalEpisodes ?? s.season.totalEpisodes);
  const known = totals.filter((t): t is number => t != null);
  const total = known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
  return { current, total };
}

function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <PageLink page={page - 1} disabled={page <= 1} direction="prev" />
      <span className="text-sm text-muted-foreground tabular-nums">
        {page} / {pageCount}
      </span>
      <PageLink page={page + 1} disabled={page >= pageCount} direction="next" />
    </div>
  );
}

function PageLink({
  page,
  disabled,
  direction,
}: {
  page: number;
  disabled: boolean;
  direction: "prev" | "next";
}) {
  const params = useSearchParams();
  const label = direction === "prev" ? "上一页" : "下一页";
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Icon />
        {label}
      </Button>
    );
  }

  const next = new URLSearchParams(params.toString());
  next.set("page", String(page));

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/library?${next.toString()}`} scroll={false}>
        <Icon />
        {label}
      </Link>
    </Button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <Badge variant="secondary">空</Badge>
      <p className="mt-3 text-sm text-muted-foreground">没有符合条件的记录</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href="/search">去搜索添加</Link>
      </Button>
    </div>
  );
}
