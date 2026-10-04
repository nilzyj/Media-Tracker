import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/constants";
import type { WatchStatus } from "@/generated/prisma/client";

export function StatusBadge({ status, className }: { status: WatchStatus; className?: string }) {
  return (
    <Badge variant="outline" className={className ?? STATUS_BADGE_CLASS[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
