"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  type ReactNode,
} from "react";

type RightSidebarContextValue = {
  setRightSidebar: (node: ReactNode | null) => void;
};

const RightSidebarContext = createContext<RightSidebarContextValue | null>(null);

export function RightSidebarProvider({
  children,
  onChange,
}: {
  children: ReactNode;
  onChange: (node: ReactNode | null) => void;
}) {
  const setRightSidebar = useCallback(
    (node: ReactNode | null) => {
      onChange(node);
    },
    [onChange]
  );

  return (
    <RightSidebarContext.Provider value={{ setRightSidebar }}>
      {children}
    </RightSidebarContext.Provider>
  );
}

/** Registers a right-column panel into the AppShell 3-col grid (Figma feed layout). */
export function useRightSidebar(node: ReactNode | null) {
  const ctx = useContext(RightSidebarContext);

  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.setRightSidebar(node);
    return () => ctx.setRightSidebar(null);
  }, [ctx, node]);
}
