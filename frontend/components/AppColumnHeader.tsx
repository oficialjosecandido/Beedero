export function AppColumnHeader({ label }: { label: string }) {
  return (
    <header>
      <h2 className="text-sm uppercase tracking-[0.2em] text-beedero-black">{label}</h2>
    </header>
  );
}
