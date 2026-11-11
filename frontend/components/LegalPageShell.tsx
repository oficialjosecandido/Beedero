import { PublicHeader } from "@/components/PublicHeader";

export function LegalPageShell({
  title,
  children,
  current,
}: {
  title: string;
  children: React.ReactNode;
  /** This page's path, so its own link is marked in the header. */
  current?: string;
}) {
  return (
    <div className="flex flex-1 flex-col bg-beedero-white text-beedero-black">
      {/* The same header as every other public page — these used to have a
          two-link one of their own. */}
      <PublicHeader current={current} tone="light" />
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-12 sm:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">{title}</h1>
        <article className="prose-beedero mt-8 space-y-4 text-sm leading-7 text-zinc-700 [&_a]:font-semibold [&_a]:text-beedero-black [&_a]:underline [&_a]:decoration-beedero-yellow [&_a]:decoration-2 [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </article>
      </div>
    </div>
  );
}
