import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Layers, Star, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { getStatsOverview, getStatsTopRated } from "@/lib/queries";
import {
  CompletionsByYearChart,
  GenrePieChart,
  ScoreHistogram,
  StatusBarChart,
} from "@/components/charts";
import { Poster } from "@/components/poster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { displayTitle, formatMinutesTotal } from "@/lib/format";
import { STATUS_LABEL, WATCH_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "统计" };

export default async function StatsPage() {
  const user = await requireUser();
  const [stats, topRated] = await Promise.all([
    getStatsOverview(user.id),
    getStatsTopRated(user.id, 10),
  ]);

  const labels = WATCH_STATUSES.map((s) => STATUS_LABEL[s]);
  const workCounts = WATCH_STATUSES.map((s) => stats.workCounts[s] ?? 0);
  const seasonCounts = WATCH_STATUSES.map((s) => stats.seasonCounts[s] ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">统计</h1>
        <p className="text-sm text-muted-foreground">
          看完数量同时计入整部作品与单个季；时长按电影观看次数与剧集已看集数估算。
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={TrendingUp}
          label="累计看完"
          value={`${stats.totalCompletedWorks + stats.totalCompletedSeasons}`}
          hint={`作品 ${stats.totalCompletedWorks} · 季 ${stats.totalCompletedSeasons}`}
        />
        <MetricCard
          icon={Clock}
          label="累计观看时长"
          value={formatMinutesTotal(stats.totalMinutes)}
          hint="按官方时长估算"
        />
        <MetricCard
          icon={Layers}
          label="已追踪季数"
          value={`${stats.seasonCounts.COMPLETED ?? 0}`}
          hint="季级已看完数量"
        />
        <MetricCard
          icon={Star}
          label="已评分"
          value={`${stats.scoreDistribution.reduce((sum, d) => sum + d.count, 0)}`}
          hint="作品评分 + 各季评分"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">每年看完数量</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletionsByYearChart data={stats.completionsByYear} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">题材分布</CardTitle>
          </CardHeader>
          <CardContent>
            <GenrePieChart data={stats.genres} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">评分分布</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreHistogram data={stats.scoreDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart
              workData={workCounts}
              seasonData={seasonCounts}
              labels={labels}
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">我的 Top 10</CardTitle>
        </CardHeader>
        <CardContent>
          {topRated.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              还没有评分，去作品详情页打个分吧。
            </p>
          ) : (
            <ol className="space-y-1.5">
              {topRated.map((row, index) => (
                <li key={row.id}>
                  <Link
                    href={`/media/${row.media.id}`}
                    className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded bg-muted">
                      <Poster
                        src={row.media.posterUrl}
                        alt={displayTitle(row.media)}
                        sizes="40px"
                      />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {displayTitle(row.media)}
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {row.score} 分
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
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
}
