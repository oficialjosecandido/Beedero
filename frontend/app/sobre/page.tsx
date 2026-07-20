import type { Metadata } from "next";

import { LegalPageShell } from "@/components/LegalPageShell";
import { COMPANY, LEGAL_ENTITY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Sobre a Beedero",
  description: "Informação sobre a Beedero e identificação legal da empresa.",
  path: "/sobre",
});

export default function SobrePage() {
  return (
    <LegalPageShell title="Sobre a Beedero">
      <p>
        A Beedero é a rede de confiança para startups e investidores — perfis verificados,
        discovery e feed para partilhar marcos, eventos e atualizações.
      </p>

      <h2>Informação legal</h2>
      <ul>
        <li>
          <strong>Denominação:</strong> {COMPANY.name}
        </li>
        <li>
          <strong>Sede:</strong> {COMPANY.address}
        </li>
        <li>
          <strong>NIF:</strong> {COMPANY.nif}
        </li>
        <li>
          <strong>Capital social:</strong> {COMPANY.capital}
        </li>
        <li>
          <strong>Registo comercial:</strong> {COMPANY.registry}
        </li>
        <li>
          <strong>Contacto:</strong>{" "}
          <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>
        </li>
        <li>
          <strong>Privacidade:</strong>{" "}
          <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
        </li>
      </ul>

      <p className="text-xs text-zinc-500">
        Última atualização: {LEGAL_ENTITY.lastUpdated}. Em caso de divergência entre versões
        linguísticas, prevalece a versão em português.
      </p>
    </LegalPageShell>
  );
}
