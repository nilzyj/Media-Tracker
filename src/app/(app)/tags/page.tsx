import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { getUserTags } from "@/lib/queries";
import { TagManager } from "@/components/tag-manager";

export const metadata: Metadata = { title: "标签" };

export default async function TagsPage() {
  const user = await requireUser();
  const tags = await getUserTags(user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">标签</h1>
        <p className="text-sm text-muted-foreground">
          标签作用于整部作品（不区分季），点击标签可跳转到对应的片库筛选结果。
        </p>
      </header>

      <TagManager
        tags={tags.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          entryCount: t._count.entries,
        }))}
      />
    </div>
  );
}
