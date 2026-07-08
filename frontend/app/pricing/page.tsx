import Link from "next/link";

const freePlanItems = [
  "Perfil completo da organização",
  "Todas as secções: equipa, produtos, mercado, milestones, awards, eventos",
  "Feed para partilhares novidades",
  "Aparece na descoberta dos investidores",
  "Segue e sê seguido",
  "Secção de fundraise com data room privado, visível só a investidores verificados",
  "Recebe contactos de investidores",
  "Vê quantos investidores viram o teu perfil",
];

const founderProItems = [
  ["Quem viu o teu perfil", "nomes, quando e quantas vezes"],
  ["Análise do data room", "que investidores abriram o teu deck e quanto tempo lá estiveram"],
  ["Sinais de interesse", "quem te guardou e quem manifestou interesse"],
  ["Descoberta avançada", "que investidores dão match com a tua fase e setor"],
];

const faqs = [
  {
    q: "Criar o perfil é mesmo grátis?",
    a: "Sim. Criar, publicar, ser descoberto, seguir, publicar novidades e receber contactos é gratuito, sem limite de tempo.",
  },
  {
    q: "Então o que é que é pago?",
    a: "Só insight extra para founders em ronda: saber quem viu o teu perfil, quem abriu o teu deck e quem demonstrou interesse. Nunca cobramos o acesso à plataforma nem a possibilidade de seres contactado.",
  },
  {
    q: "Os investidores pagam?",
    a: "Não. Os investidores usam o Beedero gratuitamente.",
  },
  {
    q: "Tenho de pagar para partilhar dados de fundraising?",
    a: "Não. A tua secção de fundraise e o data room são gratuitos, e só ficam visíveis a investidores verificados — controlas tu quem vê o quê.",
  },
  {
    q: "Posso cancelar o Founder Pro?",
    a: "Sim, a qualquer momento. Faz sentido tê-lo durante a ronda; quando ela fechar, cancelas.",
  },
  {
    q: "Preciso de uma organização para me registar?",
    a: "Não. Podes ter um perfil pessoal, seguir organizações e pessoas e acompanhar o que se passa, mesmo sem criar nenhuma organização.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-beedero-black text-beedero-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.04em]">
          Beedero
        </Link>
        <div className="hidden items-center gap-6 text-sm font-semibold uppercase tracking-[-0.02em] text-beedero-white/70 sm:flex">
          <Link href="/discovery" className="hover:text-beedero-white">
            Discovery
          </Link>
          <Link href="/pricing" className="text-beedero-white">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-beedero-white">
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-beedero-yellow px-5 py-2 text-beedero-black hover:bg-beedero-white"
          >
            Join
          </Link>
        </div>
      </nav>

      <section className="relative isolate overflow-hidden px-5 pb-16 pt-12 sm:px-8 sm:pb-20 lg:pt-16">
        <div className="absolute left-1/2 top-12 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-beedero-yellow/20 blur-3xl" />
        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-beedero-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Preço
          </p>
          <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] sm:text-7xl">
            Começar é grátis. E continua a ser.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg font-medium leading-8 text-beedero-white/70">
            Constrói o perfil da tua startup, sê descoberto por investidores e faz crescer a tua
            rede — sem pagar nada. Quando estiveres a levantar, dá-te ferramentas para perceberes
            quem está mesmo interessado.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="rounded-full bg-beedero-yellow px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-white"
            >
              Criar organização
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-beedero-white/25 px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-white hover:border-beedero-white hover:bg-beedero-white hover:text-beedero-black"
            >
              Sou investidor
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
            Os planos
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3 lg:items-stretch">
            <article className="flex flex-col rounded-[1.5rem] border border-beedero-black/10 bg-beedero-yellow/20 p-8">
              <h3 className="text-3xl font-black uppercase tracking-[-0.05em]">🐝 Grátis</h3>
              <p className="mt-1 text-sm font-bold uppercase tracking-[-0.02em] text-beedero-black/60">
                Para todas as startups. Para sempre.
              </p>
              <p className="mt-4 text-sm font-medium leading-6 text-beedero-black/70">
                Tudo o que precisas para existir, ser encontrado e crescer.
              </p>
              <p className="mt-6 text-4xl font-black tracking-[-0.06em]">
                €0 <span className="text-base font-bold text-beedero-black/50">/ para sempre</span>
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm font-medium leading-6 text-beedero-black/75">
                {freePlanItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-beedero-black/40">—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-8 rounded-full bg-beedero-black px-6 py-3 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-yellow hover:bg-beedero-black/85"
              >
                Criar organização
              </Link>
            </article>

            <article className="flex flex-col rounded-[1.5rem] border border-beedero-black/10 bg-beedero-black p-8 text-beedero-white">
              <h3 className="text-3xl font-black uppercase tracking-[-0.05em]">✨ Founder Pro</h3>
              <p className="mt-1 text-sm font-bold uppercase tracking-[-0.02em] text-beedero-yellow">
                Para quando estás a levantar e queres saber quem está a prestar atenção.
              </p>
              <p className="mt-4 text-sm font-medium leading-6 text-beedero-white/70">
                Tudo do plano Grátis, e ainda:
              </p>
              <p className="mt-6 text-4xl font-black tracking-[-0.06em]">
                €[XX]{" "}
                <span className="text-base font-bold text-beedero-white/50">
                  / mês (durante a tua ronda)
                </span>
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm font-medium leading-6 text-beedero-white/80">
                {founderProItems.map(([title, detail]) => (
                  <li key={title} className="flex flex-col gap-0.5">
                    <span className="font-bold text-beedero-white">{title}</span>
                    <span className="text-beedero-white/60">— {detail}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-8 rounded-full bg-beedero-yellow px-6 py-3 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-white"
              >
                Quero saber mais
              </Link>
              <p className="mt-3 text-center text-xs font-medium text-beedero-white/50">
                Cancela quando a ronda fechar. Sem compromissos.
              </p>
            </article>

            <article className="flex flex-col rounded-[1.5rem] border border-beedero-black/10 bg-beedero-yellow/20 p-8">
              <h3 className="text-3xl font-black uppercase tracking-[-0.05em]">💼 Investidores</h3>
              <p className="mt-1 text-sm font-bold uppercase tracking-[-0.02em] text-beedero-black/60">
                Grátis.
              </p>
              <p className="mt-4 text-sm font-medium leading-6 text-beedero-black/70">
                Deal flow estruturado, filtros por fase, setor, geografia e cheque, acesso a data
                rooms verificados e contacto direto com founders. Sem custo.
              </p>
              <p className="mt-6 text-4xl font-black tracking-[-0.06em]">€0</p>
              <div className="flex-1" />
              <Link
                href="/register"
                className="mt-8 rounded-full bg-beedero-black px-6 py-3 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-yellow hover:bg-beedero-black/85"
              >
                Entrar como investidor
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
            Porquê grátis?
          </p>
          <p className="mt-6 text-2xl font-medium leading-9 text-beedero-white/80 sm:text-3xl">
            O Beedero só vale se estiver cá toda a gente — founders e investidores. Por isso o
            essencial nunca vai estar atrás de um paywall. Cobramos apenas o que te dá uma
            vantagem extra quando estás a levantar, e nunca aquilo de que precisas para seres
            encontrado.
          </p>
        </div>
      </section>

      <section className="bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
            Perguntas frequentes
          </p>
          <div className="mt-8 flex flex-col gap-6">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-[1.5rem] border border-beedero-black/10 bg-beedero-yellow/10 p-6"
              >
                <h3 className="text-lg font-black tracking-[-0.02em]">{faq.q}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-beedero-black/70">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-beedero-white/10 bg-beedero-black p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
                Começa agora
              </p>
              <h2 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.07em] sm:text-6xl">
                Junta-te à camada de descoberta de startups.
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/register"
                className="rounded-full bg-beedero-white px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-yellow"
              >
                Criar organização — grátis
              </Link>
              <Link
                href="mailto:hello@beedero.com"
                className="rounded-full border border-beedero-white/25 px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-white hover:border-beedero-white hover:bg-beedero-white hover:text-beedero-black"
              >
                Falar connosco
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 px-5 py-10 text-xs font-medium uppercase tracking-[0.1em] text-beedero-white/40 sm:flex-row sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Beedero</p>
        <div className="flex gap-5">
          <Link href="/terms" className="hover:text-beedero-white">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-beedero-white">
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  );
}
