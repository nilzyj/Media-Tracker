"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { LayoutGrid, ListFilter, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KIND_LABEL, STATUS_LABEL, WATCH_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WorkKind } from "@/generated/prisma/client";

type Option = { id: string; name: string };

const TRIGGER_ACTIVE = "border-brand/50 bg-brand/8 text-foreground";

type LibraryFiltersProps = {
  tags: Option[];
  genres: Option[];
  total: number;
};

export function LibraryFilters({ tags, genres, total }: LibraryFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = {
    view: params.get("view") ?? "work",
    status: params.get("status") ?? "ALL",
    kind: params.get("kind") ?? "ALL",
    source: params.get("source") ?? "ALL",
    tagId: params.get("tagId") ?? "",
    genreId: params.get("genreId") ?? "",
    sort: params.get("sort") ?? "updated",
  };

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === "ALL") next.delete(key);
      else next.set(key, value);
      next.delete("page");
      startTransition(() => router.push(`/library?${next.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5">
          <Button
            type="button"
            variant={current.view === "work" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setParam("view", "work")}
          >
            <LayoutGrid />
            按作品
          </Button>
          <Button
            type="button"
            variant={current.view === "season" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setParam("view", "season")}
          >
            <Rows3 />
            按季
          </Button>
        </div>

        <span className="text-xs text-muted-foreground tabular-nums">
          {pending ? "筛选中…" : `共 ${total} 条`}
        </span>
      </div>

      {/* 已生效的筛选用品牌色标出，避免和未生效的控件混成一片 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={current.status} onValueChange={(v) => setParam("status", v)}>
          <SelectTrigger size="sm" className={cn("w-28", current.status !== "ALL" && TRIGGER_ACTIVE)}>
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            {WATCH_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={current.kind} onValueChange={(v) => setParam("kind", v)}>
          <SelectTrigger size="sm" className={cn("w-28", current.kind !== "ALL" && TRIGGER_ACTIVE)}>
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部类型</SelectItem>
            {(Object.keys(KIND_LABEL) as WorkKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={current.source} onValueChange={(v) => setParam("source", v)}>
          <SelectTrigger size="sm" className={cn("w-28", current.source !== "ALL" && TRIGGER_ACTIVE)}>
            <SelectValue placeholder="来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部来源</SelectItem>
            <SelectItem value="TMDB">TMDB</SelectItem>
            <SelectItem value="ANILIST">AniList</SelectItem>
            <SelectItem value="MANUAL">手动录入</SelectItem>
          </SelectContent>
        </Select>

        {tags.length > 0 && (
          <Select value={current.tagId} onValueChange={(v) => setParam("tagId", v)}>
            <SelectTrigger size="sm" className={cn("w-28", current.tagId && TRIGGER_ACTIVE)}>
              <SelectValue placeholder="标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部标签</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {genres.length > 0 && (
          <Select value={current.genreId} onValueChange={(v) => setParam("genreId", v)}>
            <SelectTrigger size="sm" className={cn("w-28", current.genreId && TRIGGER_ACTIVE)}>
              <SelectValue placeholder="题材" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部题材</SelectItem>
              {genres.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={current.sort} onValueChange={(v) => setParam("sort", v)}>
          <SelectTrigger size="sm" className={cn("w-28", current.sort !== "updated" && TRIGGER_ACTIVE)}>
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">最近更新</SelectItem>
            <SelectItem value="added">最近加入</SelectItem>
            <SelectItem value="title">标题</SelectItem>
            <SelectItem value="score">评分</SelectItem>
            <SelectItem value="year">年份</SelectItem>
          </SelectContent>
        </Select>

        {(current.status !== "ALL" ||
          current.kind !== "ALL" ||
          current.source !== "ALL" ||
          current.tagId ||
          current.genreId) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.push("/library", { scroll: false }))}
          >
            <ListFilter />
            清除筛选
          </Button>
        )}
      </div>
    </div>
  );
}
