/** Supabase Auth may retry refreshes. Bound the entire operation as well as fetch. */
export async function withDeadline<T>(operation: PromiseLike<T>, milliseconds = 6000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(operation), new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("Service unavailable")), milliseconds);
    })]);
  } finally { clearTimeout(timeout); }
}

export const boundedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const external = init?.signal;
  const abort = () => controller.abort();
  if (external?.aborted) controller.abort();
  external?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 5000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); external?.removeEventListener("abort", abort); }
};
