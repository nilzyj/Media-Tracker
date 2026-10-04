import Link from "next/link";
import { Heart, Layers } from "lucide-react";
import { Poster } from "@/components/poster";
import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { displayTitle, formatRuntime, percent, secondaryTitle } from "@/lib/format";
import { KIND_LABEL } from "@/lib/constants";
import type { MediaSource, WatchStatus, WorkKind } from "@/generated/prisma/client";

export type MediaCardData = {
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

type MediaCardProps = {
  media: MediaCardData;
  status?: WatchStatus;
  score?: number | null;
  isFavorite?: boolean;
  progress?: { current: number; total: number | null } | null;
  tags?: { id: string; name: string; color: string | null }[];
  className?: string;
  priority?: boolean;
};

export function MediaCard({
  media,
  status,
  score,
  isFavorite,
  progress,
  tags,
  className,
  priority,
}: MediaCardProps) {
  const title = displayTitle(media);
  const subtitle = secondaryTitle(media);

  return (
    <Link
      href={`/media/${media.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        <Poster
          src={media.posterUrl}
          alt={title}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
          priority={priority}
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-1.5">
          {status ? <StatusBadge status={status} className="backdrop-blur-sm" /> : <span />}
          {isFavorite && (
            <span className="grid size-6 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm">
              <Heart className="size-3.5 fill-current" />
            </span>
          )}
        </div>

        {progress && progress.total ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
            <Progress
              value={percent(progress.current, progress.total)}
              className="h-1 bg-white/25 [&>div]:bg-white"
            />
            <p className="mt-1 text-[11px] text-white/90 tabular-nums">
              {progress.current}/{progress.total} 集
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-1 p-2.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug" title={title}>
          {title}
        </p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1 pt-0.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">
            {KIND_LABEL[media.kind]}
          </Badge>
          {media.releaseDate && <span>{media.releaseDate.getUTCFullYear()}</span>}
          {media.kind === "MOVIE" && formatRuntime(media.runtimeMin) && (
            <span>{formatRuntime(media.runtimeMin)}</span>
          )}
          {media.kind !== "MOVIE" && media.totalSeasons && (
            <span className="inline-flex items-center gap-0.5">
              <Layers className="size-3" />
              {media.totalSeasons} 季
            </span>
          )}
          {score != null && <span className="tabular-nums">{score} 分</span>}
        </div>
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="rounded border px-1.5 py-0 text-[10px] text-muted-foreground"
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
    </Link>
  );
}
