"use client";

import { useState } from "react";
import Image from "next/image";
import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

type PosterProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/**
 * 海报。加载完成前显示品牌色渐变底 + 微光扫过，避免出现灰白方块；
 * 加载完成后淡入并轻微放大归位。
 */
export function Poster({ src, alt, className, sizes = "(max-width: 640px) 40vw, 200px", priority }: PosterProps) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div className={cn("grid place-items-center bg-muted text-muted-foreground/40", className)}>
        <Film className="size-1/3" />
      </div>
    );
  }

  return (
    <>
      {/* 底图：加载中可见，海报淡入后隐藏 */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 skeleton-shimmer transition-opacity duration-500",
          loaded ? "opacity-0" : "opacity-100",
        )}
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={() => setLoaded(true)}
        className={cn(
          "object-cover transition-[opacity,transform] duration-700 ease-out",
          loaded ? "scale-100 opacity-100" : "scale-105 opacity-0",
          className,
        )}
      />
    </>
  );
}
