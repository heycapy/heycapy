import { Sprite } from "@/components/capy/Sprite";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "heycapy",
  description: "a capy to help you with your day.",
};

const NAV_LINKS = [
  { label: "github", href: "https://github.com/heycapy/heycapy" },
  { label: "about", href: "/about" },
  { label: "how to use", href: "/how-to-use" },
];

export default function HomePage() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3">
        <Sprite id="capy-idle-blink" size={72} bob />
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-pixel text-2xl tracking-wide">heycapy</h1>
          <p className="text-muted-foreground font-mono text-xs">
            a capy to help you with your day.
          </p>
        </div>
      </div>

      <div className="border-border border-l-2 pl-4">
        <p className="text-muted-foreground font-mono text-[11px]">
          buckets · deadlines · reminders · webhooks
        </p>
        <p className="text-muted-foreground font-mono text-[11px]">
          telegram · ai · voice · self-hosted
        </p>
      </div>

      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
            >
              <span className="opacity-50">[</span>
              {link.label}
              <span className="opacity-50">]</span>
            </a>
          ))}
        </div>

        <a
          href="https://app.heycapy.xyz"
          className="border-foreground text-foreground hover:bg-foreground hover:text-background flex items-center gap-2 border-2 px-5 py-2.5 font-mono text-xs transition-colors"
        >
          open app
          <ExternalLink size={11} />
        </a>
      </div>
    </main>
  );
}
