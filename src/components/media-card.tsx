import Link from "next/link";
import type { CSSProperties } from "react";
import { Heart, Layers, Star } from "lucide-react";
import { Poster } from "@/components/poster";
import { StatusBadge } from "@/components/status-badge";
import { AnimatedProgress } from "@/components/animated-progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { displayTitle, formatRuntime, percent, secondaryTitle } from "@/lib/format";
import { KIND_LABEL, SEASONAL_KINDS } from "@/lib/constants";
import type { MediaSource, WatchStatus, WorkKind } from "@/generated/prisma/client";

export type MediaCardData = {
  id: string;
  kind: WorkKind;
  source: MediaSource;
  titleZh: string | null;
  titleOriginal: string;
  titleEn: string | null;
  author: string | null;
  posterUrl: string | null;
  releaseDate: Date | null;
  runtimeMin: number | null;
  totalSeasons: number | null;
  siteUrl: string | null;
};

type MediaCardProps = {
  media: MediaCardData;
  status?: WatchStatus;
  score?: number | null;
  isFavorite?: boolean;
  /** 分季作品的季级汇总进度 */
  progress?: { current: number; total: number | null } | null;
  /** 作品级进度（书籍、电影、单季剧等不分季的情况） */
  flatProgress?: { current: number; total: number } | null;
  tags?: { id: string; name: string; color: string | null }[];
  className?: string;
  priority?: boolean;
  /** 错峰入场序号 */
  index?: number;
};

export function MediaCard({
  media,
  status,
  score,
  isFavorite,
  progress,
  flatProgress,
  tags,
  className,
  priority,
  index = 0,
}: MediaCardProps) {
  const title = displayTitle(media);
  const subtitle = secondaryTitle(media);
  const seasonal = SEASONAL_KINDS.includes(media.kind);
  const shown = progress?.total
    ? progress
    : flatProgress && flatProgress.total > 0
      ? flatProgress
      : null;
  const pct = shown?.total ? percent(shown.current, shown.total) : 0;

  return (
    <Link
      href={`/media/${media.id}`}
      style={{ "--index": Math.min(index, 12) } as CSSProperties}
      className={cn(
        "group animate-fade-up relative flex flex-1 flex-col overflow-hidden rounded-xl border bg-card/60 shadow-xs",
        "transition-[transform,box-shadow,border-color] duration-300 ease-out",
        "hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_18px_40px_-20px_var(--brand)]",
        "focus-visible:-translate-y-1 focus-visible:border-brand/50 focus-visible:outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        className,
      )}
    >
      {/* 悬浮时斜向扫过的高光：默认暂停，hover 才播放一遍 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      >
        <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent [animation-play-state:paused] animate-[sheen_0.9s_ease-out] group-hover:[animation-play-state:running]" />
      </span>

      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        <Poster
          src={media.posterUrl}
          alt={title}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
          priority={priority}
          className="group-hover:scale-[1.06]"
        />

        {/* 底部渐变，悬浮时加深以突出文字 */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/85 via-black/35 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
          {status ? (
            <StatusBadge status={status} glow className="shadow-sm backdrop-blur-md" />
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            {isFavorite && (
              <span className="grid size-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                <Heart className="size-3.5 fill-current" />
              </span>
            )}
            {score != null && (
              <span className="flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[11px] font-medium text-amber-300 backdrop-blur-md">
                <Star className="size-3 fill-current" />
                {score}
              </span>
            )}
          </div>
        </div>

        {shown ? (
          <div className="absolute inset-x-0 bottom-0 p-2">
            <AnimatedProgress
              value={pct}
              variant="light"
              animated
              label={`${title} 进度`}
            />
            <p className="mt-1 text-[11px] font-medium text-white/95 tabular-nums drop-shadow">
              {shown.current}/{shown.total} 集
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug transition-colors duration-200 group-hover:text-brand" title={title}>
          {title}
        </p>
{media.author && (
          <p className="truncate text-xs text-muted-foreground/90" title={media.author}>
            {media.author}
          </p>
        )}
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        )}
        <div className="mt-auto space-y-1.5 pt-2">
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">
              {KIND_LABEL[media.kind]}
            </Badge>
            {media.releaseDate && <span className="tabular-nums">{media.releaseDate.getUTCFullYear()}</span>}
            {media.kind === "MOVIE" && formatRuntime(media.runtimeMin) && (
              <span>{formatRuntime(media.runtimeMin)}</span>
            )}
            {seasonal && media.totalSeasons && (
              <span className="inline-flex items-center gap-0.5">
                <Layers className="size-3" />
                {media.totalSeasons} 季
              </span>
            )}
          </div>
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="rounded border px-1.5 py-0 text-[10px] text-muted-foreground transition-colors duration-200 group-hover:border-brand/30"
                  style={tag.color ? { borderColor: tag.color } : undefined}
                >
                  {tag.name}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
