import type { Metadata } from "next";

import { LegalPageShell } from "@/components/LegalPageShell";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Dispute Resolution",
  description: "Alternative consumer dispute resolution and Complaints Book.",
  path: "/disputes",
});

export default function DisputesPage() {
  return (
    <LegalPageShell title="Alternative Consumer Dispute Resolution">
      <p>
        Under Law No. 144/2015 of 8 September, in the event of a consumer dispute, the
        consumer may turn to an Alternative Consumer Dispute Resolution entity (ADR).
      </p>

      <h2>Competent entity</h2>
      <p>
        <strong>
          CNIACC — National Centre for Consumer Dispute Information and Arbitration
        </strong>
        <br />
        Faculdade de Direito da Universidade Nova de Lisboa, Campus de Campolide, 1099-032
        Lisbon
        <br />
        Email:{" "}
        <a href="mailto:cniacc@fd.unl.pt">cniacc@fd.unl.pt</a> · Phone: (+351) 21 384 74 84
        <br />
        Website:{" "}
        <a href="https://www.arbitragemdeconsumo.org" target="_blank" rel="noopener noreferrer">
          www.arbitragemdeconsumo.org
        </a>
      </p>

      <p>
        More information on the Consumer Portal:{" "}
        <a href="https://www.consumidor.pt" target="_blank" rel="noopener noreferrer">
          www.consumidor.pt
        </a>
      </p>

      <h2>Complaints Book</h2>
      <p>
        Beedero provides an electronic Complaints Book, in accordance with Decree-Law No.
        156/2005:{" "}
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
