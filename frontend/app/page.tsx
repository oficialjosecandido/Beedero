import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Beedero</h1>
      <p className="max-w-md text-zinc-600">
        Perfis de startups para investidores. Dados que não pode ver nunca
        saem do servidor.
      </p>
      <div className="flex gap-4">
        <Link
          href="/discovery"
          className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Explorar startups
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-50"
        >
          Entrar
        </Link>
      </div>
    </div>
  );
}
