"use client";

import { useRouter } from "next/navigation";
import { APP_NAME } from "@/constants";
import { Sprite } from "@/components/capy/Sprite";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <Sprite id="capy-mascot" size={96} />
      <h1 className="font-pixel text-xl">{APP_NAME}</h1>
      <p className="text-muted-foreground text-sm">You&apos;re in. Buckets coming soon.</p>
      <Button variant="ghost" className="w-auto px-6" onClick={handleLogout}>
        Log out
      </Button>
    </main>
  );
}
