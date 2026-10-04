import { NextResponse } from "next/server";
import { getUserId } from "@/lib/dal";
import { searchAll } from "@/lib/search";
import { errorMessage } from "@/lib/action-result";

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ error: "缺少搜索关键词" }, { status: 400 });

  try {
    const { tmdb, anilist } = await searchAll(query);
    return NextResponse.json({ results: [...tmdb, ...anilist] });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 });
  }
}
