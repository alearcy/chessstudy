import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export default function ViewportSidebar({
  className,
  ...props
}: ComponentPropsWithoutRef<"aside">) {
  return (
    <aside
      className={cn(
        "flex min-h-0 min-w-0 flex-col xl:h-[calc(100dvh-13rem)] xl:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}
