import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Compass, Library, Search } from "lucide-react";
import { requireUser } from "@/lib/dal";
import {
  getContinueWatching,
  getDashboardSummary,
  getRecentlyFinished,
  getWatchingMovies,
  type ContinueItem,
} from "@/lib/queries";
import { Poster } from "@/components/poster";
import { AnimatedProgress } from "@/components/animated-progress";
import { ProgressBump, WatchCountBump } from "@/components/entry-controls";
import { TodayLabel } from "@/components/today-label";
import { Button } from "@/components/ui/button";
import { displayTitle, formatDate, formatSeasonLabel, percent } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "首页" };

const TRACKED_STATUSES = ["WATCHING", "PLANNING", "COMPLETED", "ON_HOLD"] as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const [summary, watchingSeasons, watchingMovies, recent] = await Promise.all([
    getDashboardSummary(user.id),
    getContinueWatching(user.id),
    getWatchingMovies(user.id),
    getRecentlyFinished(user.id),
  ]);

  const isEmpty =
    summary.totalEntries === 0 && watchingSeasons.length === 0 && watchingMovies.length === 0;

  if (isEmpty) {
    return <EmptyLibrary />;
  }

  const stats = TRACKED_STATUSES.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: summary.counts[status] ?? 0,
  }));
  const maxCount = Math.max(1, ...stats.map((s) => s.count));
  const seasons = watchingSeasons.slice(0, 4);
  const finishedWorks = recent.works.slice(0, 5);
  const finishedSeasons = recent.seasons.slice(0, 6);

  return (
    <div className="relative min-h-full">
      {/* 底层：几何网格 + 品牌光晕 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid-lines opacity-70" />
        <div className="absolute -left-28 -top-44 size-[36rem] rounded-full bg-brand/12 blur-3xl animate-drift" />
        <div className="absolute -right-20 top-10 size-[30rem] rounded-full bg-brand-soft/12 blur-3xl animate-drift [animation-delay:-8s]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {/* ── Hero ─────────────────────────────────────────────── */}
          <Bento index={0} elev={3} className="md:col-span-2 lg:col-span-6">
            <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6 overflow-hidden p-6 sm:p-8">
              {/* 几何装饰：右侧同心圆环，与背景方格呼应 */}
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-28 hidden sm:block">
                <div className="size-80 rounded-full border border-brand/15" />
                <div className="absolute inset-10 rounded-full border border-brand/12" />
                <div className="absolute inset-20 rounded-full bg-brand/8 blur-xl" />
              </div>
              <div
                aria-hidden
                className="animate-drift pointer-events-none absolute -left-20 top-1/3 size-72 rounded-full bg-brand/12 blur-3xl"
              />

              <div className="relative min-w-0 flex-1">
                <TodayLabel className="text-xs font-medium text-muted-foreground" />
                <h1 className="bg-brand-gradient mt-2.5 inline-block bg-clip-text text-4xl leading-[1.1] font-semibold tracking-tight text-transparent sm:text-5xl">
                  你好，{user.name || "朋友"}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  {summary.completedThisYear > 0
                    ? `今年已经看完 ${summary.completedThisYear} 部作品 / 季。`
                    : "今天继续看点什么？"}
                </p>
              </div>

              <div className="relative flex flex-wrap items-end gap-x-9 gap-y-5">
                <div>
                  <p className="text-4xl leading-none font-semibold tabular-nums">{summary.totalEntries}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">片库总数</p>
                </div>
                <div>
                  <p className="text-brand-gradient bg-clip-text text-4xl leading-none font-semibold tabular-nums text-transparent">
                    {summary.completedThisYear}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">今年看完</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    asChild
                    size="sm"
                    className="bg-brand-gradient rounded-full text-white hover:opacity-90"
                  >
                    <Link href="/search">
                      <Search />
                      找点新的
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href="/library">
                      <Library />
                      片库
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Bento>

          {/* ── 继续观看（主模块，始终占位）────────────────────── */}
          <Bento index={1} elev={2} className="md:col-span-2 lg:col-span-4" title="继续观看" hint="按季记录进度">
            {seasons.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {seasons.map((item, i) => (
                  <ContinueCard key={item.seasonEntryId} item={item} index={i} />
                ))}
              </ul>
            ) : (
              <div className="grid min-h-[9rem] place-items-center text-center">
                <p className="text-sm text-muted-foreground">
                  还没有在追的剧集。
                  <Link href="/search" className="ml-1 text-brand hover:underline">
                    去发现一部
                  </Link>
                </p>
              </div>
            )}
          </Bento>

          {/* ── 状态分布 ────────────────────────────────────────── */}
          <Bento index={2} elev={3} tone="brand" className="md:col-span-2 lg:col-span-2" title="状态分布">
            <ul className="space-y-3.5">
              {stats.map((s, i) => (
                <li key={s.status}>
                  <Link href={`/library?status=${s.status}`} className="group block">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-white/75 transition-colors group-hover:text-white">
                        {s.label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{s.count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
                      <div
                        className="bar-grow h-full rounded-full bg-white/90"
                        style={
                          {
                            width: s.count ? `${Math.max(8, (s.count / maxCount) * 100)}%` : "0%",
                            "--index": i,
                          } as CSSProperties
                        }
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Bento>

          {/* ── 在看电影（始终占位，避免同排模块出现空洞）── */}
          <Bento index={3} elev={1} className="md:col-span-2 lg:col-span-2" title="在看电影">
            {watchingMovies.length > 0 ? (
              <ul className="space-y-2.5">
                {watchingMovies.slice(0, 3).map((item, i) => {
                  const title = displayTitle(item.media);
                  return (
                    <li key={item.entryId}>
                      <Link
                        href={`/media/${item.media.id}`}
                        style={{ "--index": i } as CSSProperties}
                        className="bento-in group flex items-center gap-3 rounded-2xl border border-border/50 bg-background/40 p-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/35"
                      >
                        <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <Poster src={item.media.posterUrl} alt={title} sizes="40px" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium transition-colors group-hover:text-brand">
                            {title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.updatedAt ? formatDate(item.updatedAt) : ""}
                          </p>
                        </div>
                        <WatchCountBump entryId={item.entryId} watchCount={item.watchCount} size="sm" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid min-h-[7rem] place-items-center text-center">
                <div>
                  <p className="text-sm text-muted-foreground">暂时没有在看的电影。</p>
                  <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
                    <Link href="/search">去找一部</Link>
                  </Button>
                </div>
              </div>
            )}
          </Bento>

          {/* ── 最近看完的作品 ───────────────────────────────────── */}
          <Bento index={4} elev={1} className="md:col-span-2 lg:col-span-4" title="最近看完的作品">
            {finishedWorks.length > 0 ? (
              <ul className="flex gap-2.5">
                {finishedWorks.map((item, i) => {
                  const title = displayTitle(item.media);
                  return (
                    <li
                      key={item.entryId}
                      className="bento-in w-[132px] shrink-0 sm:w-[150px]"
                      style={{ "--index": i } as CSSProperties}
                    >
                      <Link
                        href={`/media/${item.media.id}`}
                        className="group block overflow-hidden rounded-xl border border-border/50"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                          <Poster
                            src={item.media.posterUrl}
                            alt={title}
                            sizes="(max-width: 640px) 30vw, 140px"
                            className="group-hover:scale-105"
                          />
                          {item.score != null && (
                            <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 backdrop-blur-md">
                              {item.score}
                            </span>
                          )}
                        </div>
                        <p className="truncate bg-card/60 px-2 py-1.5 text-[11px] font-medium transition-colors group-hover:text-brand">
                          {title}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">还没有看完的作品。</p>
            )}
          </Bento>

          {/* ── 最近看完的季 ─────────────────────────────────────── */}
          {finishedSeasons.length > 0 && (
            <Bento
              index={5}
              elev={1}
              className="md:col-span-2 lg:col-span-6"
              title="最近看完的季"
            >
              <ul className="flex flex-wrap gap-2">
                {finishedSeasons.map((item, i) => (
                  <li key={item.seasonEntryId} className="bento-in" style={{ "--index": i } as CSSProperties}>
                    <Link
                      href={`/media/${item.media.id}`}
                      className="group flex items-center gap-2.5 rounded-full border border-border/60 bg-background/40 py-1.5 pr-3.5 pl-1.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_10px_24px_-14px_var(--brand)]"
                    >
                      <div className="relative aspect-square w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                        <Poster
                          src={item.media.posterUrl}
                          alt={displayTitle(item.media)}
                          sizes="32px"
                        />
                      </div>
                      <span className="text-xs font-medium transition-colors group-hover:text-brand">
                        {displayTitle(item.media)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatSeasonLabel(item.season.seasonNumber, item.season.title)}
                      </span>
                      {item.score != null && (
                        <span className="text-[11px] font-medium text-amber-500">{item.score}分</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </Bento>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Bento 模块容器
   ------------------------------------------------------------------------- */

function Bento({
  index,
  elev = 1,
  className,
  title,
  hint,
  tone = "default",
  children,
}: {
  index: number;
  elev?: 1 | 2 | 3;
  className?: string;
  title?: string;
  hint?: string;
  /** brand = 品牌渐变填充，用作整页的色彩焦点 */
  tone?: "default" | "brand";
  children: ReactNode;
}) {
  const isBrand = tone === "brand";

  return (
    <section
      style={{ "--index": index } as CSSProperties}
      className={cn(
        "bento bento-hover bento-in relative overflow-hidden",
        isBrand
          ? "border-brand/40 bg-brand-gradient text-white [--bento-radius:1.75rem]"
          : "bento-lift",
        elev === 1 && "elev-1",
        elev === 2 && "elev-2",
        elev === 3 && "elev-3",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          isBrand ? "via-white/50" : "via-brand/45",
        )}
      />
      {title ? (
        <header className="flex items-baseline gap-2 px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && (
            <span className={cn("text-xs", isBrand ? "text-white/70" : "text-muted-foreground")}>
              {hint}
            </span>
          )}
        </header>
      ) : null}
      <div className={cn(title ? "px-5 pb-5" : "p-5 sm:p-6")}>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   继续观看：海报上叠环形进度
   ------------------------------------------------------------------------- */

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

function ContinueCard({ item, index }: { item: ContinueItem; index: number }) {
  const title = displayTitle(item.media);
  const total = item.totalEpisodes ?? item.season.totalEpisodes ?? 0;
  const pct = total > 0 ? percent(item.progress, total) : 0;

  return (
    <li
      style={{ "--index": index } as CSSProperties}
      className="bento-in group relative flex gap-3 rounded-2xl border border-border/50 bg-background/40 p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-[0_12px_28px_-16px_var(--brand)]"
    >
      <Link href={`/media/${item.media.id}`} className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        <Poster src={item.media.posterUrl} alt={title} sizes="80px" />
        {total > 0 && (
          <span className="absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-full bg-card shadow-lg ring-1 ring-border">
            <svg viewBox="0 0 36 36" aria-hidden className="size-9">
              <circle cx="18" cy="18" r={RING_R} className="fill-none stroke-muted" strokeWidth="3.5" />
              <circle
                cx="18"
                cy="18"
                r={RING_R}
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="ring-progress stroke-brand"
                style={
                  {
                    "--ring-circumference": RING_C,
                    "--ring-target": RING_C * (1 - pct / 100),
                  } as CSSProperties
                }
              />
            </svg>
            <span className="absolute text-[9px] font-semibold tabular-nums">{pct}</span>
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
        <div className="min-w-0">
          <Link href={`/media/${item.media.id}`} className="block">
            <p className="truncate text-sm font-medium transition-colors group-hover:text-brand">
              {title}
            </p>
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {formatSeasonLabel(item.season.seasonNumber, item.season.title)}
          </p>
        </div>

        <AnimatedProgress value={pct} variant="brand" animated className="mt-auto" />

        <div className="flex items-center justify-between gap-2">
          <ProgressBump seasonEntryId={item.seasonEntryId} progress={item.progress} total={total} size="sm" />
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {item.progress}/{total || "?"} 集
          </span>
        </div>
      </div>
    </li>
  );
}

function EmptyLibrary() {
  return (
    <div className="relative grid min-h-[70vh] place-items-center px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid-lines opacity-70" />
        <div className="absolute left-1/2 top-1/3 size-[36rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl animate-drift" />
      </div>
      <div className="animate-scale-in max-w-md text-center">
        <span className="bg-brand-gradient mx-auto grid size-16 place-items-center rounded-2xl text-white shadow-[0_18px_40px_-18px_var(--brand)]">
          <Compass className="size-7" />
        </span>
        <h1 className="bg-brand-gradient mt-6 inline-block bg-clip-text text-2xl font-semibold text-transparent">
          片库还是空的
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          去搜索页添加电影、电视剧或番剧。支持 TMDB 与 AniList 双数据源，也可以手动录入。
        </p>
        <Button asChild className="mt-7 rounded-full">
          <Link href="/search">开始添加</Link>
        </Button>
      </div>
    </div>
  );
}