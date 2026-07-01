import { notFound } from "next/navigation";

import { OrgProfile } from "@/components/OrgProfile";
import { ApiError, publicFetch } from "@/lib/api";
import type { OrgProfile as OrgProfileData } from "@/lib/types";

export const revalidate = 300;

export default async function PublicOrgPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data: OrgProfileData;
  try {
    data = await publicFetch(`/public/orgs/${slug}/`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="flex flex-1 justify-center px-6 py-16">
      <OrgProfile data={data} />
    </div>
  );
}
