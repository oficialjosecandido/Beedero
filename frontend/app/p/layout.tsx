/**
 * Public person profiles sit outside the app shell but use the same dark
 * Beedero surface as the platform — yellow accents on black.
 */
export default function PublicPersonLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-1 flex-col bg-app-bg text-white">{children}</div>;
}
