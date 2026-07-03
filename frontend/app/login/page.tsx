import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/lib/auth-actions";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Log in</h1>
        </div>
        <AuthForm
          action={loginAction}
          submitLabel="Log in"
          fields={[
            { name: "email", label: "Email", type: "email" },
            { name: "password", label: "Password", type: "password" },
          ]}
        />
        <div className="flex flex-col gap-2 text-center text-sm text-zinc-600">
          <Link
            href="/forgot-password"
            className="font-medium text-emerald-700 underline"
          >
            Forgot password?
          </Link>
          <p>
          Don&apos;t have an account yet?{" "}
          <Link
            href="/register"
            className="font-medium text-emerald-700 underline"
          >
            Create account
          </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
