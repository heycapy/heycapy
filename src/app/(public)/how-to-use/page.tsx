"use client";

import { useState } from "react";
import Link from "next/link";
import { FEATURES, type Feature } from "./features";

function FeatureDialog({ feature, onClose }: { feature: Feature; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="border-border bg-background relative z-10 flex w-full max-w-sm flex-col border-2"
        style={{ boxShadow: "4px 4px 0 var(--border)" }}
      >
        <div className="bg-foreground text-background flex items-center justify-between px-3 py-2">
          <span className="font-pixel text-xs">{feature.title}</span>
          <button
            onClick={onClose}
            className="font-mono text-xs opacity-60 transition-opacity hover:opacity-100"
          >
            <span className="opacity-50">[</span>x<span className="opacity-50">]</span>
          </button>
        </div>

        <div className="border-border border-b px-3 py-1.5">
          <span className="text-muted-foreground font-mono text-[9px]">find it: </span>
          <span className="font-mono text-[9px]">{feature.where}</span>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-2.5 overflow-y-auto p-4">
          {feature.detail.map((item, i) => {
            if (item.type === "code") {
              return (
                <pre
                  key={i}
                  className="border-border bg-card border p-2.5 font-mono text-[9px] leading-relaxed break-all whitespace-pre-wrap"
                >
                  {item.text}
                </pre>
              );
            }
            if (item.type === "step") {
              return (
                <div key={i} className="flex gap-2.5">
                  <span className="text-muted-foreground/50 mt-[3px] shrink-0 font-mono text-[9px]">
                    ▸
                  </span>
                  <p className="text-muted-foreground font-mono text-[11px] leading-relaxed">
                    {item.text}
                  </p>
                </div>
              );
            }
            if (item.type === "tip") {
              return (
                <div key={i} className="border-border bg-card border-l-2 py-1.5 pr-2 pl-3">
                  <p className="text-muted-foreground font-mono text-[10px] leading-relaxed">
                    {item.text}
                  </p>
                </div>
              );
            }
            return (
              <p key={i} className="font-mono text-[11px] leading-relaxed">
                {item.text}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function HowToUsePage() {
  const [active, setActive] = useState<Feature | null>(null);

  return (
    <main className="flex flex-1 flex-col items-center p-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-pixel text-sm">how to use</h1>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>back<span className="opacity-50">]</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="border-border flex flex-col gap-2 border p-3">
              <p className="font-pixel text-[11px]">{f.title}</p>
              <p className="text-muted-foreground flex-1 font-mono text-[10px] leading-relaxed">
                {f.desc}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setActive(f)}
                  className="text-muted-foreground hover:text-foreground font-mono text-[10px] transition-colors"
                >
                  <span className="opacity-50">[</span>more<span className="opacity-50">]</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-border mt-8 flex gap-4 border-t pt-5">
          <a
            href="https://github.com/heycapy/heycapy"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>github<span className="opacity-50">]</span>
          </a>
          <Link
            href="/about"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>about<span className="opacity-50">]</span>
          </Link>
          <a
            href="https://app.heycapy.xyz"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>open app<span className="opacity-50">]</span>
          </a>
        </div>
      </div>

      {active && <FeatureDialog feature={active} onClose={() => setActive(null)} />}
    </main>
  );
}
