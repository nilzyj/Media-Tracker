import Link from "next/link";
import type { CSSProperties } from "react";
import { CalendarCheck, Compass, Library, PlayCircle, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/dal";
import {
  getContinueWatching,
  getDashboardSummary,
  getRecentlyFinished,
  getWatchingMovies,
} from "@/lib/queries";
import { MediaCard } from "@/components/media-card";
import { Poster } from "@/components/poster";
import { AnimatedProgress } from "@/components/animated-progress";
import { ProgressBump, WatchCountBump } from "@/components/entry-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { displayTitle, formatDate, formatSeasonLabel, percent } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/constants";

export const metadata = { title: "首页" };

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

  return (
    <div className="relative min-h-full">
      {/* 底层品牌光晕，缓慢漂移 */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 overflow-hidden">
        <div className="absolute -left-24 -top-40 size-[34rem] rounded-full bg-brand/12 blur-3xl animate-drift" />
        <div className="absolute -right-16 -top-24 size-[28rem] rounded-full bg-brand-soft/12 blur-3xl animate-drift [animation-delay:-7s]" />
      </div>

      <div className="mx-auto max-w-6xl space-y-9 px-4 py-6">
        <header className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="bg-brand-gradient inline-block bg-clip-text text-2xl font-semibold text-transparent">
              你好，{user.name || "朋友"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">今天继续看点什么？</p>
          </div>
          <Button asChild variant="outline" size="sm" className="transition-all hover:border-brand/40 hover:text-brand">
            <Link href="/library">
              <Library />
              打开片库
            </Link>
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard
            label="今年看完"
            value={summary.completedThisYear}
            hint="部作品 / 季"
            icon={CalendarCheck}
            accent
          />
          {(["WATCHING", "PLANNING", "ON_HOLD", "COMPLETED"] as const).map((status, i) => (
            <SummaryCard
              key={status}
              index={i + 1}
              label={STATUS_LABEL[status]}
              value={summary.counts[status] ?? 0}
              hint="部作品"
              icon={status === "WATCHING" ? PlayCircle : status === "COMPLETED" ? TrendingUp : Library}
              href={`/library?status=${status}`}
            />
          ))}
        </section>

        {watchingSeasons.length > 0 && (
          <section className="space-y-3">
            <SectionTitle title="继续观看" hint="按季记录进度" />
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {watchingSeasons.map((item, i) => (
                <li
                  key={item.seasonEntryId}
                  style={{ "--index": Math.min(i, 10) } as CSSProperties}
                  className="animate-fade-up"
                >
                  <div className="group flex h-full gap-3 rounded-xl border bg-card/60 p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-[0_14px_30px_-20px_var(--brand)]">
                    <Link
                      href={`/media/${item.media.id}`}
                      className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-muted"
                    >
                      <Poster
                        src={item.media.posterUrl}
                        alt={displayTitle(item.media)}
                        sizes="64px"
                        className="group-hover:scale-105"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Link href={`/media/${item.media.id}`} className="min-w-0">
                        <p className="truncate text-sm font-medium transition-colors group-hover:text-brand">
                          {displayTitle(item.media)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSeasonLabel(item.season.seasonNumber, item.season.title)}
                        </p>
                      </Link>
                      <AnimatedProgress
                        value={percent(item.progress, item.totalEpisodes)}
                        variant="brand"
                        animated
                        label={`${displayTitle(item.media)} 进度`}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <ProgressBump
                          seasonEntryId={item.seasonEntryId}
                          progress={item.progress}
                          total={item.totalEpisodes}
                        />
                        {item.lastWatchedAt && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatDate(item.lastWatchedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {watchingMovies.length > 0 && (
          <section className="space-y-3">
            <SectionTitle title="在看的电影" />
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {watchingMovies.map((item, i) => (
                <li
                  key={item.entryId}
                  style={{ "--index": Math.min(i, 10) } as CSSProperties}
                  className="animate-fade-up"
                >
                  <div className="group flex h-full gap-3 rounded-xl border bg-card/60 p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-[0_14px_30px_-20px_var(--brand)]">
                    <Link
                      href={`/media/${item.media.id}`}
                      className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-muted"
                    >
                      <Poster
                        src={item.media.posterUrl}
                        alt={displayTitle(item.media)}
                        sizes="64px"
                        className="group-hover:scale-105"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                      <Link href={`/media/${item.media.id}`} className="min-w-0">
                        <p className="truncate text-sm font-medium transition-colors group-hover:text-brand">
                          {displayTitle(item.media)}
                        </p>
                      </Link>
                      <WatchCountBump entryId={item.entryId} watchCount={item.watchCount} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recent.works.length > 0 && (
          <section className="space-y-3">
            <SectionTitle title="最近看完的作品" />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {recent.works.map((item, i) => (
                <li key={item.entryId} className="flex flex-col">
                  <MediaCard
                    index={i}
                    media={item.media}
                    status={item.media.kind === "MOVIE" ? "COMPLETED" : undefined}
                    score={item.score}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {recent.seasons.length > 0 && (
          <section className="space-y-3">
            <SectionTitle title="最近看完的季" />
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {/* 网格为 3 列，多取一项会出现落单的一行 */}
              {recent.seasons.slice(0, 3).map((item, i) => (
                <li
                  key={item.seasonEntryId}
                  style={{ "--index": Math.min(i, 10) } as CSSProperties}
                  className="animate-fade-up"
                >
                  <div className="flex gap-3 rounded-xl border bg-card/60 p-2.5 transition-colors duration-300 hover:border-brand/35">
                    <Link
                      href={`/media/${item.media.id}`}
                      className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-muted"
                    >
                      <Poster src={item.media.posterUrl} alt={displayTitle(item.media)} sizes="56px" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/media/${item.media.id}`} className="block min-w-0">
                        <p className="truncate text-sm font-medium hover:text-brand">
                          {displayTitle(item.media)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSeasonLabel(item.season.seasonNumber, item.season.title)}
                        </p>
                      </Link>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {item.finishedAt ? formatDate(item.finishedAt) : ""}
                        {item.score ? ` · ${item.score} 分` : ""}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  accent,
  index = 0,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof PlayCircle;
  href?: string;
  accent?: boolean;
  index?: number;
}) {
  const body = (
    <Card
      style={{ "--index": index } as CSSProperties}
      className={`animate-fade-up h-full transition-all duration-300 hover:-translate-y-0.5 ${
        accent
          ? "border-brand/35 bg-gradient-to-br from-brand/12 via-card/60 to-brand-soft/10"
          : "bg-card/60 hover:border-brand/30"
      }`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
        <Icon className={`size-4 ${accent ? "text-brand" : "text-muted-foreground/60"}`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="transition-opacity hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

function EmptyLibrary() {
  return (
    <div className="relative grid min-h-[70vh] place-items-center px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 size-[36rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl animate-drift" />
      </div>
      <div className="animate-scale-in max-w-md text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-gradient text-white shadow-[0_18px_40px_-18px_var(--brand)]">
          <Compass className="size-7" />
        </span>
        <h1 className="mt-6 bg-brand-gradient inline-block bg-clip-text text-2xl font-semibold text-transparent">
          片库还是空的
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          去搜索页添加电影、电视剧或番剧。支持 TMDB 与 AniList 双数据源，也可以手动录入。
        </p>
        <Button asChild className="mt-7">
          <Link href="/search">开始添加</Link>
        </Button>
      </div>
    </div>
  );
}
