import Link from "next/link";
import { Clapperboard } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      {/* 影院感光晕 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-ambient" />
        <div className="absolute -left-32 -top-32 size-[32rem] rounded-full bg-brand/14 blur-3xl animate-drift" />
        <div className="absolute -bottom-32 -right-24 size-[28rem] rounded-full bg-brand-soft/14 blur-3xl animate-drift [animation-delay:-9s]" />
      </div>

      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="animate-fade-up group mb-7 flex items-center justify-center gap-2.5"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-[0_16px_36px_-16px_var(--brand)] transition-transform duration-300 group-hover:scale-105">
            <Clapperboard className="size-5" />
          </span>
          <span className="bg-brand-gradient bg-clip-text text-xl font-semibold text-transparent">
            观影志
          </span>
        </Link>

        <div className="animate-scale-in [animation-delay:100ms] [&>div]:border-brand/20 [&>div]:bg-card/70 [&>div]:shadow-[0_24px_60px_-30px_var(--brand)] [&>div]:backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
