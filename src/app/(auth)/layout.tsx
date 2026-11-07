import type { ReactNode } from "react";
import { LOOK } from "@/constants";
import { LookProvider } from "@/components/looks/LookProvider";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="gruvbox-dark-2"
      data-look={LOOK.original}
      className="bg-background text-foreground flex min-h-svh flex-col"
    >
      <LookProvider look={LOOK.original}>{children}</LookProvider>
    </div>
  );
}
