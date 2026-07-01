import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/lib/auth-actions";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <AuthForm
        action={loginAction}
        submitLabel="Entrar"
        fields={[
          { name: "username", label: "Utilizador", type: "text" },
          { name: "password", label: "Password", type: "password" },
        ]}
      />
      <p className="text-sm text-zinc-600">
        Ainda não tem conta?{" "}
        <Link href="/register" className="font-medium underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
