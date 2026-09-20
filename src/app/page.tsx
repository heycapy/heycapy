import { APP_NAME } from "@/constants";

export default function Home() {
  return (
    <main className="flex h-full items-center justify-center">
      <p className="text-muted-foreground text-sm">{APP_NAME} is starting up...</p>
    </main>
  );
}
