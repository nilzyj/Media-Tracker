import type { Metadata } from "next";
import { searchAll } from "@/lib/search";
import { isTmdbConfigured } from "@/lib/tmdb";
import { SearchClient } from "@/components/search-client";

export const metadata: Metadata = { title: "搜索" };

export default async function SearchPage(props: PageProps<"/search">) {
  const params = await props.searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  let results: Awaited<ReturnType<typeof searchAll>> | null = null;
  if (query) {
    try {
      results = await searchAll(query);
    } catch {
      results = null;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">搜索</h1>
        <p className="text-sm text-muted-foreground">
          电影与电视剧来自 TMDB，番剧来自 AniList；番剧的每一季会被自动合并成一个作品。
        </p>
      </header>

      <SearchClient
        tmdbEnabled={isTmdbConfigured()}
        initialQuery={query}
        initialResults={results ? [...results.tmdb, ...results.anilist] : []}
      />
    </div>
  );
}
