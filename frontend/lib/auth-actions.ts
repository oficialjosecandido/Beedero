"use server";

import { redirect } from "next/navigation";

import { clearSession } from "./session";

export async function logoutAction() {
  await clearSession();
  redirect("/");
}
