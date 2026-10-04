"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bumpSeasonProgress, bumpWatchCount, updateEntry, updateSeasonEntry } from "@/actions/entries";
import { STATUS_LABEL, WATCH_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WatchStatus } from "@/generated/prisma/client";

type StatusSelectProps = {
  entryId: string;
  status: WatchStatus;
  size?: "sm" | "default";
  className?: string;
};

export function StatusSelect({ entryId, status, size = "default", className }: StatusSelectProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(next) => {
        startTransition(async () => {
          const result = await updateEntry({ entryId, status: next });
          if (!result.ok) toast.error(result.error);
        });
      }}
    >
      <SelectTrigger size={size} className={cn("min-w-24", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WATCH_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type SeasonStatusSelectProps = {
  seasonEntryId: string;
  status: WatchStatus;
  size?: "sm" | "default";
};

export function SeasonStatusSelect({ seasonEntryId, status, size = "sm" }: SeasonStatusSelectProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(next) => {
        startTransition(async () => {
          const result = await updateSeasonEntry({ seasonEntryId, status: next });
          if (!result.ok) toast.error(result.error);
        });
      }}
    >
      <SelectTrigger size={size} className="min-w-20">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WATCH_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type ProgressBumpProps = {
  seasonEntryId: string;
  progress: number;
  total: number | null;
  size?: "sm" | "default";
};

/** +/- control for the number of watched episodes within one season. */
export function ProgressBump({ seasonEntryId, progress, total, size = "sm" }: ProgressBumpProps) {
  const [pending, startTransition] = useTransition();
  const atMax = total != null && progress >= total;

  function bump(delta: number) {
    startTransition(async () => {
      const result = await bumpSeasonProgress(seasonEntryId, delta);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.reachedEnd && delta > 0) {
        toast.success("这一季已看完，已自动标记为「已看」");
      }
    });
  }

  const iconSize = size === "sm" ? "icon-sm" : "icon";

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size={iconSize}
        onClick={() => bump(-1)}
        disabled={pending || progress <= 0}
        aria-label="减少一集"
      >
        <Minus />
      </Button>
      <span className="min-w-16 text-center text-sm tabular-nums">
        {progress}
        <span className="text-muted-foreground">/{total ?? "?"}</span>
      </span>
      <Button
        type="button"
        variant="outline"
        size={iconSize}
        onClick={() => bump(1)}
        disabled={pending || atMax}
        aria-label="增加一集"
      >
        <Plus />
      </Button>
    </div>
  );
}

type WatchCountBumpProps = {
  entryId: string;
  watchCount: number;
  size?: "sm" | "default";
};

export function WatchCountBump({ entryId, watchCount, size = "sm" }: WatchCountBumpProps) {
  const [pending, startTransition] = useTransition();

  function bump(delta: number) {
    startTransition(async () => {
      const result = await bumpWatchCount(entryId, delta);
      if (!result.ok) toast.error(result.error);
    });
  }

  const iconSize = size === "sm" ? "icon-sm" : "icon";

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size={iconSize}
        onClick={() => bump(1)}
        disabled={pending}
        aria-label="增加一次观看"
      >
        <Plus />
      </Button>
      <span className="text-sm tabular-nums">已看 {watchCount} 次</span>
      <Button
        type="button"
        variant="outline"
        size={iconSize}
        onClick={() => bump(-1)}
        disabled={pending || watchCount <= 0}
        aria-label="减少一次观看"
      >
        <Minus />
      </Button>
    </div>
  );
}
