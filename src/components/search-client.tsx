"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Check, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { Poster } from "@/components/poster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addMediaToLibrary, createManualMedia, probeMedia } from "@/actions/media";
import { AUTHOR_KINDS, KIND_LABEL, SEASONAL_KINDS } from "@/lib/constants";
import type { MediaPreview } from "@/actions/media";
import type { WorkKind } from "@/generated/prisma/client";

export type SearchItemView = {
  source: "TMDB" | "ANILIST";
  externalKey: string;
  kind: WorkKind;
  title: string;
  subtitle: string | null;
  overview: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
  genres: { slug: string; name: string }[];
  siteUrl: string;
  extra: string | null;
};

export function SearchClient({
  tmdbEnabled,
  initialResults,
  initialQuery,
}: {
  tmdbEnabled: boolean;
  initialResults: SearchItemView[];
  initialQuery: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchItemView[]>(initialResults);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ item: SearchItemView; data: MediaPreview } | null>(null);
  const [adding, startAdd] = useTransition();

  async function runSearch(term: string) {
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "搜索失败");
        setResults([]);
      } else {
        setResults(payload.results ?? []);
      }
    } catch {
      setError("搜索请求失败，请检查网络或稍后再试");
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(item: SearchItemView) {
    const result = await probeMedia(item.source, item.externalKey, item.kind);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (result.data.seasonCount > 1) {
      setPreview({ item, data: result.data });
      return;
    }
    commitAdd(item);
  }

  function commitAdd(item: SearchItemView) {
    startAdd(async () => {
      const result = await addMediaToLibrary(item.source, item.externalKey, item.kind);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { seasonCount, title } = result.data;
      toast.success(
        seasonCount > 1
          ? `已加入《${title}》，共识别 ${seasonCount} 季`
          : `已加入《${title}》`,
      );
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const term = query.trim();
          if (!term) return;
          router.push(`/search?q=${encodeURIComponent(term)}`, { scroll: false });
          void runSearch(term);
        }}
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索电影、电视剧或番剧…"
          className="h-9"
        />
        <Button type="submit" disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="animate-spin" /> : <Search />}
          搜索
        </Button>
      </form>

      {!tmdbEnabled && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          未配置 TMDB_API_READ_TOKEN，目前只能搜索 AniList 番剧。电影与电视剧请使用「手动录入」，或到{" "}
          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            TMDB
          </a>{" "}
          申请免费 API 凭证后填入 .env。
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {results.length > 0 && <SearchGrid results={results} onAdd={handleAdd} pending={adding} />}

      <ManualEntry />

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent>
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" />
                  识别到多季作品
                </DialogTitle>
                <DialogDescription>
                  《{preview.data.title}》被拆成了 {preview.data.seasonCount}{" "}
                  季（AniList 把每一季当作独立作品，这里已自动合并）。全部加入后可在详情页按季独立追踪状态与进度。
                </DialogDescription>
              </DialogHeader>

              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
                {preview.data.seasons.map((season) => (
                  <li key={season.seasonNumber} className="flex items-center justify-between text-sm">
                    <span>第 {season.seasonNumber} 季</span>
                    <span className="text-xs text-muted-foreground">
                      {season.totalEpisodes ? `${season.totalEpisodes} 集` : "集数未知"}
                      {season.title ? ` · ${season.title}` : ""}
                    </span>
                  </li>
                ))}
              </ul>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setPreview(null)}>
                  取消
                </Button>
                <Button type="button" onClick={() => commitAdd(preview.item)} disabled={adding}>
                  <Check />
                  全部加入（{preview.data.seasonCount} 季）
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SearchGrid({
  results,
  onAdd,
  pending,
}: {
  results: SearchItemView[];
  onAdd: (item: SearchItemView) => void;
  pending: boolean;
}) {
  const tmdb = results.filter((r) => r.source === "TMDB");
  const anilist = results.filter((r) => r.source === "ANILIST");

  return (
    <Tabs defaultValue={tmdb.length > 0 ? "tmdb" : "anilist"}>
      <TabsList>
        <TabsTrigger value="tmdb">TMDB{tmdb.length > 0 && ` (${tmdb.length})`}</TabsTrigger>
        <TabsTrigger value="anilist">AniList{anilist.length > 0 && ` (${anilist.length})`}</TabsTrigger>
      </TabsList>

      {(
        [
          ["tmdb", tmdb],
          ["anilist", anilist],
        ] as const
      ).map(([key, items]) => (
        <TabsContent key={key} value={key}>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">该来源没有结果</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <li key={`${item.source}-${item.externalKey}`} className="flex gap-3 rounded-lg border p-2.5">
                  <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded bg-muted">
                    <Poster src={item.posterUrl} alt={item.title} sizes="64px" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                    {item.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        {KIND_LABEL[item.kind]}
                      </Badge>
                      {item.releaseDate && <span>{item.releaseDate.slice(0, 4)}</span>}
                      {item.extra && <span className="truncate">{item.extra}</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onAdd(item)}
                        disabled={pending}
                      >
                        <Plus />
                        加入片库
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <a href={item.siteUrl} target="_blank" rel="noopener noreferrer">
                          详情
                        </a>
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ManualEntry() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<WorkKind>("TV");

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createManualMedia({
        title: String(formData.get("title") ?? ""),
        titleZh: String(formData.get("titleZh") ?? ""),
        overview: String(formData.get("overview") ?? ""),
        kind,
        posterUrl: String(formData.get("posterUrl") ?? ""),
        releaseDate: String(formData.get("releaseDate") ?? ""),
        runtimeMin: Number(formData.get("runtimeMin") || 0),
        author: String(formData.get("author") ?? ""),
        totalEpisodes: Number(formData.get("totalEpisodes") || 0),
        seasonCount: Number(formData.get("seasonCount") || 1),
        seasonEpisodes: Number(formData.get("seasonEpisodes") || 0),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("已加入片库");
      setOpen(false);
      router.push(`/media/${result.data.mediaId}`);
    });
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">手动录入</p>
          <p className="text-xs text-muted-foreground">
            数据库里没有的片子，或者不想配置 API Key 时使用。
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : "展开表单"}
        </Button>
      </div>

      {open && (
        <form action={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="title">标题 *</Label>
            <Input id="title" name="title" required placeholder="作品名称" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="titleZh">中文名</Label>
            <Input id="titleZh" name="titleZh" placeholder="选填，留空则使用标题" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kind">类型</Label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as WorkKind)}
              className="h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
            >
              {(Object.keys(KIND_LABEL) as WorkKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="posterUrl">海报链接</Label>
            <Input id="posterUrl" name="posterUrl" type="url" placeholder="https://…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="releaseDate">首播日期</Label>
            <Input id="releaseDate" name="releaseDate" type="date" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="runtimeMin">时长（分钟）</Label>
            <Input
              id="runtimeMin"
              name="runtimeMin"
              type="number"
              min={0}
              placeholder="电影填总时长，剧集填单集时长"
            />
          </div>

          {SEASONAL_KINDS.includes(kind) ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="seasonCount">季数</Label>
                <Input
                  id="seasonCount"
                  name="seasonCount"
                  type="number"
                  min={1}
                  defaultValue={1}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="seasonEpisodes">每季集数</Label>
                <Input
                  id="seasonEpisodes"
                  name="seasonEpisodes"
                  type="number"
                  min={0}
                  placeholder="选填，之后也可以单独调整每一季"
                />
              </div>
            </>
          ) : (
            <>
              {AUTHOR_KINDS.includes(kind) && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="author">{kind === "PODCAST" ? "主播" : "作者"}</Label>
                  <Input id="author" name="author" placeholder="选填" />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="totalEpisodes">
                  总集数{kind === "BOOK" ? "（页数）" : kind === "MANGA" ? "（话数）" : ""}
                </Label>
                <Input
                  id="totalEpisodes"
                  name="totalEpisodes"
                  type="number"
                  min={0}
                  placeholder="选填，之后也可以单独调整"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="overview">简介</Label>
            <textarea
              id="overview"
              name="overview"
              rows={3}
              className="w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "添加中…" : "添加到片库"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
