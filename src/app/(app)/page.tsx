import Link from "next/link";
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
import { ProgressBump, WatchCountBump } from "@/components/entry-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { displayTitle, formatDate, formatSeasonLabel, percent } from "@/lib/format";
import { STATUS_LABEL, WATCH_STATUSES } from "@/lib/constants";

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
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Compass className="mx-auto size-10 text-muted-foreground/50" />
        <h1 className="mt-4 text-xl font-semibold">片库还是空的</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          去搜索页添加电影、电视剧或番剧，支持 TMDB 与 AniList 双数据源，也可以手动录入。
        </p>
        <Button asChild className="mt-6">
          <Link href="/search">开始添加</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">你好，{user.name || "朋友"}</h1>
          <p className="text-sm text-muted-foreground">今天继续看点什么？</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/library">
            <Library />
            打开片库
          </Link>
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="今年看完"
          value={summary.completedThisYear}
          hint="部作品 / 季"
          icon={CalendarCheck}
        />
        {(["WATCHING", "PLANNING", "ON_HOLD", "COMPLETED"] as const).map((status) => (
          <SummaryCard
            key={status}
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
            {watchingSeasons.map((item) => (
              <li key={item.seasonEntryId}>
                <div className="flex gap-3 rounded-lg border p-2.5">
                  <Link
                    href={`/media/${item.media.id}`}
                    className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded bg-muted"
                  >
                    <Poster
                      src={item.media.posterUrl}
                      alt={displayTitle(item.media)}
                      sizes="64px"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link href={`/media/${item.media.id}`} className="min-w-0">
                      <p className="truncate text-sm font-medium hover:underline">
                        {displayTitle(item.media)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatSeasonLabel(item.season.seasonNumber, item.season.title)}
                      </p>
                    </Link>
                    <Progress value={percent(item.progress, item.totalEpisodes)} />
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
            {watchingMovies.map((item) => (
              <li key={item.entryId} className="flex gap-3 rounded-lg border p-2.5">
                <Link
                  href={`/media/${item.media.id}`}
                  className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded bg-muted"
                >
                  <Poster src={item.media.posterUrl} alt={displayTitle(item.media)} sizes="64px" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                  <Link href={`/media/${item.media.id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium hover:underline">
                      {displayTitle(item.media)}
                    </p>
                  </Link>
                  <WatchCountBump entryId={item.entryId} watchCount={item.watchCount} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.works.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title="最近看完" />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {recent.works.map((item) => (
              <li key={item.entryId}>
                <MediaCard
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
            {recent.seasons.map((item) => (
              <li key={item.seasonEntryId} className="flex gap-3 rounded-lg border p-2.5">
                <Link
                  href={`/media/${item.media.id}`}
                  className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded bg-muted"
                >
                  <Poster src={item.media.posterUrl} alt={displayTitle(item.media)} sizes="56px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/media/${item.media.id}`} className="block min-w-0">
                    <p className="truncate text-sm font-medium hover:underline">
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
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="pt-2">
        <p className="text-xs text-muted-foreground">
          状态分布：
          {WATCH_STATUSES.map((s) => `${STATUS_LABEL[s]} ${summary.counts[s] ?? 0}`).join(" · ")}
        </p>
      </footer>
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
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof PlayCircle;
  href?: string;
}) {
  const body = (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground/60" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="transition-opacity hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}
