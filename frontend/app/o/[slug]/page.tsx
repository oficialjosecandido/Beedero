import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrgProfile } from "@/components/OrgProfile";
import { OrgProfileJsonLd } from "@/components/OrgProfileJsonLd";
import { ApiError, apiFetch, publicFetch } from "@/lib/api";
import { orgProfileMetadata } from "@/lib/site-metadata";
import { getAccessToken } from "@/lib/session";
import type { OrgProfile as OrgProfileData } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = (await publicFetch(`/public/orgs/${slug}/`)) as OrgProfileData;
    return orgProfileMetadata(data.org);
  } catch {
    return { title: "Organization" };
  }
}

export default async function PublicOrgPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data: OrgProfileData;
  try {
    const token = await getAccessToken();
    data = token
      ? await apiFetch<OrgProfileData>(`/public/orgs/${slug}/`)
      : await publicFetch<OrgProfileData>(`/public/orgs/${slug}/`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <>
      <OrgProfileJsonLd org={data.org} />
      <div className="flex flex-1 justify-center px-6 py-16">
        <OrgProfile data={data} />
      </div>
    </>
  );
}
