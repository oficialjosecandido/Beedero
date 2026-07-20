import Link from "next/link";

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-beedero-white text-beedero-black">
      <nav className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.04em]">
          Beedero
        </Link>
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[-0.02em] text-beedero-black/60 hover:text-beedero-black"
        >
          Home
        </Link>
      </nav>
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-12 sm:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">{title}</h1>
        <article className="prose-beedero mt-8 space-y-4 text-sm leading-7 text-zinc-700 [&_a]:font-semibold [&_a]:text-beedero-black [&_a]:underline [&_a]:decoration-beedero-yellow [&_a]:decoration-2 [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </article>
      </div>
    </div>
  );
}
