const TIMEOUT_MS = 45_000;
const MAX_RETRIES = 3;

/** 소상공인365 — Vercel 해외 리전에서 fetch failed 방지(재시도·타임아웃) */
export async function sbizFetch(
  url: string | URL,
  init?: RequestInit,
  label?: string
): Promise<Response> {
  const urlStr = String(url);
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
    try {
      return await fetch(urlStr, {
        redirect: "follow",
        cache: "no-store",
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      lastErr = e;
    }
  }

  const hint = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const prefix = label ? `[${label}] ` : "";
  throw new Error(`${prefix}fetch failed — ${hint}`);
}
