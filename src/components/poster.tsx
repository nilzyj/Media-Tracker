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

export function Poster({ src, alt, className, sizes = "(max-width: 640px) 40vw, 200px", priority }: PosterProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-muted text-muted-foreground/40",
          className,
        )}
      >
        <Film className="size-1/3" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
    />
  );
}
