import Link from "next/link";

import { COMPANY } from "@/lib/legal-content";

const PRODUCT_LINKS = [
  { href: "/discovery", label: "Descobrir" },
  { href: "/pricing", label: "Preços" },
  { href: "/", label: "Como funciona" },
] as const;

const LEGAL_LINKS = [
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/termos", label: "Termos e Condições" },
  { href: "/cookies", label: "Política de Cookies" },
  { href: "/litigios", label: "Resolução de Litígios" },
  { href: "/sobre", label: "Informação legal" },
] as const;

const COMPANY_LINKS = [
  { href: "/sobre", label: "Sobre" },
  { href: `mailto:${COMPANY.contactEmail}`, label: "Contacto", external: false },
  {
    href: "https://www.livroreclamacoes.pt/inicio",
    label: "Livro de Reclamações",
    external: true,
  },
] as const;

function FooterNav({
  title,
  label,
  links,
}: {
  title: string;
  label: string;
  links: readonly { href: string; label: string; external?: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-3">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-beedero-black">{title}</h2>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-beedero-black/80 transition-colors hover:text-beedero-black"
              >
                {link.label}
              </a>
            ) : link.href.startsWith("mailto:") ? (
              <a
                href={link.href}
                className="text-sm font-medium text-beedero-black/80 transition-colors hover:text-beedero-black"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm font-medium text-beedero-black/80 transition-colors hover:text-beedero-black"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t-2 border-beedero-black bg-beedero-yellow text-beedero-black">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="text-lg font-black uppercase tracking-[-0.04em]">
              Beedero
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-beedero-black/75">
              A rede de confiança para startups e investidores.
            </p>
          </div>

          <FooterNav title="Produto" label="Produto" links={PRODUCT_LINKS} />
          <FooterNav title="Legal" label="Legal" links={LEGAL_LINKS} />
          <FooterNav title="Empresa" label="Empresa" links={COMPANY_LINKS} />
        </div>

        <div className="mt-10 border-t border-beedero-black/15 pt-8 text-xs leading-6 text-beedero-black/75">
          <p>
            {COMPANY.name} · NIF {COMPANY.nif} · {COMPANY.address} · Capital social{" "}
            {COMPANY.capital} · {COMPANY.registry}
          </p>
          <p className="mt-2">© {year} Beedero. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
