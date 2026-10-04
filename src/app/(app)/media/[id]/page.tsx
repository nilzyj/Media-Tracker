import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Layers, Timer } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { getMediaDetail } from "@/lib/queries";
import { Poster } from "@/components/poster";
import { StatusSelect, WatchCountBump, WorkProgressBump } from "@/components/entry-controls";
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
import { Separator } from "@/components/ui/separator";
import { displayTitle, formatDate, formatRuntime, formatYear, secondaryTitle } from "@/lib/format";
import {
  KIND_LABEL,
  RELEASE_STATUS_LABEL,
  SEASONAL_KINDS,
  SOURCE_LABEL,
} from "@/lib/constants";
import type { WorkKind } from "@/generated/prisma/client";

/** 非影视类型的进度区块标题与计量单位。 */
const PROGRESS_LABEL: Partial<Record<WorkKind, string>> = {
  BOOK: "阅读进度",
  MANGA: "阅读进度",
  PODCAST: "收听进度",
};
const PROGRESS_UNIT: Partial<Record<WorkKind, string>> = {
  BOOK: "页",
  MANGA: "话",
  PODCAST: "期",
};

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
  const seasonal = SEASONAL_KINDS.includes(media.kind);
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
    <div className="relative min-h-full">
      {/* 背景图 + 渐变遮罩，充当详情页的 hero 底 */}
      {media.backdropUrl && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.backdropUrl}
            alt=""
            className="size-full scale-110 object-cover opacity-35 blur-[3px] saturate-125"
          />
          {/* 品牌色晕染：浅色主题下用正片叠底压出影院色调，避免背景被洗成纯白 */}
          <div className="absolute inset-0 bg-brand/15 mix-blend-multiply dark:mix-blend-screen dark:bg-brand/20" />
          {/* 双向遮罩：纵向收边融入页面，横向保证标题与右侧表单可读 */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/75 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/55 to-background/15" />
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="animate-fade-up -ml-2">
        <Link href="/library">← 返回片库</Link>
      </Button>

      <div className="animate-fade-up flex flex-col gap-6 sm:flex-row" style={{ animationDelay: "80ms" }}>
        <div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl bg-muted shadow-[0_24px_50px_-24px_var(--brand)] ring-1 ring-foreground/5 sm:w-48">
          <Poster src={media.posterUrl} alt={title} sizes="192px" priority />
        </div>

        <div className="animate-fade-up min-w-0 flex-1 space-y-4" style={{ animationDelay: "140ms" }}>
          <div className="space-y-1">
            <h1 className="bg-brand-gradient inline-block bg-clip-text text-2xl font-semibold leading-tight text-transparent sm:text-3xl">
              {title}
            </h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            {media.titleEn && media.titleEn !== subtitle && (
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
            {!seasonal && media.totalSeasons && (
              <span className="inline-flex items-center gap-1">
                <Layers className="size-3" />
                共 {media.totalSeasons} 季
              </span>
            )}
            {media.author && <span>{media.author}</span>}
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
                  <Link
                    key={genre.id}
                    href={`/library?genreId=${genre.id}`}
                    className="rounded border border-border/60 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            )}

          {entry ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusSelect entryId={entry.id} status={entry.status} size="sm" />
                  <FavoriteToggle entryId={entry.id} initial={entry.isFavorite} />
                  {media.source !== "MANUAL" && <RefreshMetadataButton mediaId={media.id} />}
                  <DeleteEntryButton mediaId={media.id} title={title} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  整体状态手动维护，不会随某一季的状态变化而自动改变。
                </p>
              </div>

              {/* 标签列对齐，避免每项各自缩进造成视觉错位 */}
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
                <span className="text-xs text-muted-foreground sm:pt-1.5">作品评分</span>
                <div className="flex flex-wrap items-center gap-3">
                  <ScorePicker entryId={entry.id} score={entry.score} />
                  {averageSeasonScore && (
                    <span className="text-xs text-muted-foreground">各季均分 {averageSeasonScore}</span>
                  )}
                </div>

                <span className="text-xs text-muted-foreground sm:pt-1.5">标签</span>
                <TagEditor entryId={entry.id} initialTags={entry.tags.map(({ tag }) => tag)} />

                <span className="text-xs text-muted-foreground sm:pt-1.5">备注</span>
                <NotesEditor entryId={entry.id} initial={entry.notes} />

                {entry.startedAt || entry.finishedAt ? (
                  <>
                    <span className="text-xs text-muted-foreground sm:pt-1.5">时间</span>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {entry.startedAt && <span>开始于 {formatDate(entry.startedAt)}</span>}
                      {entry.finishedAt && <span>完成于 {formatDate(entry.finishedAt)}</span>}
                    </div>
                  </>
                ) : null}
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
      ) : seasonal ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">季列表</h2>
              <p className="text-xs text-muted-foreground">
                {trackedCount > 0
                  ? `已追踪 ${trackedCount} 季${completedCount > 0 ? ` · 看完 ${completedCount} 季` : ""}`
                  : "尚未加入追踪"}
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
      ) : (
        // 书籍 / 漫画 / 播客：没有季，进度直接挂在作品上
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">{PROGRESS_LABEL[media.kind] ?? "进度"}</h2>
            <p className="text-xs text-muted-foreground">
              {entry?.totalEpisodes
                ? `已记录 ${entry.progress}/${entry.totalEpisodes}`
                : "设置总集数后即可记录进度"}
            </p>
          </div>
          {entry ? (
            <WorkProgressBump
              entryId={entry.id}
              progress={entry.progress}
              total={entry.totalEpisodes}
              unit={PROGRESS_UNIT[media.kind] ?? "集"}
            />
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              先在上方选择状态，该作品加入片库后才能记录进度。
            </p>
          )}
        </section>
      )}
      </div>
    </div>
  );
}
