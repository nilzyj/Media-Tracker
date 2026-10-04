"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      aria-label="切换主题"
      title="切换主题"
    >
      {/* 两个图标都由 CSS 决定显隐：resolvedTheme 在 SSR 期间为 undefined，
          若用它做条件渲染，服务端与客户端输出不一致会触发 hydration 不匹配。 */}
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  );
}