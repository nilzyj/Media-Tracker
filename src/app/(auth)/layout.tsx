import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
            观
          </span>
          <span className="text-lg font-semibold">观影志</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
