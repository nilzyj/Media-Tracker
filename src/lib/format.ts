import type { Media } from "@/generated/prisma/client";

type TitleLike = Pick<Media, "titleZh" | "titleOriginal" | "titleEn">;

/** Chinese title first, then the original, then English. */
export function displayTitle(media: TitleLike): string {
  return media.titleZh?.trim() || media.titleOriginal?.trim() || media.titleEn?.trim() || "未命名";
}

export function secondaryTitle(media: TitleLike): string | null {
  const primary = displayTitle(media);
  const candidates = [media.titleOriginal, media.titleEn].filter(
    (t): t is string => Boolean(t && t.trim() && t.trim() !== primary),
  );
  return candidates[0] ?? null;
}

export function formatYear(date: Date | null | undefined): string | null {
  if (!date) return null;
  return String(date.getUTCFullYear());
}

export function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 135 -> "2 小时 15 分钟" */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}

export function formatMinutesTotal(minutes: number): string {
  if (minutes <= 0) return "0 分钟";
  const h = Math.floor(minutes / 60);
  if (h < 1) return `${minutes} 分钟`;
  if (h < 24) return `${h} 小时`;
  const days = Math.round((h / 24) * 10) / 10;
  return `${days} 天`;
}

export function formatSeasonLabel(seasonNumber: number, title: string | null | undefined): string {
  if (seasonNumber === 0) return title?.trim() || "特别篇";
  const fallback = `第 ${seasonNumber} 季`;
  const trimmed = title?.trim();
  if (!trimmed) return fallback;
  // TMDB returns titles like "Season 1"; prefer the Chinese label unless the
  // upstream name adds information (e.g. "Season 2: The Phoenix Rising").
  if (/^season\s*\d+$/i.test(trimmed)) return fallback;
  return `${fallback} · ${trimmed}`;
}

export function scoreLabel(score: number | null | undefined): string {
  if (score == null) return "未评分";
  return `${score} 分`;
}

export function percent(progress: number, total: number | null | undefined): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((progress / total) * 100));
}
