const LEVEL_LABELS: Record<number, string> = {
  1: "Identidade",
  2: "Conformidade",
  3: "Financeiro certificado",
  4: "Tração verificada",
};

export function CredibilityBadge({ level }: { level: number }) {
  if (!level) return null;
  return (
    <span
      title={LEVEL_LABELS[level] ?? ""}
      className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white"
    >
      Nível {level} · {LEVEL_LABELS[level] ?? ""}
    </span>
  );
}
