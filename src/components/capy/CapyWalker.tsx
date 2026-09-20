"use client";

import { useEffect, useState } from "react";
import { Sprite } from "./Sprite";

export function CapyWalker() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function scheduleWalk(first = false) {
      const delay = first
        ? process.env.NODE_ENV === "development"
          ? 500
          : 45_000
        : 45_000 + Math.random() * 45_000;
      return setTimeout(() => {
        setVisible(true);
        setTimeout(() => {
          setVisible(false);
          scheduleWalk();
        }, 18_000);
      }, delay);
    }

    const timer = scheduleWalk(true);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 z-40"
      style={{ animation: "capy-walk-across 18s linear forwards" }}
    >
      <Sprite id="capy-walk" size={128} />
    </div>
  );
}
