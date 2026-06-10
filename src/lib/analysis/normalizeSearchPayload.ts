import type { AnalysisReport, SearchGeneratedPayload } from "./types";

type SearchData = NonNullable<AnalysisReport["search"]>;

export function normalizeSearchFromApi(data: {
  search?: SearchData | null;
  competitors?: SearchData["competitors"];
  insights?: SearchData["insights"];
  channelMatrix?: SearchData["channelMatrix"];
  searchKeyword?: string | null;
}): SearchData | null {
  const nested = data.search;
  if (nested?.competitors?.length) return nested;

  const competitors = data.competitors ?? nested?.competitors;
  if (!competitors?.length) return null;

  return {
    competitors,
    insights: data.insights ?? nested?.insights ?? [],
    channelMatrix: data.channelMatrix ?? nested?.channelMatrix,
    meta: {
      ...nested?.meta,
      mapQuery: data.searchKeyword ?? nested?.meta?.mapQuery,
      rivalCount:
        nested?.meta?.rivalCount ??
        competitors.filter((c) => !c.isOurs).length,
    },
  };
}

export async function resolveSearchForDisplay(
  data: SearchGeneratedPayload
): Promise<SearchData | null> {
  const direct = normalizeSearchFromApi(data);
  if (direct?.competitors?.length) return direct;

  if (!data.slug) return null;

  try {
    const res = await fetch(`/api/analysis/report/${data.slug}`);
    const json = (await res.json()) as {
      search?: SearchData | null;
      searchKeyword?: string | null;
    };
    if (!res.ok) return null;
    return normalizeSearchFromApi({
      search: json.search,
      searchKeyword: json.searchKeyword,
    });
  } catch {
    return null;
  }
}
