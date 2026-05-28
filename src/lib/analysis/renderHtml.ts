import fs from "fs";
import path from "path";
import type { AnalysisReport, PopulationRow } from "./types";
import { formatNumber, pct } from "./utils";

const contentDir = path.join(process.cwd(), "src", "content");

export function loadAnalysisTemplate(): string {
  return fs.readFileSync(path.join(contentDir, "analysis-body.html"), "utf8");
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
  html = replaceBlock(html, "KEYWORDS", renderKeywordSection(report));

  if (report.search?.competitors?.length) {
    html = replaceBlock(html, "SEARCH", renderSearchSection(report));
  }

  if (report.meta?.warnings?.length) {
    const note = `<p class="section-sub" style="margin-top:-40px;color:#b45309;">⚠ ${escapeHtml(report.meta.warnings.join(" · "))}</p>`;
    html = html.replace(
      '<p class="hero-sub">',
      `${note}\n    <p class="hero-sub">`
    );
  }

  return html;
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
  return `  <div class="section-num">01 · Demographics</div>
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

function populationCard(
  label: string,
  row: PopulationRow,
  variant: "home" | "work"
): string {
  const peakIdx = [
    row.ages.under10,
    row.ages.teens,
    row.ages.twentiesThirties,
    row.ages.fortiesFifties,
    row.ages.sixtiesPlus,
  ].indexOf(
    Math.max(
      row.ages.under10,
      row.ages.teens,
      row.ages.twentiesThirties,
      row.ages.fortiesFifties,
      row.ages.sixtiesPlus
    )
  );

  const hl = (i: number) => (i === peakIdx ? ' class="highlight"' : "");

  if (variant === "work") {
    const t = row.ages.twentiesThirties;
    const approx30 = Math.round(t * 0.58);
    const approx20 = t - approx30;
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
              <td>${formatNumber(row.total)}</td><td>${formatNumber(row.male)}</td><td>${formatNumber(row.female)}</td>
              <td>${formatNumber(approx20)}</td><td${hl(1)}>${formatNumber(approx30)}</td>
              <td>${formatNumber(Math.round(row.ages.fortiesFifties * 0.5))}</td>
              <td>${formatNumber(Math.round(row.ages.fortiesFifties * 0.5))}</td>
              <td>${formatNumber(row.ages.sixtiesPlus)}</td>
            </tr>
            <tr>
              <td class="label">비율(%)</td>
              <td>100</td><td>${pct(row.male, row.total)}</td><td>${pct(row.female, row.total)}</td>
              <td>${pct(approx20, row.total)}</td><td${hl(1)}>${pct(approx30, row.total)}</td>
              <td>${pct(row.ages.fortiesFifties * 0.5, row.total)}</td>
              <td>${pct(row.ages.fortiesFifties * 0.5, row.total)}</td>
              <td>${pct(row.ages.sixtiesPlus, row.total)}</td>
            </tr>
          </tbody>
        </table>
      </div></div>
    </div>`;
  }

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
            <td>${formatNumber(row.total)}</td><td>${formatNumber(row.male)}</td><td>${formatNumber(row.female)}</td>
            <td>${formatNumber(row.ages.under10)}</td><td>${formatNumber(row.ages.teens)}</td>
            <td${hl(2)}>${formatNumber(row.ages.twentiesThirties)}</td>
            <td>${formatNumber(row.ages.fortiesFifties)}</td>
            <td${hl(4)}>${formatNumber(row.ages.sixtiesPlus)}</td>
          </tr>
          <tr>
            <td class="label">비율(%)</td>
            <td>100</td><td>${pct(row.male, row.total)}</td><td>${pct(row.female, row.total)}</td>
            <td>${pct(row.ages.under10, row.total)}</td><td>${pct(row.ages.teens, row.total)}</td>
            <td${hl(2)}>${pct(row.ages.twentiesThirties, row.total)}</td>
            <td>${pct(row.ages.fortiesFifties, row.total)}</td>
            <td${hl(4)}>${pct(row.ages.sixtiesPlus, row.total)}</td>
          </tr>
        </tbody>
      </table>
    </div></div>
  </div>`;
}

function renderMarketSection(r: AnalysisReport): string {
  const max = Math.max(...r.market.facilities.map((f) => f.count), 1);
  const bars = r.market.facilities
    .map((f) => {
      const h = Math.max(4, Math.round((f.count / max) * 95));
      return `<div class="facility-bar-group">
          <div class="facility-bar-value">${formatNumber(f.count)}</div>
          <div class="facility-bar" style="height: ${h}%; background: ${f.color || "#2b5cd9"};"></div>
        </div>`;
    })
    .join("\n        ");
  const labels = r.market.facilities
    .map((f) => `<span>${escapeHtml(f.label)}</span>`)
    .join("\n        ");

  const bullets = r.market.summaryBullets
    .map((b) => `<li>${b}</li>`)
    .join("\n      ");
  const mini = r.market.miniCards
    .map(
      (m) => `<div class="mini-card">
      <div class="mini-card-title">${escapeHtml(m.title)}</div>
      <div class="mini-card-sub">${escapeHtml(m.sub)}</div>
    </div>`
    )
    .join("\n    ");

  return `  <div class="section-num">02 · Local Market</div>
  <h2 class="section-title">주변시설 및 <strong>상권 기본 정보</strong></h2>
  <p class="section-sub">반경 ${r.radiusKm}km 인프라 및 상권 핵심 지표 (상가 API 집계).</p>

  <div class="market-grid">
    <div class="card">
      <div class="card-label">주변 업종 현황 (${r.radiusKm}km)</div>
      <div class="facility-chart">${bars}</div>
      <div class="facility-labels">${labels}</div>
    </div>
    <div class="card">
      <div class="card-label">상권 기본 정보 (반경 ${r.radiusKm}km)</div>
      <div class="map-area">
        <div class="map-placeholder-text">
          <div class="map-placeholder-title">${escapeHtml(r.address)}</div>
          <div class="map-placeholder-sub">${escapeHtml(r.market.mapNote || "")}</div>
          <div class="map-placeholder-sub">위도 ${r.coordinates.lat.toFixed(5)} · 경도 ${r.coordinates.lng.toFixed(5)}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="card summary-card">
    <div class="card-label">상권 조사 주요 요약</div>
    <ul class="summary-list">${bullets}</ul>
  </div>

  <div class="mini-cards">${mini}</div>`;
}

function renderKeywordSection(r: AnalysisReport): string {
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

  return `  <div class="section-num">04 · Keyword Map</div>
  <h2 class="section-title">지역·진료 <strong>공략키워드</strong></h2>
  <p class="section-sub">${escapeHtml(r.keywords.subtitle)}</p>

  <div class="keyword-table-wrap">
    <table class="keyword-table">
      <thead><tr><th>지역</th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>

  <div class="strategy-cards">${cards}</div>`;
}

function renderSearchSection(r: AnalysisReport): string {
  const s = r.search!;
  const max = Math.max(...s.competitors.map((c) => c.volume), 1);
  const rows = s.competitors
    .map((c) => {
      const w = Math.round((c.volume / max) * 100);
      const cls = c.isOurs ? "hbar-row our" : "hbar-row";
      return `<div class="${cls}">
          <div class="hbar-name">${escapeHtml(c.name)}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width: ${w}%;"></div></div>
          <div class="hbar-value">${formatNumber(c.volume)}</div>
        </div>`;
    })
    .join("\n        ");

  const insights = (s.insights || [])
    .map(
      (text) => `<div class="insight-card"><div class="insight-card-body">${text}</div></div>`
    )
    .join("\n      ");

  return `  <div class="section-num">03 · Search Volume</div>
  <h2 class="section-title">검색량 및 <strong>디지털 채널</strong> 현황</h2>
  <p class="section-sub">경쟁 병원 브랜드 검색 겹차 (수동·네이버 데이터 입력).</p>
  <div class="search-grid">
    <div class="card">
      <div class="search-chart-title">브랜드 검색량 비교</div>
      <div class="hbar-list">${rows}</div>
    </div>
    <div class="insight-cards">${insights}</div>
  </div>`;
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

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(htmlPath, html, "utf8");

  return { jsonPath, htmlPath };
}
