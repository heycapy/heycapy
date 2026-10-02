import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="gruvbox-dark-2"
      className="bg-background text-foreground flex min-h-svh flex-col"
    >
      {children}
    </div>
  );
}
