import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";
import { registerAction } from "@/lib/auth-actions";

export default function RegisterPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <AuthForm
        action={registerAction}
        submitLabel="Create account"
        fields={[
          { name: "username", label: "Username", type: "text" },
          { name: "email", label: "Email", type: "email" },
          { name: "password", label: "Password", type: "password" },
        ]}
      />
      <p className="text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
