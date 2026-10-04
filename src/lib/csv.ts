import type { ExportEntry, ExportSeason } from "@/lib/export-data";
import { isWatchStatus } from "@/lib/constants";
import type { MediaSource, WatchStatus, WorkKind } from "@/generated/prisma/client";

const SOURCES: MediaSource[] = ["TMDB", "ANILIST", "MANUAL"];
const KINDS: WorkKind[] = ["MOVIE", "TV", "ANIME", "BOOK", "MANGA", "PODCAST"];

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export const CSV_HEADERS = [
  "source",
  "externalKey",
  "kind",
  "titleOriginal",
  "titleZh",
  "author",
  "releaseDate",
  "runtimeMin",
  "genres",
  "entryStatus",
  "entryScore",
  "isFavorite",
  "watchCount",
  "progress",
  "totalEpisodes",
  "tags",
  "notes",
  "seasonNumber",
  "seasonTitle",
  "seasonTotalEpisodes",
  "seasonStatus",
  "seasonProgress",
  "seasonScore",
  "seasonNotes",
  "seasonStartedAt",
  "seasonFinishedAt",
  "seasonLastWatchedAt",
] as const;

/** One row per (entry, season); movies emit a single row with an empty season. */
export function toCsv(entries: ExportEntry[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];

  for (const entry of entries) {
    const base = [
      entry.media.source,
      entry.media.externalKey,
      entry.media.kind,
      entry.media.titleOriginal,
      entry.media.titleZh,
      entry.media.author,
      entry.media.releaseDate?.slice(0, 10),
      entry.media.runtimeMin,
      entry.media.genres.join("|"),
      entry.status,
      entry.score,
      entry.isFavorite ? "1" : "0",
      entry.watchCount,
      entry.progress,
      entry.totalEpisodes,
      entry.tags.join("|"),
      entry.notes,
    ];

    if (entry.media.kind === "MOVIE" || entry.seasons.length === 0) {
      // Pad to the header width so movie rows stay well-formed CSV.
      const padded = [...base, ...Array<string>(CSV_HEADERS.length - base.length).fill("")];
      lines.push(padded.map(escapeCell).join(","));
      continue;
    }

    for (const season of entry.seasons) {
      lines.push(
        [
          ...base,
          season.seasonNumber,
          season.title,
          season.totalEpisodes,
          season.status,
          season.progress,
          season.score,
          season.notes,
          season.startedAt,
          season.finishedAt,
          season.lastWatchedAt,
        ]
          .map(escapeCell)
          .join(","),
      );
    }
  }

  return lines.join("\r\n");
}

export function csvFilename(stamp: string): string {
  return `media-tracker-${stamp}.csv`;
}

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const clean = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => Object.fromEntries(headers.map((h, index) => [h, (r[index] ?? "").trim()])));
}

function num(value: string): number | null {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function list(value: string): string[] {
  return value
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean);
}

function status(value: string): WatchStatus | null {
  return isWatchStatus(value) ? value : null;
}

function source(value: string): MediaSource {
  return SOURCES.includes(value as MediaSource) ? (value as MediaSource) : "MANUAL";
}

function kind(value: string): WorkKind {
  return KINDS.includes(value as WorkKind) ? (value as WorkKind) : "TV";
}

export type ImportPayload = {
  entries: ExportEntry[];
  warnings: string[];
};

/** Normalise parsed JSON or CSV into the same import payload shape. */
export function normalizeImport(raw: unknown, format: "json" | "csv"): ImportPayload {
  const warnings: string[] = [];

  if (format === "json") {
    const data = raw as { entries?: unknown };
    if (!Array.isArray(data?.entries)) {
      return { entries: [], warnings: ["JSON 结构不正确：缺少 entries 数组"] };
    }

    const entries: ExportEntry[] = [];
    for (const [index, item] of data.entries.entries()) {
      const entry = item as Partial<ExportEntry>;
      if (!entry.media?.externalKey || !entry.media?.titleOriginal) {
        warnings.push(`第 ${index + 1} 条缺少 externalKey 或标题，已跳过`);
        continue;
      }
      entries.push({
        media: {
          source: source(String(entry.media.source ?? "MANUAL")),
          externalKey: String(entry.media.externalKey),
          kind: kind(String(entry.media.kind ?? "TV")),
          titleOriginal: String(entry.media.titleOriginal),
          titleZh: entry.media.titleZh ? String(entry.media.titleZh) : null,
          titleEn: entry.media.titleEn ? String(entry.media.titleEn) : null,
          author: entry.media.author ? String(entry.media.author) : null,
          overview: entry.media.overview ? String(entry.media.overview) : null,
          posterUrl: entry.media.posterUrl ? String(entry.media.posterUrl) : null,
          releaseDate: entry.media.releaseDate ? String(entry.media.releaseDate) : null,
          runtimeMin: entry.media.runtimeMin ?? null,
          siteUrl: entry.media.siteUrl ? String(entry.media.siteUrl) : null,
          genres: Array.isArray(entry.media.genres) ? entry.media.genres.map(String) : [],
        },
        status: status(String(entry.status ?? "")) ?? "PLANNING",
        score: entry.score ?? null,
        isFavorite: Boolean(entry.isFavorite),
        notes: entry.notes ? String(entry.notes) : null,
        watchCount: Number(entry.watchCount ?? 0) || 0,
        progress: Number(entry.progress ?? 0) || 0,
        totalEpisodes: entry.totalEpisodes ?? null,
        startedAt: entry.startedAt ? String(entry.startedAt) : null,
        finishedAt: entry.finishedAt ? String(entry.finishedAt) : null,
        tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
        seasons: Array.isArray(entry.seasons)
          ? entry.seasons.map((s: Partial<ExportSeason>) => ({
              seasonNumber: Number(s.seasonNumber ?? 1),
              title: s.title ? String(s.title) : null,
              totalEpisodes: s.totalEpisodes ?? null,
              airedDate: s.airedDate ? String(s.airedDate) : null,
              status: status(String(s.status ?? "")),
              progress: s.progress ?? null,
              score: s.score ?? null,
              notes: s.notes ? String(s.notes) : null,
              startedAt: s.startedAt ? String(s.startedAt) : null,
              finishedAt: s.finishedAt ? String(s.finishedAt) : null,
              lastWatchedAt: s.lastWatchedAt ? String(s.lastWatchedAt) : null,
            }))
          : [],
      });
    }

    return { entries, warnings };
  }

  // CSV: group consecutive rows that share the same externalKey.
  const rows = raw as CsvRow[];
  const groups = new Map<string, ExportEntry>();

  for (const [index, row] of rows.entries()) {
    const externalKey = row.externalKey;
    if (!externalKey) {
      warnings.push(`第 ${index + 2} 行缺少 externalKey，已跳过`);
      continue;
    }

    let entry = groups.get(externalKey);
    if (!entry) {
      entry = {
        media: {
          source: source(row.source),
          externalKey,
          kind: kind(row.kind),
          titleOriginal: row.titleOriginal || "(未命名)",
          titleZh: row.titleZh || null,
          titleEn: null,
          author: row.author || null,
          overview: null,
          posterUrl: null,
          releaseDate: row.releaseDate || null,
          runtimeMin: num(row.runtimeMin),
          siteUrl: null,
          genres: list(row.genres),
        },
        status: status(row.entryStatus) ?? "PLANNING",
        score: num(row.entryScore),
        isFavorite: row.isFavorite === "1",
        notes: row.notes || null,
        watchCount: num(row.watchCount) ?? 0,
        progress: num(row.progress) ?? 0,
        totalEpisodes: num(row.totalEpisodes),
        startedAt: null,
        finishedAt: null,
        tags: list(row.tags),
        seasons: [],
      };
      groups.set(externalKey, entry);
    }

    const seasonNumber = num(row.seasonNumber);
    if (seasonNumber == null) continue;

    entry.seasons.push({
      seasonNumber,
      title: row.seasonTitle || null,
      totalEpisodes: num(row.seasonTotalEpisodes),
      airedDate: null,
      status: status(row.seasonStatus),
      progress: num(row.seasonProgress),
      score: num(row.seasonScore),
      notes: row.seasonNotes || null,
      startedAt: row.seasonStartedAt || null,
      finishedAt: row.seasonFinishedAt || null,
      lastWatchedAt: row.seasonLastWatchedAt || null,
    });
  }

  for (const entry of groups.values()) {
    entry.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  return { entries: [...groups.values()], warnings };
}
