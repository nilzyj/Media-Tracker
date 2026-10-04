"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setEntryTags } from "@/actions/entries";

type TagEditorProps = {
  entryId: string;
  initialTags: { id: string; name: string; color: string | null }[];
};

export function TagEditor({ entryId, initialTags }: TagEditorProps) {
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function persist(next: { id: string; name: string; color: string | null }[]) {
    setTags(next);
    startTransition(async () => {
      const result = await setEntryTags(entryId, next.map((t) => t.name));
      if (!result.ok) toast.error(result.error);
    });
  }

  function add() {
    const name = draft.trim();
    if (!name) return;
    if (tags.some((t) => t.name === name)) {
      setDraft("");
      return;
    }
    // The row id is only used as a React key until the server responds.
    persist([...tags, { id: `pending-${name}`, name, color: null }]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
            {tag.name}
            <button
              type="button"
              className="grid size-4 place-items-center rounded-full hover:bg-background/60"
              aria-label={`移除标签 ${tag.name}`}
              disabled={pending}
              onClick={() => persist(tags.filter((t) => t.name !== tag.name))}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {tags.length === 0 && <span className="text-sm text-muted-foreground">还没有标签</span>}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="添加标签，回车确认"
          className="h-8 max-w-48"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={pending || !draft.trim()}>
          <Plus />
          添加
        </Button>
      </div>
    </div>
  );
}
