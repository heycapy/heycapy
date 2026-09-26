export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="gruvbox" className="bg-background text-foreground min-h-full">
      {children}
    </div>
  );
}
