export function LoadingSpinner({
  className = "size-8",
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={`animate-spin text-beedero-black ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={label ? undefined : true}
      aria-label={label || undefined}
      role={label ? "status" : undefined}
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
