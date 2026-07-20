import type { ReactNode } from "react";

export function AppColumnSection({
  label,
  children,
  className = "",
  bodyClassName = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm ${className}`}
    >
      <header className="border-b border-beedero-border bg-beedero-yellow px-4 py-2.5">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">{label}</h2>
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
