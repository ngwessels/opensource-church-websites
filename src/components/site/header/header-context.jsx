"use client";

import { createContext, useContext } from "react";

export const HeaderStylesContext = createContext(null);

export function useHeaderStyles() {
  return useContext(HeaderStylesContext);
}

export const NAV_LINK_CLASS = "site-nav-link";
