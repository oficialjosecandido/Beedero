import type { ReactNode } from "react";

export function AppColumnSection({
  label,
  children,
  className = "",
  bodyClassName = "",
  id,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm ${className}`}
    >
      <header className="border-b border-beedero-border bg-beedero-yellow px-4 py-3 sm:px-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-beedero-black sm:text-sm">
          {label}
        </h2>
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
