import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Info, Layers, Timer } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { getMediaDetail } from "@/lib/queries";
import { Poster } from "@/components/poster";
import { StatusSelect, WatchCountBump } from "@/components/entry-controls";
import { ScorePicker } from "@/components/score-picker";
import { SeasonList, type SeasonRow } from "@/components/season-list";
import { TagEditor } from "@/components/tag-editor";
import {
  DeleteEntryButton,
  FavoriteToggle,
  NotesEditor,
  RefreshMetadataButton,
  SyncStatusButton,
} from "@/components/entry-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { displayTitle, formatDate, formatRuntime, formatYear, secondaryTitle } from "@/lib/format";
import { KIND_LABEL, RELEASE_STATUS_LABEL, SOURCE_LABEL } from "@/lib/constants";

export async function generateMetadata(props: PageProps<"/media/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const media = await prisma.media.findUnique({
    where: { id },
    select: { titleZh: true, titleOriginal: true, titleEn: true },
  });
  return { title: media ? displayTitle(media) : "未找到" };
}

export default async function MediaDetailPage(props: PageProps<"/media/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const detail = await getMediaDetail(id, user.id);
  if (!detail) notFound();

  const { media, entry } = detail;
  const isMovie = media.kind === "MOVIE";
  const title = displayTitle(media);
  const subtitle = secondaryTitle(media);

  const seasonRows: SeasonRow[] = media.seasons.map((season) => {
    const tracked = season.entries[0];
    return {
      id: season.id,
      seasonNumber: season.seasonNumber,
      title: season.title,
      totalEpisodes: season.totalEpisodes,
      airedDate: season.airedDate,
      tracked: tracked
        ? {
            id: tracked.id,
            status: tracked.status,
            progress: tracked.progress,
            totalEpisodes: tracked.totalEpisodes,
            score: tracked.score,
          }
        : null,
    };
  });

  const trackedCount = seasonRows.filter((s) => s.tracked).length;
  const completedCount = seasonRows.filter((s) => s.tracked?.status === "COMPLETED").length;
  const scoredSeasons = seasonRows.filter((s) => s.tracked?.score != null);
  const averageSeasonScore = scoredSeasons.length
    ? (
        scoredSeasons.reduce((sum, s) => sum + (s.tracked?.score ?? 0), 0) / scoredSeasons.length
      ).toFixed(1)
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/library">← 返回片库</Link>
      </Button>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-48">
          <Poster src={media.posterUrl} alt={title} sizes="192px" priority />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            {media.titleZh && media.titleEn && (
              <p className="text-xs text-muted-foreground/80">{media.titleEn}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary">{KIND_LABEL[media.kind]}</Badge>
            <Badge variant="outline">{SOURCE_LABEL[media.source]}</Badge>
            {formatYear(media.releaseDate) && <span>{formatYear(media.releaseDate)}</span>}
            {media.releaseStatus && (
              <span>{RELEASE_STATUS_LABEL[media.releaseStatus]}</span>
            )}
            {media.runtimeMin && (
              <span className="inline-flex items-center gap-1">
                <Timer className="size-3" />
                {isMovie ? formatRuntime(media.runtimeMin) : `单集约 ${media.runtimeMin} 分钟`}
              </span>
            )}
            {!isMovie && media.totalSeasons && (
              <span className="inline-flex items-center gap-1">
                <Layers className="size-3" />
                共 {media.totalSeasons} 季
              </span>
            )}
            {media.siteUrl && (
              <a
                href={media.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                <ExternalLink className="size-3" />
                外部页面
              </a>
            )}
          </div>

          {media.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {media.genres.map(({ genre }) => (
                <Link key={genre.id} href={`/library?genreId=${genre.id}`}>
                  <Badge variant="secondary" className="font-normal hover:bg-muted">
                    {genre.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {entry ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">整体状态</span>
                  <StatusSelect entryId={entry.id} status={entry.status} size="sm" />
                </div>
                <FavoriteToggle entryId={entry.id} initial={entry.isFavorite} />
                <RefreshMetadataButton mediaId={media.id} />
                <DeleteEntryButton mediaId={media.id} title={title} />
              </div>

              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Info className="mt-px size-3 shrink-0" />
                整体状态由你手动维护，不会因为某一季的状态变化而自动改变。
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground">作品评分</span>
                <ScorePicker entryId={entry.id} score={entry.score} />
                {averageSeasonScore && (
                  <span className="text-xs text-muted-foreground">各季均分 {averageSeasonScore}</span>
                )}
              </div>

              <TagEditor entryId={entry.id} initialTags={entry.tags.map(({ tag }) => tag)} />

              <div className="space-y-1.5">
                <Label htmlFor="entry-notes">备注</Label>
                <NotesEditor entryId={entry.id} initial={entry.notes} />
              </div>

              {isMovie ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground">观看次数</span>
                  <WatchCountBump entryId={entry.id} watchCount={entry.watchCount} size="default" />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {entry.startedAt && <span>开始于 {formatDate(entry.startedAt)}</span>}
                {entry.finishedAt && <span>完成于 {formatDate(entry.finishedAt)}</span>}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              还没有该作品的记录。
            </p>
          )}
        </div>
      </div>

      {media.overview && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">简介</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {media.overview}
          </p>
        </section>
      )}

      <Separator />

      {isMovie ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">观看记录</h2>
          {entry ? (
            <WatchCountBump entryId={entry.id} watchCount={entry.watchCount} size="default" />
          ) : (
            <p className="text-sm text-muted-foreground">先在上方选择状态并收藏后即可记录观看次数。</p>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">季列表</h2>
              <p className="text-xs text-muted-foreground">
                已追踪 {trackedCount}/{seasonRows.length} 季
                {completedCount > 0 && ` · 看完 ${completedCount} 季`}
              </p>
            </div>
            {entry && trackedCount > 0 && <SyncStatusButton entryId={entry.id} />}
          </div>

          {entry ? (
            <SeasonList entryId={entry.id} seasons={seasonRows} />
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              该作品还不在你的片库里，先在搜索页添加后才能按季追踪。
            </p>
          )}
        </section>
      )}
    </div>
  );
}
