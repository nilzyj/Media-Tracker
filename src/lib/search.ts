import { searchAnilist } from "@/lib/anilist";
import { searchTmdb, isTmdbConfigured, UpstreamError } from "@/lib/tmdb";
import { errorMessage } from "@/lib/action-result";
import type { SearchItem } from "@/lib/tmdb";

export async function searchAll(
  query: string,
): Promise<{ tmdb: SearchItem[]; anilist: SearchItem[] }> {
  const [tmdb, anilist] = await Promise.all([
    isTmdbConfigured()
      ? searchTmdb(query).catch((error) => {
          if (error instanceof UpstreamError) return [] as SearchItem[];
          throw error;
        })
      : Promise.resolve([] as SearchItem[]),
    searchAnilist(query).catch(() => [] as SearchItem[]),
  ]);

  return { tmdb, anilist };
}

export { errorMessage };
