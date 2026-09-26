export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="gruvbox" className="bg-background text-foreground flex min-h-svh flex-col">
      {children}
    </div>
  );
}
