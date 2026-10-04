"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Compass, Home, Library, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "首页", icon: Home },
  { href: "/library", label: "片库", icon: Library },
  { href: "/search", label: "搜索", icon: Compass },
  { href: "/stats", label: "统计", icon: BarChart3 },
  { href: "/tags", label: "标签", icon: Tags },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200",
              active
                ? "bg-brand-gradient font-medium text-white shadow-[0_10px_24px_-14px_var(--brand)]"
                : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
            )}
          >
            <item.icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
