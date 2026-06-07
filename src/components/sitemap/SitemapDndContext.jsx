"use client";

import { createContext, useContext } from "react";

const SitemapDndContext = createContext({ isDragging: false });

export function SitemapDndProvider({ isDragging, children }) {
  return (
    <SitemapDndContext.Provider value={{ isDragging }}>{children}</SitemapDndContext.Provider>
  );
}

export function useSitemapDnd() {
  return useContext(SitemapDndContext);
}
