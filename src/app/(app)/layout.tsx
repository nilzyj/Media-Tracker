import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/dal";
import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { TmdbAttribution } from "@/components/tmdb-attribution";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="shrink-0 border-b bg-sidebar/70 backdrop-blur-xl lg:w-60 lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-4 p-4 lg:sticky lg:top-0 lg:h-screen">
          <Link href="/" className="group flex items-center gap-2.5 px-1 py-1">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-sm font-bold text-white shadow-[0_12px_28px_-14px_var(--brand)] transition-transform duration-300 group-hover:scale-105">
              观
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold">观影志</p>
              <p className="truncate text-xs text-muted-foreground">{user.name || user.email}</p>
            </div>
          </Link>

          <AppNav />

          <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
            <ThemeToggle />
            <div className="flex items-center gap-1">
              <Link
                href="/settings"
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground"
                aria-label="设置"
              >
                <Settings className="size-4" />
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="grid size-8 place-items-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground"
                  aria-label="退出登录"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </div>

          <TmdbAttribution />
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
