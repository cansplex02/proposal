import fs from "fs";
import path from "path";
import type { AnalysisReport, PopulationRow } from "./types";
import { buildChannelMatrixSkeleton } from "./buildAutoSearch";
import { KEYWORD_PROPOSAL_NOTICE } from "./keywords";
import {
  splitAnalysisBody,
  splitNavHeroAndDemographics,
  patchAnalysisProposalBackHref,
} from "./splitAnalysisBody";
import {
  buildSbiz365MarketMapEmbedUrl,
  sbiz365MarketMapExternalUrl,
} from "./sbiz365MarketMap";
import { publicProposalPath } from "@/lib/publish/paths";
import { formatNumber, pct, searchVolumeBarWidth } from "./utils";

const contentDir = path.join(process.cwd(), "src", "content");

/** 고객 공유 페이지 히어로 — 내부·기술 안내는 숨김 (작업실 폼 status용) */
function filterPublicHeroWarnings(warnings: string[]): string[] {
  return warnings.filter(
    (w) =>
      !/주요시설|업소현황|KAKAO|POI|상가 API|SBIZ365_|sang_gwon|Playwright|\.env\.local|fetch failed|Unauthorized|인증키 미설정|API 실패|미연동|업종 매핑/i.test(
        w
      )
  );
}

export function loadAnalysisTemplate(): string {
  return fs.readFileSync(path.join(contentDir, "analysis-body.html"), "utf8");
}

/** 히어로에 박힌 내부 안내 문구 제거 (저장된 HTML·재렌더 공통) */
export function stripInternalHeroWarningsFromHtml(html: string): string {
  return html.replace(
    /\s*<p class="section-sub" style="margin-top:-40px;color:#b45309;">[\s\S]*?<\/p>/g,
    ""
  );
}

export function renderAnalysisHtml(
  report: AnalysisReport,
  template = loadAnalysisTemplate()
): string {
  let html = template;

  html = html.replace(
    /(<h1 class="hero-headline">)[\s\S]*?(<\/h1>)/,
    `$1<strong>경쟁분석 결과</strong>$2`
  );

  html = replaceBlock(html, "POPULATION", renderPopulationSection(report));
  html = replaceBlock(html, "MARKET", renderMarketSection(report));
  // 섹션 04(공략키워드)는 템플릿 + KeywordGeneratorPanel 유지 — generate 시 교체하지 않음

  if (report.search?.competitors?.length) {
    html = replaceBlock(html, "SEARCH", renderSearchSection(report));
  } else if (report.meta?.warnings?.some((w) => /검색|경쟁|지도|Playwright/i.test(w))) {
    html = replaceBlock(
      html,
      "SEARCH",
      `  <div class="section-intro">
    <div class="section-num">03 · 검색량</div>
    <h2 class="section-title">검색량 및 <strong>디지털 채널</strong> 현황</h2>
    <p class="section-sub">진료과와 병원명을 입력하면 경쟁병원 브랜드 검색량·온라인 채널을 비교합니다.</p>
  </div>
  <div id="analysis-search-tool"></div>
  ${renderSearchUnavailableHtml(report)}`
    );
  }

  const heroWarnings = filterPublicHeroWarnings(report.meta?.warnings ?? []);
  if (heroWarnings.length) {
    const note = `<p class="section-sub" style="margin-top:-40px;color:#b45309;">⚠ ${escapeHtml(heroWarnings.join(" · "))}</p>`;
    html = html.replace(
      '<p class="hero-sub">',
      `${note}\n    <p class="hero-sub">`
    );
  }

  if (report.slug) {
    const proposalPath =
      report.publish?.publicPath ?? publicProposalPath(report.slug);
    html = patchAnalysisProposalBackHref(html, proposalPath);
  }

  return stripInternalHeroWarningsFromHtml(html);
}

/** 섹션 01·02(인구·상권) HTML — 지역 검색 전용 */
export function renderRegionDemographicsMarketHtml(
  report: AnalysisReport,
  template = loadAnalysisTemplate()
): string {
  const html = renderAnalysisHtml(report, template);
  return splitNavHeroAndDemographics(splitAnalysisBody(html).beforeSearch)
    .demographicsMarket;
}

function replaceBlock(html: string, name: string, inner: string): string {
  const re = new RegExp(
    `<!-- ANALYSIS:${name}:START -->[\\s\\S]*?<!-- ANALYSIS:${name}:END -->`,
    "m"
  );
  return html.replace(
    re,
    `<!-- ANALYSIS:${name}:START -->\n${inner}\n<!-- ANALYSIS:${name}:END -->`
  );
}

function renderPopulationSection(r: AnalysisReport): string {
  const radius = r.radiusKm.toFixed(1);
  return `  <div class="section-num">01 · 인구 현황</div>
  <h2 class="section-title">주거·직장 <strong>인구 현황</strong> (${radius}km)</h2>
  <p class="section-sub">반경 ${radius}km 내 잠재 환자층의 규모와 특성을 파악합니다.</p>

  <div class="population-grid">
    ${populationCard("주거인구 현황", r.population.residential, "home")}
    ${populationCard("직장인구 현황", r.population.workplace, "work")}
  </div>

  <div class="insight-box">
    ${r.population.insight}
  </div>`;
}

function peakHighlightIndices(values: number[]): Set<number> {
  const max = Math.max(...values, 0);
  const peaks = new Set<number>();
  if (max <= 0) return peaks;
  values.forEach((v, i) => {
    if (v === max) peaks.add(i);
  });
  return peaks;
}

const AGE_COL_START = 3;
const NO_PEAK = new Set<number>();

/** 연령대별 인구수 열(인덱스 3~)만 최댓값 강조 */
function agePeakHighlightIndices(ageValues: number[]): Set<number> {
  const peaks = peakHighlightIndices(ageValues);
  const cols = new Set<number>();
  peaks.forEach((i) => cols.add(i + AGE_COL_START));
  return cols;
}

function popCell(
  idx: number,
  text: string,
  peaks: Set<number>
): string {
  return peaks.has(idx) ? `<td class="highlight">${text}</td>` : `<td>${text}</td>`;
}

function populationCard(
  label: string,
  row: PopulationRow,
  variant: "home" | "work"
): string {
  if (variant === "work") {
    const t = row.ages.twentiesThirties;
    const approx30 = Math.round(t * 0.58);
    const approx20 = t - approx30;
    const fortiesHalf = Math.round(row.ages.fortiesFifties * 0.5);
    const ageCountVals = [
      approx20,
      approx30,
      fortiesHalf,
      fortiesHalf,
      row.ages.sixtiesPlus,
    ];
    const peaks = agePeakHighlightIndices(ageCountVals);
    const ageRatioVals = [
      Number(pct(approx20, row.total)),
      Number(pct(approx30, row.total)),
      Number(pct(fortiesHalf, row.total)),
      Number(pct(fortiesHalf, row.total)),
      Number(pct(row.ages.sixtiesPlus, row.total)),
    ];
    const ratioPeaks = agePeakHighlightIndices(ageRatioVals);

    return `<div class="card">
      <div class="card-label">${label}</div>
      <div class="pop-card-inner"><div>
        <table class="pop-table">
          <thead>
            <tr><th rowspan="2">구분</th><th colspan="3">성별 인구수</th><th colspan="5">연령대별 인구수</th></tr>
            <tr><th>전체</th><th>남</th><th>여</th><th>20대</th><th>30대</th><th>40대</th><th>50대</th><th>60대+</th></tr>
          </thead>
          <tbody>
            <tr>
              <td class="label">인구(명)</td>
              ${popCell(0, formatNumber(row.total), NO_PEAK)}
              ${popCell(1, formatNumber(row.male), NO_PEAK)}
              ${popCell(2, formatNumber(row.female), NO_PEAK)}
              ${popCell(3, formatNumber(approx20), peaks)}
              ${popCell(4, formatNumber(approx30), peaks)}
              ${popCell(5, formatNumber(fortiesHalf), peaks)}
              ${popCell(6, formatNumber(fortiesHalf), peaks)}
              ${popCell(7, formatNumber(row.ages.sixtiesPlus), peaks)}
            </tr>
            <tr>
              <td class="label">비율(%)</td>
              ${popCell(0, "100", NO_PEAK)}
              ${popCell(1, pct(row.male, row.total), NO_PEAK)}
              ${popCell(2, pct(row.female, row.total), NO_PEAK)}
              ${popCell(3, pct(approx20, row.total), ratioPeaks)}
              ${popCell(4, pct(approx30, row.total), ratioPeaks)}
              ${popCell(5, pct(fortiesHalf, row.total), ratioPeaks)}
              ${popCell(6, pct(fortiesHalf, row.total), ratioPeaks)}
              ${popCell(7, pct(row.ages.sixtiesPlus, row.total), ratioPeaks)}
            </tr>
          </tbody>
        </table>
      </div></div>
    </div>`;
  }

  const ageCountVals = [
    row.ages.under10,
    row.ages.teens,
    row.ages.twentiesThirties,
    row.ages.fortiesFifties,
    row.ages.sixtiesPlus,
  ];
  const peaks = agePeakHighlightIndices(ageCountVals);
  const ageRatioVals = [
    Number(pct(row.ages.under10, row.total)),
    Number(pct(row.ages.teens, row.total)),
    Number(pct(row.ages.twentiesThirties, row.total)),
    Number(pct(row.ages.fortiesFifties, row.total)),
    Number(pct(row.ages.sixtiesPlus, row.total)),
  ];
  const ratioPeaks = agePeakHighlightIndices(ageRatioVals);

  return `<div class="card">
    <div class="card-label">${label}</div>
    <div class="pop-card-inner"><div>
      <table class="pop-table">
        <thead>
          <tr><th rowspan="2">구분</th><th colspan="3">성별 인구수</th><th colspan="5">연령대별 인구수</th></tr>
          <tr><th>전체</th><th>남</th><th>여</th><th>10대미만</th><th>10대</th><th>20-30대</th><th>40-50대</th><th>60대이상</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="label">인구(명)</td>
            ${popCell(0, formatNumber(row.total), NO_PEAK)}
            ${popCell(1, formatNumber(row.male), NO_PEAK)}
            ${popCell(2, formatNumber(row.female), NO_PEAK)}
            ${popCell(3, formatNumber(row.ages.under10), peaks)}
            ${popCell(4, formatNumber(row.ages.teens), peaks)}
            ${popCell(5, formatNumber(row.ages.twentiesThirties), peaks)}
            ${popCell(6, formatNumber(row.ages.fortiesFifties), peaks)}
            ${popCell(7, formatNumber(row.ages.sixtiesPlus), peaks)}
          </tr>
          <tr>
            <td class="label">비율(%)</td>
            ${popCell(0, "100", NO_PEAK)}
            ${popCell(1, pct(row.male, row.total), NO_PEAK)}
            ${popCell(2, pct(row.female, row.total), NO_PEAK)}
            ${popCell(3, pct(row.ages.under10, row.total), ratioPeaks)}
            ${popCell(4, pct(row.ages.teens, row.total), ratioPeaks)}
            ${popCell(5, pct(row.ages.twentiesThirties, row.total), ratioPeaks)}
            ${popCell(6, pct(row.ages.fortiesFifties, row.total), ratioPeaks)}
            ${popCell(7, pct(row.ages.sixtiesPlus, row.total), ratioPeaks)}
          </tr>
        </tbody>
      </table>
    </div></div>
  </div>`;
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function renderMarketMap(r: AnalysisReport): string {
  const { lat, lng } = r.coordinates;
  const radiusMeters = Math.round(r.radiusKm * 1000);
  const embedUrl =
    buildSbiz365MarketMapEmbedUrl({ lat, lng, radiusMeters }) ?? "";
  const externalUrl =
    sbiz365MarketMapExternalUrl({ lat, lng, radiusMeters }) ??
    "https://bigdata.sbiz.or.kr/";

  return `<div
      id="analysis-market-map-slot"
      class="map-area map-area--slot"
      data-lat="${lat}"
      data-lng="${lng}"
      data-radius-km="${r.radiusKm}"
      data-address="${escapeAttr(r.address)}"
      data-map-note="${escapeAttr(r.market.mapNote || "")}"
      data-embed-url="${escapeAttr(embedUrl)}"
      data-external-url="${escapeAttr(externalUrl)}"
    ></div>`;
}

const MINI_CARD_ICONS: Record<string, string> = {
  medical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12M6 12h12"/></svg>`,
  store: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5 5.2 5h13.6L20 9.5M4 9.5h16M4 9.5v9.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5M9.5 20v-5h5v5"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5M20.5 19.5a5.5 5.5 0 0 0-4-5.3"/></svg>`,
};

type MiniCard = AnalysisReport["market"]["miniCards"][number];

function renderMiniCard(m: MiniCard): string {
  const accent = m.accent ? ` mini-card--${m.accent}` : "";
  const icon =
    m.icon && MINI_CARD_ICONS[m.icon]
      ? `<div class="mini-card-icon">${MINI_CARD_ICONS[m.icon]}</div>`
      : "";
  const value = m.value
    ? `<div class="mini-card-value">${escapeHtml(m.value)}</div>`
    : "";
  const trend = m.trend
    ? `<div class="mini-card-trend mini-card-trend--${m.trend.dir}">${
        m.trend.dir === "up" ? "▲" : m.trend.dir === "down" ? "▼" : "−"
      } ${escapeHtml(m.trend.text)}</div>`
    : "";
  return `<div class="mini-card${accent}">
      ${icon}
      ${value}
      <div class="mini-card-title">${escapeHtml(m.title)}</div>
      <div class="mini-card-sub">${escapeHtml(m.sub)}</div>
      ${trend}
    </div>`;
}

function renderFacilityDelta(delta: number | undefined): string {
  if (delta === undefined || delta === null) return "";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "−";
  const color = delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : "#94a3b8";
  return `<div class="facility-bar-delta" style="font-size:11px;color:${color};margin-top:2px;">${arrow} ${Math.abs(delta)}%</div>`;
}

function renderMarketSection(r: AnalysisReport): string {
  const max = Math.max(...r.market.facilities.map((f) => f.count), 1);
  const bars = r.market.facilities
    .map((f) => {
      const h = Math.max(4, Math.round((f.count / max) * 95));
      return `<div class="facility-bar-group">
          <div class="facility-bar-value">${formatNumber(f.count)}</div>
          <div class="facility-bar" style="height: ${h}%; background: ${f.color || "#2b5cd9"};"></div>
          ${renderFacilityDelta(f.deltaPercent)}
        </div>`;
    })
    .join("\n        ");
  const labels = r.market.facilities
    .map((f) => `<span>${escapeHtml(f.label)}</span>`)
    .join("\n        ");

  const hasDeltas = r.market.facilities.some(
    (f) => f.deltaPercent !== undefined && f.deltaPercent !== null
  );
  const deltaNote = hasDeltas
    ? `<p class="facility-chart-note" style="margin-top:12px;font-size:12px;line-height:1.5;color:#64748b;">
      막대 위 숫자는 <strong>현재 업소수</strong>, 막대 아래 <strong>%</strong>는 <strong>직전 반기 대비 증감률</strong>입니다.
      <span style="color:#16a34a;font-weight:600;">▲ 증가</span> · <span style="color:#dc2626;font-weight:600;">▼ 감소</span> — 해당 업종이 늘고 있는지 줄고 있는지를 보여줍니다.
    </p>`
    : "";

  const bullets = r.market.summaryBullets
    .map((b) => `<li>${b}</li>`)
    .join("\n      ");
  const mini = r.market.miniCards.map(renderMiniCard).join("\n    ");

  const src = r.market.facilitySource;
  const caption = r.market.facilityCaption;
  const isStoreChart = src === "store";
  const chartLabel = caption
    ? caption.title
    : isStoreChart
      ? `주변 업종 현황 (${r.radiusKm}km)`
      : `주변 주요시설 현황 (${r.radiusKm}km)`;
  const chartSub = caption
    ? caption.sub
    : isStoreChart
      ? `반경 ${r.radiusKm}km 인프라 및 상권 핵심 지표 (상가 API 집계).`
      : src === "kakao"
        ? `반경 ${r.radiusKm}km 주요시설 집계 (지도 POI 기준).`
        : `반경 ${r.radiusKm}km 주요시설·상권 지표 (소상공인365 상권분석).`;

  return `  <div class="section-intro">
    <div class="section-num">02 · 상권 정보</div>
    <h2 class="section-title">주변시설 및 <strong>상권 기본 정보</strong></h2>
    <p class="section-sub">${chartSub}</p>
  </div>

  <div class="market-grid">
    <div class="card">
      <div class="card-label">${chartLabel}</div>
      <div class="facility-chart">${bars}</div>
      <div class="facility-labels">${labels}</div>
      ${deltaNote}
    </div>
    <div class="card">
      <div class="card-label">상권 기본 정보 (반경 ${r.radiusKm}km)</div>
      ${renderMarketMap(r)}
    </div>
  </div>

  <div class="card summary-card">
    <div class="card-label">상권 조사 주요 요약</div>
    <ul class="summary-list">${bullets}</ul>
  </div>

  <div class="mini-cards">${mini}</div>`;
}

/** 수동·특수 케이스용 — 기본 generate HTML에는 사용하지 않음 */
export function renderKeywordSection(r: AnalysisReport): string {
  const cols = r.keywords.columns.filter((c) => c.id !== "region");
  const head = cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = r.keywords.rows
    .map((row) => {
      const cells = cols
        .map((c) => `<td>${escapeHtml(row.keywords[c.id] || "")}</td>`)
        .join("");
      return `<tr><td class="region">${escapeHtml(row.region)}</td>${cells}</tr>`;
    })
    .join("\n      ");

  const cards = r.keywords.strategyCards
    .map(
      (c) => `<div class="strategy-card">
      <div class="strategy-card-label">${escapeHtml(c.label)}</div>
      <div class="strategy-card-body">${c.body}</div>
    </div>`
    )
    .join("\n    ");

  return `  <div class="section-num">04 · 키워드</div>
  <h2 class="section-title">지역·진료 <strong>공략키워드</strong></h2>
  <p class="section-sub">${escapeHtml(r.keywords.subtitle)}</p>

  <div class="keyword-table-wrap">
    <table class="keyword-table">
      <thead><tr><th>지역</th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>

  <div class="strategy-cards">${cards}</div>

  <p class="keyword-disclaimer">${escapeHtml(KEYWORD_PROPOSAL_NOTICE)}</p>`;
}

/** 섹션 03 폼 아래 인라인용 — intro·검색폼 제외 */
export function renderSearchResultsHtml(report: AnalysisReport): string {
  const s = report.search;
  if (!s?.competitors?.length) {
    return renderSearchUnavailableHtml(report);
  }
  const rivalCount = s.competitors.filter((c) => !c.isOurs).length;
  const queryNote = s.meta?.mapQuery
    ? `<p class="analysis-search-query-note">네이버 지도 검색: <strong>${escapeHtml(s.meta.mapQuery)}</strong> · 경쟁병원 ${rivalCount}곳</p>`
    : "";
  return `${queryNote}${renderSearchResultsCore(s)}`;
}

export function renderSearchUnavailableHtml(report: AnalysisReport): string {
  const msgs = filterPublicHeroWarnings(report.meta?.warnings ?? []);
  if (!msgs.length) {
    return `<div class="analysis-search-unavailable">
    <p class="analysis-search-warn">경쟁병원·검색량 데이터를 불러오지 못했습니다.</p>
  </div>`;
  }
  return `<div class="analysis-search-unavailable">
    <p class="analysis-search-warn">⚠ ${escapeHtml(msgs.join(" · "))}</p>
  </div>`;
}

function renderSearchResultsCore(
  s: NonNullable<AnalysisReport["search"]>
): string {
  const chartRows = s.competitors.filter(
    (c) => c.volume > 0 && !c.volumeEstimated
  );
  const max = Math.max(...chartRows.map((c) => c.volume), 1);
  const rows = chartRows
    .map((c) => {
      const barW = searchVolumeBarWidth(c.volume, max);
      const cls = c.isOurs ? "hbar-row our" : "hbar-row";
      const val = formatNumber(c.volume);
      return `<div class="${cls}">
          <div class="hbar-name">${escapeHtml(c.name)}</div>
          <div class="hbar-track">
            <div class="hbar-fill" style="width: ${barW}%;"></div>
          </div>
          <span class="hbar-value">${val}</span>
        </div>`;
    })
    .join("\n        ");

  const insights = (s.insights || [])
    .map((item) => {
      const title = escapeHtml(item.title);
      const body = item.body;
      return `<div class="insight-card">
        <div class="insight-card-title">${title}</div>
        <div class="insight-card-body">${body}</div>
      </div>`;
    })
    .join("\n      ");

  const matrix =
    s.channelMatrix && s.channelMatrix.length > 0
      ? s.channelMatrix
      : buildChannelMatrixSkeleton(s.competitors);
  const channelTable = renderChannelTable(matrix);

  return `<div class="search-grid">
    <div class="search-chart-col">
      <div class="card">
        <div class="search-chart-title">브랜드 검색량 비교 (상호+진료과명 합산, PC/모바일)</div>
        <div class="hbar-list">${rows}</div>
      </div>
      <p class="search-volume-footnote">* 네트워크 병/의원은 통합검색량으로 조회됩니다.</p>
    </div>
    <div class="insight-cards">${insights}</div>
  </div>

  ${channelTable}`;
}

function renderSearchSection(r: AnalysisReport): string {
  const s = r.search!;
  return `  <div class="section-intro">
    <div class="section-num">03 · 검색량</div>
    <h2 class="section-title">검색량 및 <strong>디지털 채널</strong> 현황</h2>
    <p class="section-sub">진료과와 병원명을 입력하면 경쟁병원 브랜드 검색량·온라인 채널을 비교합니다.</p>
  </div>

  <div id="analysis-search-tool"></div>

  ${renderSearchResultsCore(s)}`;
}

type ChannelRow = NonNullable<
  NonNullable<AnalysisReport["search"]>["channelMatrix"]
>[number];

function renderChannelTable(matrix: ChannelRow[]): string {
  const body = matrix
    .map((row) => {
      const trCls = row.isOurs ? ' class="our"' : "";
      return `<tr${trCls}>
          <td>${escapeHtml(row.hospital)}</td>
          ${renderChannelCell(row.homepage)}
          ${renderChannelCell(row.blog)}
          ${renderChannelCell(row.cafe)}
          ${renderChannelCell(row.news)}
          ${renderChannelCell(row.kin)}
          ${renderChannelCell(row.sns)}
          ${renderChannelCell(row.video)}
        </tr>`;
    })
    .join("\n        ");

  const pendingNote = matrix.some((r) =>
    [r.homepage, r.blog, r.cafe, r.news, r.kin, r.sns, r.video].some(
      (v) => v === "—" || v === "-"
    )
  )
    ? `<p class="channel-table-note">일부 채널은 API 미연동·조회 실패로 비어 있을 수 있습니다.</p>`
    : "";
  const triangleLegend = matrix.some((r) =>
    [r.homepage, r.blog, r.cafe, r.news, r.kin, r.sns, r.video].some(
      (v) => v === "△"
    )
  )
    ? `<p class="channel-table-legend">* △ : 자체 채널은 없으나, 검색 결과에 병원명·지도 정보가 노출된 경우</p>`
    : "";

  return `<div class="card">
    <div class="card-label">채널 운영 비교</div>
    <table class="channel-table">
      <thead>
        <tr>
          <th>병원명</th>
          <th>홈페이지</th>
          <th>블로그</th>
          <th>카페/지역카페</th>
          <th>뉴스</th>
          <th>지식인</th>
          <th>SNS</th>
          <th>영상</th>
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
    ${triangleLegend}
    ${pendingNote}
  </div>`;
}

function renderChannelCell(value: string): string {
  const v = value.trim();
  if (v === "O") return '<td class="check-o">O</td>';
  if (v === "X") return '<td class="check-x">X</td>';
  if (v === "△") return '<td class="check-tri">△</td>';
  if (v === "—" || v === "-") return '<td class="check-pending">—</td>';
  const cls = /[/]/.test(v) ? "check-x" : "check-o";
  return `<td class="${cls}">${escapeHtml(v)}</td>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function writeAnalysisOutputs(
  report: AnalysisReport,
  html: string
): { jsonPath: string; htmlPath: string } {
  if (process.env.VERCEL) {
    throw new Error(
      "Vercel 환경에서는 파일을 저장할 수 없습니다. 로컬에서 npm run generate:analysis 실행 후 git push 하세요."
    );
  }

  const dataDir = path.join(process.cwd(), "data", "reports");
  const genDir = path.join(process.cwd(), "src", "content", "generated");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(genDir, { recursive: true });

  const jsonPath = path.join(dataDir, `${report.slug}.json`);
  const htmlPath = path.join(genDir, `${report.slug}-body.html`);

  const withPublish = {
    ...report,
    publish: {
      status: report.publish?.status ?? "draft",
      publishedAt: report.publish?.publishedAt,
      publicPath: report.publish?.publicPath ?? `/p/${report.slug}`,
    },
  };
  fs.writeFileSync(jsonPath, JSON.stringify(withPublish, null, 2), "utf8");
  fs.writeFileSync(htmlPath, html, "utf8");

  return { jsonPath, htmlPath };
}
