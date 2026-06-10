import { fetchLocalSearchPlaces } from "./naverLocalSearch";
import {
  markBlogFromHits,
  markChannelFromHits,
  markHomepageFromLocal,
  markHomepageFromWebHits,
  type ChannelMark,
  type SearchHit,
} from "./channelMarks";
import {
  isNaverOpenSearchConfigured,
  naverSearch,
  toSearchHits,
} from "./naverOpenSearch";
import type { AnalysisReport } from "./types";

export type ChannelRow = NonNullable<
  NonNullable<AnalysisReport["search"]>["channelMatrix"]
>[number];

async function auditOneHospital(
  hospital: string
): Promise<Omit<ChannelRow, "hospital" | "isOurs">> {
  const q = hospital.replace(/\s+/g, " ").trim();

  const blog = await naverSearch("blog", q, 10);
  await delay(250);
  const news = await naverSearch("news", q, 10);
  await delay(250);
  const kin = await naverSearch("kin", q, 10);
  await delay(250);
  const cafe = await naverSearch("cafearticle", q, 10);
  await delay(250);
  const web = await naverSearch("webkr", `${q} 홈페이지`, 10);
  await delay(250);
  const local = await fetchLocalSearchPlaces(q, 3);

  const blogMark = markBlogFromHits(toSearchHits(blog.items, "blog"), q);
  const newsMark = markChannelFromHits(toSearchHits(news.items, "news"), q, {
    mode: "news",
  });
  const kinMark = markChannelFromHits(toSearchHits(kin.items, "kin"), q);
  const cafeMark = markChannelFromHits(toSearchHits(cafe.items, "cafearticle"), q);

  const homepage = resolveHomepageMark(
    local,
    toSearchHits(web.items, "webkr"),
    q
  );
  const sns = markSnsFromHits(
    [
      ...toSearchHits(blog.items, "blog"),
      ...toSearchHits(cafe.items, "cafearticle"),
    ],
    local,
    q
  );
  const video = markVideoFromHits(
    [...toSearchHits(blog.items, "blog"), ...toSearchHits(news.items, "news")],
    local,
    q
  );

  return {
    homepage,
    blog: blogMark,
    cafe: cafeMark,
    news: newsMark,
    kin: kinMark,
    sns,
    video,
  };
}

function resolveHomepageMark(
  local: { title: string; link: string }[],
  webHits: SearchHit[],
  hospital: string
): ChannelMark {
  const fromLocal = markHomepageFromLocal(local, hospital);
  const fromWeb = markHomepageFromWebHits(webHits, hospital);

  if (fromLocal === "O" || fromWeb === "O") return "O";
  return "X";
}

const INSTAGRAM_URL_RE = /instagram\.com/i;
const YOUTUBE_URL_RE = /youtube\.com|youtu\.be/i;

function extractPlatformHits(
  hits: SearchHit[],
  platformRe: RegExp
): SearchHit[] {
  return hits
    .map((hit) => ({
      ...hit,
      links: hit.links.filter((url) => platformRe.test(url)),
    }))
    .filter((hit) => hit.links.length > 0);
}

function localPlatformHits(
  local: { title: string; link: string }[],
  platformRe: RegExp
): SearchHit[] {
  return local
    .filter((p) => platformRe.test(p.link))
    .map((p) => ({
      title: p.title,
      description: "",
      links: [p.link],
    }));
}

function markSnsFromHits(
  hits: SearchHit[],
  local: { title: string; link: string }[],
  hospital: string
): ChannelMark {
  const snsHits: SearchHit[] = [
    ...extractPlatformHits(hits, INSTAGRAM_URL_RE),
    ...localPlatformHits(local, INSTAGRAM_URL_RE),
  ];
  return markChannelFromHits(snsHits, hospital, {
    isOwnChannelLink: (url) => INSTAGRAM_URL_RE.test(url),
    urlOnlyOwnChannel: true,
  });
}

function markVideoFromHits(
  hits: SearchHit[],
  local: { title: string; link: string }[],
  hospital: string
): ChannelMark {
  const videoHits: SearchHit[] = [
    ...extractPlatformHits(hits, YOUTUBE_URL_RE),
    ...localPlatformHits(local, YOUTUBE_URL_RE),
  ];
  return markChannelFromHits(videoHits, hospital, {
    isOwnChannelLink: (url) => YOUTUBE_URL_RE.test(url),
    urlOnlyOwnChannel: true,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 경쟁사·우리 병원별 채널 O/X/△ */
export async function auditChannelMatrix(
  hospitals: { name: string; isOurs?: boolean }[]
): Promise<ChannelRow[]> {
  if (!isNaverOpenSearchConfigured()) {
    throw new Error("NAVER_OPEN_API_CLIENT_ID·SECRET 미설정");
  }

  const rows: ChannelRow[] = [];

  for (const h of hospitals) {
    try {
      const channels = await auditOneHospital(h.name);
      rows.push({
        hospital: h.name,
        isOurs: h.isOurs,
        ...channels,
      });
    } catch {
      rows.push({
        hospital: h.name,
        isOurs: h.isOurs,
        homepage: "—",
        blog: "—",
        cafe: "—",
        news: "—",
        kin: "—",
        sns: "—",
        video: "—",
      });
    }
    await delay(400);
  }

  return rows;
}
