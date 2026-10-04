import { buildExport } from "@/lib/export-data";
import { getUserId } from "@/lib/dal";
import { toCsv, csvFilename } from "@/lib/csv";

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return new Response("未登录", { status: 401 });

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const entries = await buildExport(userId);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    return new Response("﻿" + toCsv(entries), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename(stamp)}"`,
      },
    });
  }

  return new Response(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="media-tracker-${stamp}.json"`,
    },
  });
}
