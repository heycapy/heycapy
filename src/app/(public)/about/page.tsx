import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: "about | heycapy",
};

export default function AboutPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-pixel text-sm">about</h1>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>back<span className="opacity-50">]</span>
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          <p className="text-muted-foreground font-mono text-[11px] leading-relaxed">
            heycapy is a self-hosted organiser built around buckets. lists for tasks, deadlines, and
            reminders. connect it to telegram, set up webhooks, use your own ai provider. runs on
            docker.
          </p>

          <div className="border-border border p-4">
            <p className="font-pixel mb-3 text-[11px]">hosted version</p>
            <p className="text-muted-foreground font-mono text-[11px] leading-relaxed">
              you&apos;re on the hosted version right now. not sure how long i&apos;ll keep it up.
              i&apos;m currently paying for resend and fly.io. but i&apos;ll send an email a few
              days before anything changes. either way, you can always host your own version for
              free. thanks for trying it out.
            </p>
          </div>

          <FeedbackForm fallbackEmail={process.env.FEEDBACK_EMAIL} />
        </div>

        <div className="border-border mt-8 flex gap-4 border-t pt-5">
          <a
            href="https://github.com/heycapy/heycapy"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>github<span className="opacity-50">]</span>
          </a>
          <Link
            href="/how-to-use"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>how to use<span className="opacity-50">]</span>
          </Link>
          <a
            href="https://app.heycapy.xyz"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>open app<span className="opacity-50">]</span>
          </a>
        </div>
      </div>
    </main>
  );
}
