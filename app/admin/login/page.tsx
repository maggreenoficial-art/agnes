import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { MixWordmark, InstitutoSeal } from "@/components/Brand";
import { isAdmin } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-[100svh] flex-col bg-green-deep px-5 py-10 sm:px-8">
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <MixWordmark className="text-xl text-white" />
        <InstitutoSeal className="size-14" priority />
      </header>
      <section className="mx-auto mt-16 w-full max-w-md">
        <LoginForm />
      </section>
    </main>
  );
}
