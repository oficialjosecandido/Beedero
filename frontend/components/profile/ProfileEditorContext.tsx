"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * One section open at a time. Opening another while the current one has
 * unsaved changes asks first; leaving the page with unsaved changes asks the
 * browser to confirm. That is the whole state model of the profile page.
 */
type EditorContext = {
  openId: string | null;
  /** Returns false when the person chose to keep editing the current section. */
  request: (id: string | null) => boolean;
  register: (id: string, isDirty: () => boolean) => () => void;
};

const Ctx = createContext<EditorContext | null>(null);

export function ProfileEditorProvider({
  initialOpen = null,
  children,
}: {
  initialOpen?: string | null;
  children: React.ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpen);
  const dirtyChecks = useRef(new Map<string, () => boolean>());

  const isDirty = useCallback(
    (id: string | null) => (id ? (dirtyChecks.current.get(id)?.() ?? false) : false),
    []
  );

  const request = useCallback(
    (id: string | null) => {
      if (openId && openId !== id && isDirty(openId)) {
        if (!window.confirm("You have unsaved changes. Discard them?")) return false;
      }
      setOpenId(id);
      return true;
    },
    [openId, isDirty]
  );

  const register = useCallback((id: string, check: () => boolean) => {
    dirtyChecks.current.set(id, check);
    return () => {
      dirtyChecks.current.delete(id);
    };
  }, []);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (isDirty(openId)) event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [openId, isDirty]);

  const value = useMemo(() => ({ openId, request, register }), [openId, request, register]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfileEditor(): EditorContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfileEditor must be used inside ProfileEditorProvider");
  return ctx;
}

/** "Add" buttons in the completion card: open the section and bring it into view. */
export function OpenSectionButton({
  section,
  className,
  children,
}: {
  section: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { request } = useProfileEditor();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (!request(section)) return;
        // Wait a frame so the section expands into edit mode before scrolling.
        requestAnimationFrame(() => {
          document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }}
    >
      {children}
    </button>
  );
}
