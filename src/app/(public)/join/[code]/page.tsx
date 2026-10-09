import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { Sprite } from "@/components/capy/Sprite";
import { ConfirmJoin } from "./ConfirmJoin";

export const metadata: Metadata = {
  title: "join a bucket | heycapy",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Opening the link changes nothing, so a link preview can't use up the code; joining is the button
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getSession();
  const loginHref = `/login?next=${encodeURIComponent(`/join/${code}`)}`;

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <Sprite id="capy-idle-blink" size={96} />
          <h1 className="font-pixel text-sm">heycapy</h1>
        </div>
        <p className="font-mono text-xs">someone invited you to share a bucket</p>
        {session ? (
          <ConfirmJoin code={code} />
        ) : (
          <a href={loginHref} className="text-foreground font-mono text-sm">
            <span className="opacity-50">[</span>sign in to join
            <span className="opacity-50">]</span>
          </a>
        )}
      </div>
    </main>
  );
}
