import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";
import { forgotPasswordAction } from "@/lib/auth-actions";

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-beedero-black/10 bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Enter your email and we&apos;ll send reset instructions if the account exists.
          </p>
        </div>
        <AuthForm
          action={forgotPasswordAction}
          submitLabel="Send reset link"
          fields={[{ name: "email", label: "Email", type: "email" }]}
        />
        <p className="text-center text-sm text-zinc-600">
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
