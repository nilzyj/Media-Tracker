import type { ReleaseStatus, WatchStatus, WorkKind } from "@/generated/prisma/client";

export const WATCH_STATUSES: WatchStatus[] = [
  "PLANNING",
  "WATCHING",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
];

export const STATUS_LABEL: Record<WatchStatus, string> = {
  PLANNING: "想看",
  WATCHING: "在看",
  COMPLETED: "已看",
  ON_HOLD: "搁置",
  DROPPED: "弃剧",
};

/** Badge classes per status. */
export const STATUS_BADGE_CLASS: Record<WatchStatus, string> = {
  PLANNING:
    "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  WATCHING:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  COMPLETED:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  ON_HOLD:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  DROPPED:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export const STATUS_DOT_CLASS: Record<WatchStatus, string> = {
  PLANNING: "bg-sky-500",
  WATCHING: "bg-emerald-500",
  COMPLETED: "bg-violet-500",
  ON_HOLD: "bg-amber-500",
  DROPPED: "bg-rose-500",
};

export const KIND_LABEL: Record<WorkKind, string> = {
  MOVIE: "电影",
  TV: "电视剧",
  ANIME: "动漫",
  BOOK: "书籍",
  MANGA: "漫画",
  PODCAST: "播客",
};

/** 书籍 / 漫画 / 播客不参与「季」的追踪，进度挂在作品级。 */
export const FLAT_KINDS: readonly WorkKind[] = ["MOVIE", "BOOK", "MANGA", "PODCAST"];

/** 只有剧集 / 动漫按季追踪。 */
export const SEASONAL_KINDS: readonly WorkKind[] = ["TV", "ANIME"];

/** 需要作者 / 主播字段的类型。 */
export const AUTHOR_KINDS: readonly WorkKind[] = ["BOOK", "MANGA", "PODCAST"];

export const SOURCE_LABEL = {
  TMDB: "TMDB",
  ANILIST: "AniList",
  MANUAL: "手动录入",
} as const;

export const RELEASE_STATUS_LABEL: Record<ReleaseStatus, string> = {
  ONGOING: "连载中",
  FINISHED: "已完结",
  CANCELLED: "已取消",
};

export const STATUS_ORDER: Record<WatchStatus, number> = {
  WATCHING: 0,
  PLANNING: 1,
  ON_HOLD: 2,
  COMPLETED: 3,
  DROPPED: 4,
};

export function isWatchStatus(value: unknown): value is WatchStatus {
  return typeof value === "string" && (WATCH_STATUSES as string[]).includes(value);
}
