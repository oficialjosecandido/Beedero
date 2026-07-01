import Link from "next/link";

import { AuthForm } from "@/components/AuthForm";
import { registerAction } from "@/lib/auth-actions";

export default function RegisterPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Criar conta</h1>
      <AuthForm
        action={registerAction}
        submitLabel="Criar conta"
        fields={[
          { name: "username", label: "Utilizador", type: "text" },
          { name: "email", label: "Email", type: "email" },
          { name: "password", label: "Password", type: "password" },
        ]}
      />
      <p className="text-sm text-zinc-600">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
