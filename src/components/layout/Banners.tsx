"use client";

import { createContext, useContext, type ReactNode } from "react";

// The app shell owns the banners, the page decides where they sit (under the bucket tabs)
const BannersContext = createContext<ReactNode>(null);

export function BannersProvider({
  banners,
  children,
}: {
  banners: ReactNode;
  children: ReactNode;
}) {
  return <BannersContext value={banners}>{children}</BannersContext>;
}

export function Banners() {
  return useContext(BannersContext);
}
