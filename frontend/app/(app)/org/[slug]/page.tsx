import { notFound } from "next/navigation";

import { OrgProfile } from "@/components/OrgProfile";
import { ApiError, apiFetch } from "@/lib/api";
import type { OrgProfile as OrgProfileData } from "@/lib/types";

export default async function AuthedOrgPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data: OrgProfileData;
  try {
    data = await apiFetch<OrgProfileData>(`/orgs/${slug}/`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 401)) notFound();
    throw err;
  }

  return (
    <div className="flex flex-1 justify-center px-6 py-16">
      <OrgProfile data={data} />
    </div>
  );
}
