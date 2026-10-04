import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ImportExportPanel } from "@/components/import-export-panel";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "导入导出" };

export default function ImportExportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/settings">
          <ChevronLeft />
          返回设置
        </Link>
      </Button>

      <header>
        <h1 className="text-xl font-semibold">导入导出</h1>
        <p className="text-sm text-muted-foreground">
          换设备、换数据库或迁移到其他追踪工具时使用。
        </p>
      </header>

      <ImportExportPanel />
    </div>
  );
}
