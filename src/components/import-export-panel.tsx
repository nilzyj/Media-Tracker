"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importFromAnilist, previewImport, runImport, type ImportPreview } from "@/actions/import-export";
import { CSV_HEADERS } from "@/lib/csv";

export function ImportExportPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState("json");
  const [strategy, setStrategy] = useState("merge");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  function pickFile(next: File | null) {
    setFile(next);
    setPreview(null);
  }

  function doPreview() {
    if (!file) {
      toast.error("请先选择文件");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    formData.set("format", format);

    startTransition(async () => {
      const result = await previewImport(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPreview(result.data);
      if (result.data.entries === 0) toast.warning("没有解析到可导入的条目");
    });
  }

  function doImport() {
    if (!file) {
      toast.error("请先选择文件");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    formData.set("format", format);

    startTransition(async () => {
      const result = await runImport(formData, strategy as "merge" | "replace");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `导入完成：${result.data.works} 部作品，${result.data.seasons} 季记录` +
          (result.data.skipped ? `，${result.data.skipped} 条失败` : ""),
      );
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">导出备份</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          导出全部作品、每季状态与进度、评分、标签和备注。CSV 为每季一行，适合在表格里查看。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/api/export?format=json">
              <Download />
              导出 JSON
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/export?format=csv">
              <Download />
              导出 CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">导入数据</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          支持本站导出的 JSON / CSV，或其他工具导出的同结构 CSV。先预览再确认导入。
        </p>

        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="import-file">文件</Label>
              <Input
                id="import-file"
                ref={fileRef}
                type="file"
                accept={format === "csv" ? ".csv,text/csv" : ".json,application/json"}
                className="h-8 w-64 file:mr-2 file:border-0 file:bg-transparent file:text-sm"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-format">文件格式</Label>
              <Select
                value={format}
                onValueChange={(v) => {
                  setFormat(v);
                  setFile(null);
                  setPreview(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <SelectTrigger id="import-format" size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-strategy">冲突策略</Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger id="import-strategy" size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">合并（保留现有数据）</SelectItem>
                  <SelectItem value="replace">覆盖（用文件数据）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="button" variant="outline" onClick={doPreview} disabled={pending || !file}>
              {pending ? <Loader2 className="animate-spin" /> : <FileUp />}
              预览
            </Button>
      <Button type="button" onClick={doImport} disabled={pending || !file}>
        确认导入
      </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            单个文件上限 4 MB（受 Server Action 请求体限制）。导入会按{" "}
            <code>externalKey</code> 匹配已有作品：选择「合并」只补齐缺失的季，选择「覆盖」会用文件里的状态与进度。
          </p>


          {preview && (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertTitle>解析完成</AlertTitle>
              <AlertDescription className="space-y-1.5">
                <p>
                  {preview.entries} 部作品（其中电影 {preview.movies} 部），共 {preview.seasons}{" "}
                  条季记录。
                </p>
                {preview.sample.length > 0 && (
                  <ul className="text-xs">
                    {preview.sample.map((item, i) => (
                      <li key={i}>
                        · {item.title} — {item.source} / {item.kind} / {item.seasons} 季
                      </li>
                    ))}
                  </ul>
                )}
                {preview.warnings.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {preview.warnings.length} 条警告：{preview.warnings.slice(0, 3).join("；")}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">CSV 列说明</summary>
            <p className="mt-2 leading-relaxed">
              表头：
              {CSV_HEADERS.join(", ")}
              <br />
              每个 <code>externalKey</code> 代表一部作品；电影只有一行且季相关列为空。
            </p>
          </details>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">从 AniList 导入</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          把你已有的 AniList 番剧列表（含状态与进度）一次性导入。注意：AniList 的每一季是独立条目，
          导入后每季会成为独立作品，而不是合并成一部多季作品。
        </p>
        <AnilistImportForm />
      </div>
    </div>
  );
}

function AnilistImportForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await importFromAnilist({
        userName: String(formData.get("userName") ?? ""),
        includeScores: formData.get("includeScores") === "on",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`已导入 ${result.data.works} 部番剧，${result.data.seasons} 条进度记录`);
      if (result.data.truncated) {
        toast.warning(
          `列表共 ${result.data.total} 条，本次只处理了前 ${result.data.works} 条以避免请求超时。再点一次「开始导入」可继续，已导入的会被跳过。`,
          { duration: 9000 },
        );
      }
      router.refresh();
    });
  }

  return (
    <form action={submit} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="anilist-user">AniList 用户名</Label>
        <Input
          id="anilist-user"
          name="userName"
          placeholder="例如 your_anilist_name"
          className="h-8 w-52"
          required
        />
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" name="includeScores" defaultChecked className="size-3.5" />
        同时导入评分
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "导入中…" : "开始导入"}
      </Button>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <AlertCircle className="size-3" />
        AniList 公共 API 限流较严，导入大量条目可能需要几分钟。
      </p>
    </form>
  );
}
