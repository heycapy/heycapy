import type { ReactNode } from "react";
import { LOOK } from "@/constants";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="gruvbox-dark-2"
      data-look={LOOK.original}
      className="bg-background text-foreground flex min-h-svh flex-col"
    >
      {children}
    </div>
  );
}
