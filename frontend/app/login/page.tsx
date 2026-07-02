import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/lib/auth-actions";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <AuthForm
        action={loginAction}
        submitLabel="Log in"
        fields={[
          { name: "username", label: "Username", type: "text" },
          { name: "password", label: "Password", type: "password" },
        ]}
      />
      <p className="text-sm text-zinc-600">
        Don&apos;t have an account yet?{" "}
        <Link href="/register" className="font-medium underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
