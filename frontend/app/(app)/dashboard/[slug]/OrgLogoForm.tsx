"use client";

import { useActionState, useRef } from "react";

import { useActionToast } from "@/lib/use-action-toast";
import { uploadOrgLogoAction } from "../actions";

export function OrgLogoForm({
  slug,
  logo,
  name,
  editable,
}: {
  slug: string;
  logo?: string | null;
  name: string;
  editable: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(uploadOrgLogoAction, null);
  useActionToast(state, pending, {
    successMessage: "Logo updated.",
    isSuccess: (message) => message === "saved",
  });
  const image = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className="size-full object-cover" />
  ) : (
    <span className="text-xl font-semibold text-zinc-400">{name.charAt(0).toUpperCase()}</span>
  );

  if (!editable) {
    return (
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
        {image}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="group relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50"
    >
      <input type="hidden" name="slug" value={slug} />
      {image}
      <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-beedero-black/0 text-[11px] font-medium text-transparent transition-colors group-hover:bg-beedero-black/50 group-hover:text-beedero-white">
        Change
        <input
          type="file"
          name="logo"
          accept="image/*"
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
      </label>
    </form>
  );
}
