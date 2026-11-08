import { PersonaLanding } from "@/components/seo/PersonaLanding";
import { personaBySlug } from "@/lib/seo-content";
import { pageMetadata } from "@/lib/site-metadata";

const persona = personaBySlug("for-founders")!;

export const metadata = pageMetadata({
  title: persona.title,
  description: persona.description,
  path: persona.path,
  keywords: persona.keywords,
});

export default function ForFoundersPage() {
  return <PersonaLanding persona={persona} />;
}
