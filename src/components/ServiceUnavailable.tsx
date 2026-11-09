export function ServiceUnavailable() {
  return <main className="flex min-h-dvh items-center justify-center bg-[#09090b] px-6 text-white">
    <section className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
      <h1 className="text-2xl font-semibold">Nox временно недоступен</h1>
      <p className="mt-3 text-sm text-white/60">Не удалось подключиться. Ваши данные и вход сохранены. Попробуйте ещё раз.</p>
      <Link href="/" className="mt-6 inline-block rounded-xl bg-white px-5 py-3 text-sm font-medium text-black">Повторить</Link>
    </section>
  </main>;
}
import Link from "next/link";
