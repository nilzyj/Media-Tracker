import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASS, STATUS_DOT_CLASS, STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WatchStatus } from "@/generated/prisma/client";

type StatusBadgeProps = {
  status: WatchStatus;
  className?: string;
  /** 「在看」带呼吸光晕，用于首页这类需要一眼看到的位置 */
  glow?: boolean;
  showDot?: boolean;
};

export function StatusBadge({ status, className, glow, showDot = true }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 transition-shadow",
        STATUS_BADGE_CLASS[status],
        glow && status === "WATCHING" && "animate-pulse-ring",
        className,
      )}
    >
      {showDot && <span className={cn("size-1.5 rounded-full", STATUS_DOT_CLASS[status])} />}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
