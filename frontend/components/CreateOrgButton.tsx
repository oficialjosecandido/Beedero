import Link from "next/link";

/**
 * CTA into the full-page create-org stepper. Never a modal — the wizard needs
 * the room of `/organisations/new`.
 */
export function CreateOrgButton({
  className = "mt-4",
  variant = "default",
  label = "Create organisation",
  href = "/organisations/new",
}: {
  className?: string;
  /** `dark` / `sidebar` match the app shell; `default` is the light surfaces. */
  variant?: "default" | "dark" | "sidebar";
  label?: string;
  href?: string;
}) {
  const buttonClass =
    variant === "sidebar"
      ? `flex items-center gap-2 px-3 text-xs font-bold text-beedero-yellow transition hover:text-white ${className}`
      : variant === "dark"
        ? `inline-flex w-full items-center justify-center border border-beedero-yellow/55 px-3 py-2.5 text-xs font-bold text-beedero-yellow transition hover:bg-beedero-yellow hover:text-beedero-black ${className}`
        : `inline-flex w-full items-center justify-center rounded-full border border-zinc-500 px-3 py-1.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:bg-zinc-50 hover:text-zinc-900 ${className}`;

  return (
    <Link href={href} className={buttonClass}>
      {label}
    </Link>
  );
}
