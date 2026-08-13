import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { InstitutoSeal, LogoMixModels } from "@/components/Brand";
import { isAdmin } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-[100svh] flex-col bg-green-deep px-5 py-10 sm:px-8">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-4">
        <LogoMixModels className="h-5 w-auto sm:h-6" priority />
        <InstitutoSeal className="size-11 sm:size-12" priority />
      </header>
      <section className="mx-auto mt-16 w-full max-w-md">
        <LoginForm />
      </section>
    </main>
  );
}
