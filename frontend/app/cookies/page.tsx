import type { Metadata } from "next";

import { LegalPageShell } from "@/components/LegalPageShell";
import { COMPANY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Política de Cookies",
  description: "Como a Beedero utiliza cookies e tecnologias semelhantes.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalPageShell title="Política de Cookies">
      <p>
        A Beedero utiliza apenas cookies estritamente necessários ao funcionamento da
        plataforma. Não utilizamos cookies de publicidade nem de tracking de terceiros.
      </p>

      <h2>Que cookies utilizamos</h2>
      <ul>
        <li>
          <strong>Sessão de autenticação</strong> — cookie httpOnly que mantém o teu login
          seguro enquanto usas a aplicação.
        </li>
      </ul>

      <h2>Finalidade</h2>
      <p>
        Estes cookies são indispensáveis para autenticação, segurança e prevenção de fraude.
        Sem eles não é possível iniciar sessão nem utilizar áreas autenticadas da Beedero.
      </p>

      <h2>Duração</h2>
      <p>
        O cookie de sessão expira quando terminas sessão ou após um período de inatividade
        definido pelo servidor.
      </p>

      <h2>Consentimento</h2>
      <p>
        Cookies estritamente necessários estão isentos de consentimento nos termos da Lei n.º
        41/2004. Se no futuro formos utilizar analytics ou login social de terceiros,
        atualizaremos esta página e recolheremos o teu consentimento antes de ativar cookies
        não essenciais.
      </p>

      <h2>Contacto</h2>
      <p>
        Questões sobre privacidade:{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
      </p>
    </LegalPageShell>
  );
}
