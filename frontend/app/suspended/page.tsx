import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = { ...noIndexMetadata, title: "Account suspended — Beedero" };

export default function SuspendedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070806] px-5 text-white">
      <div className="w-full max-w-lg py-16">
        <p className="text-lg font-black uppercase tracking-[-0.07em]">Beedero</p>
        <h1 className="mt-10 text-4xl font-black tracking-[-0.04em]">This account is suspended.</h1>
        <p className="mt-4 text-white/65">
          It was suspended for breaking the Terms of Service, and we emailed you when it happened. If you think this is a
          mistake, write to <a href="mailto:hello@beedero.com" className="underline">hello@beedero.com</a>.
        </p>
      </div>
    </main>
  );
}
