"use server";

import { redirect } from "next/navigation";

import { endSessionUrl, getEntraConfig } from "./entra";
import { clearSession, getIdToken } from "./session";

export async function logoutAction() {
  const idToken = await getIdToken();
  await clearSession();
  const config = getEntraConfig();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (config && siteUrl) {
    const url = new URL(endSessionUrl(config));
    url.searchParams.set("client_id", config.webClientId);
    url.searchParams.set("post_logout_redirect_uri", `${siteUrl}/login`);
    url.searchParams.set("ui_locales", "en");
    if (idToken) url.searchParams.set("id_token_hint", idToken);
    redirect(url.toString());
  }
  redirect("/login");
}
