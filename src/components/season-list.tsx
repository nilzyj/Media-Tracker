"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressBump, SeasonStatusSelect } from "@/components/entry-controls";
import { joinSeason, leaveSeason, markAllSeasonsWatched, setSeasonProgress, updateSeasonEntry } from "@/actions/entries";
import { formatSeasonLabel, percent } from "@/lib/format";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/constants";
import type { WatchStatus } from "@/generated/prisma/client";

export type SeasonRow = {
  id: string;
  seasonNumber: number;
  title: string | null;
  totalEpisodes: number | null;
  airedDate: Date | null;
  tracked: {
    id: string;
    status: WatchStatus;
    progress: number;
    totalEpisodes: number | null;
    score: number | null;
  } | null;
};

type SeasonListProps = {
  entryId: string;
  seasons: SeasonRow[];
};

export function SeasonList({ entryId, seasons }: SeasonListProps) {
  const [pending, startTransition] = useTransition();

  function markAll() {
    startTransition(async () => {
      const result = await markAllSeasonsWatched(entryId);
      if (!result.ok) toast.error(result.error);
      else toast.success("已把所有季标记为已看");
    });
  }

  if (seasons.length === 0) {
    return <p className="text-sm text-muted-foreground">该作品没有季信息。</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          共 {seasons.length} 季 · 状态与进度按季独立记录
        </p>
        <Button type="button" variant="outline" size="sm" onClick={markAll} disabled={pending}>
          <CheckCheck />
          全部标记已看
        </Button>
      </div>

      <ul className="space-y-2">
        {seasons.map((season) => (
          <SeasonItem key={season.id} entryId={entryId} season={season} />
        ))}
      </ul>
    </div>
  );
}

function SeasonItem({ entryId, season }: { entryId: string; season: SeasonRow }) {
  const [pending, startTransition] = useTransition();
  const [scoreInput, setScoreInput] = useState<string | null>(null);

  const tracked = season.tracked;
  const total = tracked?.totalEpisodes ?? season.totalEpisodes;

  if (!tracked) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2.5 opacity-70">
        <div className="min-w-0">
          <p className="text-sm font-medium">{formatSeasonLabel(season.seasonNumber, season.title)}</p>
          <p className="text-xs text-muted-foreground">
            {season.totalEpisodes ? `${season.totalEpisodes} 集` : "集数未知"} · 未追踪
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await joinSeason(entryId, season.id);
              if (!result.ok) toast.error(result.error);
              else toast.success(`已加入${formatSeasonLabel(season.seasonNumber, season.title)}`);
            })
          }
        >
          <Plus />
          加入追踪
        </Button>
      </li>
    );
  }

  return (
    <li className="rounded-lg border px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              {formatSeasonLabel(season.seasonNumber, season.title)}
            </p>
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[11px] ${STATUS_BADGE_CLASS[tracked.status]}`}
            >
              {STATUS_LABEL[tracked.status]}
            </span>
            {pending && <span className="text-[11px] text-muted-foreground">保存中…</span>}
          </div>

          {total ? (
            <div className="mt-1.5 flex items-center gap-2">
              <Progress value={percent(tracked.progress, total)} className="w-32" />
              <span className="text-xs text-muted-foreground tabular-nums">
                {tracked.progress}/{total} 集
              </span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              集数未知，可直接在右侧输入已看集数
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SeasonStatusSelect seasonEntryId={tracked.id} status={tracked.status} />

          {total ? (
            <ProgressBump
              seasonEntryId={tracked.id}
              progress={tracked.progress}
              total={total}
            />
          ) : (
            <Input
              type="number"
              min={0}
              defaultValue={tracked.progress}
              className="h-7 w-20"
              aria-label="已看集数"
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && value !== tracked.progress) {
                  startTransition(async () => {
                    const result = await setSeasonProgress(tracked.id, value);
                    if (!result.ok) toast.error(result.error);
                  });
                }
              }}
            />
          )}

          <SeasonScoreInput
            seasonEntryId={tracked.id}
            score={tracked.score}
            input={scoreInput}
            setInput={setScoreInput}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="移除该季追踪"
                onClick={() =>
                  startTransition(async () => {
                    const result = await leaveSeason(tracked.id);
                    if (!result.ok) toast.error(result.error);
                    else toast.success("已移除该季追踪");
                  })
                }
              >
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>移除该季追踪</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </li>
  );
}

function SeasonScoreInput({
  seasonEntryId,
  score,
  input,
  setInput,
}: {
  seasonEntryId: string;
  score: number | null;
  input: string | null;
  setInput: (v: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  function commit(value: string) {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) && parsed > 0 ? Math.min(10, Math.round(parsed)) : null;
    setInput(null);
    if (next === score) return;
    startTransition(async () => {
      const result = await updateSeasonEntry({ seasonEntryId, score: next ?? 0 });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center">
      {input === null ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 tabular-nums"
          onClick={() => setInput(score ? String(score) : "")}
          disabled={pending}
        >
          <Star className={score ? "size-3.5 fill-current" : "size-3.5"} />
          {score ?? "评分"}
        </Button>
      ) : (
        <Input
          autoFocus
          type="number"
          min={0}
          max={10}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
            if (e.key === "Escape") setInput(null);
          }}
          className="h-7 w-16"
          aria-label="本季评分 1-10"
        />
      )}
    </div>
  );
}
