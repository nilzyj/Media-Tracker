"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Heart, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateEntry, syncEntryStatusFromSeasons } from "@/actions/entries";
import { deleteMedia, refreshMediaMetadata } from "@/actions/media";
import { STATUS_LABEL } from "@/lib/constants";

export function FavoriteToggle({ entryId, initial }: { entryId: string; initial: boolean }) {
  const [favorite, setFavorite] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={favorite ? "default" : "outline"}
      size="sm"
      disabled={pending}
      aria-pressed={favorite}
      onClick={() => {
        const next = !favorite;
        setFavorite(next);
        startTransition(async () => {
          const result = await updateEntry({ entryId, isFavorite: next });
          if (!result.ok) {
            setFavorite(!next);
            toast.error(result.error);
          }
        });
      }}
    >
      <Heart className={favorite ? "fill-current" : undefined} />
      {favorite ? "已收藏" : "收藏"}
    </Button>
  );
}

export function NotesEditor({ entryId, initial }: { entryId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateEntry({ entryId, notes: value });
      if (!result.ok) toast.error(result.error);
      else {
        setDirty(false);
        toast.success("备注已保存");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        placeholder="写点观后感、备注或者待办…"
        rows={4}
        className="resize-y"
      />
      {dirty && (
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          {pending ? "保存中…" : "保存备注"}
        </Button>
      )}
    </div>
  );
}

export function SyncStatusButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncEntryStatusFromSeasons(entryId);
          if (!result.ok) toast.error(result.error);
          else toast.success(`整体状态已按各季汇总为「${STATUS_LABEL[result.data.status]}」`);
        })
      }
    >
      <Wand2 />
      {pending ? "汇总中…" : "按季状态汇总"}
    </Button>
  );
}

export function RefreshMetadataButton({ mediaId }: { mediaId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await refreshMediaMetadata(mediaId);
          if (!result.ok) toast.error(result.error);
          else toast.success("已刷新元数据");
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {pending ? "刷新中…" : "刷新元数据"}
    </Button>
  );
}

export function DeleteEntryButton({
  mediaId,
  title,
}: {
  mediaId: string;
  title: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteMedia(mediaId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`已从片库移除《${title}》`);
      router.push("/library");
    });
  }

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 />
        移出片库
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1">
      <span className="text-xs text-destructive">确认移除《{title}》及其全部季记录？</span>
      <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={pending}>
        {pending ? "移除中…" : "确认"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        取消
      </Button>
    </div>
  );
}
