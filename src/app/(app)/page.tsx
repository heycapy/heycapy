import { Sprite } from "@/components/capy/Sprite";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Sprite id="capy-mascot" size={96} />
      <p className="text-muted-foreground text-sm">Buckets coming soon.</p>
    </div>
  );
}
