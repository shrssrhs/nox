"use client";
export default function ErrorPage({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <main className="flex min-h-dvh items-center justify-center bg-[#09090b] p-6 text-white">
    <section className="max-w-md text-center">
      <h1 className="text-2xl font-semibold">Не удалось открыть Nox</h1>
      <p className="mt-3 text-white/60">Попробуйте ещё раз. Ваши сообщения остаются в истории.</p>
      <button onClick={unstable_retry} className="mt-6 rounded-xl bg-white px-5 py-3 text-black">Повторить</button>
    </section>
  </main>;
}
