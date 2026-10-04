"use client";

import { cn } from "@/lib/utils";

type Variant = "brand" | "primary" | "light";

type AnimatedProgressProps = {
  /** 0-100 */
  value: number;
  className?: string;
  variant?: Variant;
  /** 品牌渐变带流动条纹 */
  animated?: boolean;
  label?: string;
};

/**
 * 进度条。自己实现而不用 Radix 的 Progress，是为了让填充层可以用渐变和
 * background-position 动画（Radix 内部用 transform 做位移，二者会打架）。
 * 语义上仍保留 role="progressbar"。
 */
export function AnimatedProgress({
  value,
  className,
  variant = "primary",
  animated = false,
  label,
}: AnimatedProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));

  const fill = {
    brand: "bg-brand-gradient shadow-[0_0_14px_-3px_var(--brand)]",
    primary: "bg-primary",
    light: "bg-white",
  }[variant];

  const flow =
    animated && variant !== "light"
      ? "animate-[flow_1.2s_linear_infinite] bg-[length:28px_100%]"
      : "";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-hidden rounded-full",
        variant === "light" ? "bg-white/25" : "bg-muted",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fill, flow)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
