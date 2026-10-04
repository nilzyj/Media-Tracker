"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTag, deleteTag, updateTag } from "@/actions/tags";

type TagView = {
  id: string;
  name: string;
  color: string | null;
  entryCount: number;
};

export function TagManager({ tags }: { tags: TagView[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#64748b");
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submitCreate() {
    startTransition(async () => {
      const result = await createTag({ name, color });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      toast.success("标签已创建");
      router.refresh();
    });
  }

  function submitUpdate() {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateTag(editing.id, { name: editing.name, color: editing.color });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(null);
      toast.success("标签已更新");
      router.refresh();
    });
  }

  function remove(tag: TagView) {
    startTransition(async () => {
      const result = await deleteTag(tag.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(`已删除标签「${tag.name}」`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <div className="space-y-1.5">
          <label htmlFor="new-tag" className="text-xs text-muted-foreground">
            标签名
          </label>
          <Input
            id="new-tag"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) submitCreate();
            }}
            placeholder="例如：科幻、周末补番"
            className="h-8 w-48"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="new-tag-color" className="text-xs text-muted-foreground">
            颜色
          </label>
          <input
            id="new-tag-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-14 cursor-pointer rounded border bg-transparent p-0.5"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={submitCreate}
          disabled={pending || !name.trim()}
        >
          <Plus />
          创建标签
        </Button>
      </div>

      {tags.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          还没有标签。标签可以在作品详情页直接添加，也可以在这里预先创建。
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) =>
            editing?.id === tag.id ? (
              <li key={tag.id} className="flex items-center gap-2 rounded-lg border p-2">
                <input
                  type="color"
                  value={editing.color}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  className="h-7 w-9 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                  aria-label="标签颜色"
                />
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitUpdate();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="h-7"
                />
                <Button type="button" size="sm" onClick={submitUpdate} disabled={pending}>
                  保存
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(null)}
                >
                  取消
                </Button>
              </li>
            ) : (
              <li
                key={tag.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-2"
              >
                <Link href={`/library?tagId=${tag.id}`} className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-full border"
                    style={tag.color ? { background: tag.color, borderColor: tag.color } : undefined}
                  />
                  <span className="truncate text-sm">{tag.name}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {tag.entryCount}
                  </Badge>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`编辑标签 ${tag.name}`}
                    onClick={() =>
                      setEditing({ id: tag.id, name: tag.name, color: tag.color ?? "#64748b" })
                    }
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`删除标签 ${tag.name}`}
                    onClick={() => remove(tag)}
                    disabled={pending}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
