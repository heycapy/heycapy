import { Sprite } from "@/components/capy/Sprite";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { APP_TAGLINE } from "@/constants";

export const metadata: Metadata = {
  title: "heycapy",
  description: APP_TAGLINE,
};

const NAV_LINKS = [
  { label: "github", href: "https://github.com/heycapy/heycapy" },
  { label: "about", href: "/about" },
  { label: "how to use", href: "/how-to-use" },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3">
        <Sprite id="capy-idle-blink" size={96} bob />
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="font-pixel text-3xl tracking-wide">heycapy</h1>
          <p className="text-muted-foreground font-mono text-sm">{APP_TAGLINE}</p>
        </div>
      </div>

      <div className="border-border border-l-2 pl-4">
        <p className="text-muted-foreground font-mono text-xs">
          buckets · deadlines · reminders · webhooks
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          telegram · ai · voice · self-hosted
        </p>
      </div>

      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-5">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-muted-foreground hover:text-foreground font-mono text-sm transition-colors"
            >
              <span className="opacity-50">[</span>
              {link.label}
              <span className="opacity-50">]</span>
            </a>
          ))}
        </div>

        <a
          href="https://app.heycapy.xyz"
          className="border-foreground text-foreground hover:bg-foreground hover:text-background flex items-center gap-2 border-2 px-6 py-3 font-mono text-sm transition-colors"
        >
          open app
          <ExternalLink size={13} />
        </a>
      </div>
    </main>
  );
}
