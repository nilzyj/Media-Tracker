"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateEntry } from "@/actions/entries";
import { cn } from "@/lib/utils";

type ScorePickerProps = {
  entryId: string;
  score: number | null;
};

export function ScorePicker({ entryId, score }: ScorePickerProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = hover ?? score ?? 0;

  function commit(value: number) {
    startTransition(async () => {
      const result = await updateEntry({ entryId, score: value === 0 ? 0 : value });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHover(null)}
      role="group"
      aria-label="作品评分 1-10"
    >
      {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
        <button
          key={value}
          type="button"
          disabled={pending}
          onMouseEnter={() => setHover(value)}
          onClick={() => commit(value)}
          aria-label={`评 ${value} 分`}
          className="p-0.5 transition-transform hover:scale-110 disabled:opacity-60"
        >
          <Star
            className={cn(
              "size-4 transition-colors",
              value <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
      {score != null && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="ml-1 text-muted-foreground"
          onClick={() => commit(0)}
          disabled={pending}
        >
          清除
        </Button>
      )}
    </div>
  );
}
