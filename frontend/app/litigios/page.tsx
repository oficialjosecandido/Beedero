import type { Metadata } from "next";

import { LegalPageShell } from "@/components/LegalPageShell";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Resolução de Litígios",
  description: "Resolução alternativa de litígios de consumo e Livro de Reclamações.",
  path: "/litigios",
});

export default function LitigiosPage() {
  return (
    <LegalPageShell title="Resolução Alternativa de Litígios de Consumo">
      <p>
        Nos termos da Lei n.º 144/2015, de 8 de setembro, em caso de litígio de consumo, o
        consumidor pode recorrer a uma Entidade de Resolução Alternativa de Litígios de
        Consumo (RAL).
      </p>

      <h2>Entidade competente</h2>
      <p>
        <strong>
          CNIACC — Centro Nacional de Informação e Arbitragem de Conflitos de Consumo
        </strong>
        <br />
        Faculdade de Direito da Universidade Nova de Lisboa, Campus de Campolide, 1099-032
        Lisboa
        <br />
        Email:{" "}
        <a href="mailto:cniacc@fd.unl.pt">cniacc@fd.unl.pt</a> · Tel.: (+351) 21 384 74 84
        <br />
        Site:{" "}
        <a href="https://www.arbitragemdeconsumo.org" target="_blank" rel="noopener noreferrer">
          www.arbitragemdeconsumo.org
        </a>
      </p>

      <p>
        Mais informação no Portal do Consumidor:{" "}
        <a href="https://www.consumidor.pt" target="_blank" rel="noopener noreferrer">
          www.consumidor.pt
        </a>
      </p>

      <h2>Livro de Reclamações</h2>
      <p>
        A Beedero disponibiliza Livro de Reclamações eletrónico, nos termos do Decreto-Lei
        n.º 156/2005:{" "}
        <a
          href="https://www.livroreclamacoes.pt/inicio"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.livroreclamacoes.pt
        </a>
      </p>
    </LegalPageShell>
  );
}
