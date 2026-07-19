import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type BrandLogoProps = Omit<
  ComponentProps<"img">,
  "alt" | "height" | "src" | "width"
>;

export default function BrandLogo({ className, ...props }: BrandLogoProps) {
  return (
    <img
      src="/chessstudy.svg"
      alt="Chess Study"
      width={1679}
      height={342}
      className={cn("block h-auto", className)}
      draggable={false}
      {...props}
    />
  );
}
