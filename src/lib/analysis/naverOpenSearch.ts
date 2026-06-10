/** 네이버 검색 Open API (developers.naver.com · 검색) */

export type NaverSearchEndpoint =
  | "blog"
  | "news"
  | "kin"
  | "cafearticle"
  | "webkr";

export type NaverSearchItem = {
  title: string;
  description: string;
  link: string;
  bloggerlink?: string;
  bloggername?: string;
  cafeurl?: string;
  cafename?: string;
};

export function isNaverOpenSearchConfigured(): boolean {
  return Boolean(
    process.env.NAVER_OPEN_API_CLIENT_ID &&
      process.env.NAVER_OPEN_API_CLIENT_SECRET
  );
}

function headers(): Record<string, string> {
  return {
    "X-Naver-Client-Id": process.env.NAVER_OPEN_API_CLIENT_ID!,
    "X-Naver-Client-Secret": process.env.NAVER_OPEN_API_CLIENT_SECRET!,
  };
}

export async function naverSearch(
  endpoint: NaverSearchEndpoint,
  query: string,
  display = 10
): Promise<{ total: number; items: NaverSearchItem[] }> {
  if (!isNaverOpenSearchConfigured()) {
    return { total: 0, items: [] };
  }

  const url = new URL(`https://openapi.naver.com/v1/search/${endpoint}.json`);
  url.searchParams.set("query", query.trim());
  url.searchParams.set("display", String(Math.min(display, 10)));
  url.searchParams.set("sort", "sim");

  const res = await fetchWithRetry(url.toString(), { headers: headers() });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `네이버 검색 API ${endpoint} (${res.status}): ${text.slice(0, 100)}`
    );
  }

  const data = (await res.json()) as {
    total?: number;
    items?: Record<string, string>[];
  };

  const items: NaverSearchItem[] = (data.items ?? []).map((raw) => ({
    title: raw.title ?? "",
    description: raw.description ?? "",
    link: raw.link ?? "",
    bloggerlink: raw.bloggerlink,
    bloggername: raw.bloggername,
    cafeurl: raw.cafeurl,
    cafename: raw.cafename,
  }));

  return { total: data.total ?? 0, items };
}

export function toSearchHits(
  items: NaverSearchItem[],
  endpoint: NaverSearchEndpoint
): import("./channelMarks").SearchHit[] {
  return items.map((item) => {
    const links = [
      item.link,
      item.bloggerlink,
      item.cafeurl,
    ].filter(Boolean) as string[];
    const channelLabel =
      endpoint === "blog"
        ? item.bloggername
        : endpoint === "cafearticle"
          ? item.cafename
          : undefined;
    return {
      title: item.title,
      description: item.description,
      links,
      channelLabel,
    };
  });
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i <= retries; i++) {
    last = await fetch(url, init);
    if (last.status !== 429) return last;
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  return last!;
}
