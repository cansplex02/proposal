"use client";

import type { AnalysisReport } from "@/lib/analysis/types";
import { formatNumber, searchVolumeBarWidth } from "@/lib/analysis/utils";

export type SearchSectionData = NonNullable<AnalysisReport["search"]>;

type Props = {
  data: SearchSectionData;
  mapQuery?: string | null;
};

function channelCellClass(value: string): string {
  const v = value.trim();
  if (v === "O") return "check-o";
  if (v === "X") return "check-x";
  if (v === "△") return "check-tri";
  if (v === "—" || v === "-") return "check-pending";
  return /[/]/.test(v) ? "check-x" : "check-o";
}

export default function AnalysisSearchResults({ data, mapQuery }: Props) {
  const competitors = data.competitors ?? [];
  const rivals = competitors.filter((c) => !c.isOurs);
  const chartRows = competitors.filter(
    (c) => c.volume > 0 && !c.volumeEstimated
  );
  const max = Math.max(...chartRows.map((c) => c.volume), 1);
  const missingVolume = competitors.filter(
    (c) => c.volumeEstimated || c.volume <= 0
  ).length;
  const query = mapQuery ?? data.meta?.mapQuery;

  const matrix =
    data.channelMatrix && data.channelMatrix.length > 0
      ? data.channelMatrix
      : competitors.map((c) => ({
          hospital: c.name,
          isOurs: c.isOurs,
          homepage: "—",
          blog: "—",
          cafe: "—",
          news: "—",
          kin: "—",
          sns: "—",
          video: "—",
        }));

  const hasPending = matrix.some((r) =>
    [r.homepage, r.blog, r.cafe, r.news, r.kin, r.sns, r.video].some(
      (v) => v === "—" || v === "-"
    )
  );

  return (
    <>
      {query ? (
        <p className="analysis-search-query-note">
          네이버 지도 검색: <strong>{query}</strong> · 경쟁병원 {rivals.length}곳
          {data.meta?.radiusMetersUsed
            ? ` · 반경 ${(data.meta.radiusMetersUsed / 1000).toFixed(1)}km`
            : ""}
        </p>
      ) : null}

      {rivals.length === 0 ? (
        <p className="analysis-search-warn">
          반경 1.5km·동일 진료과 조건의 경쟁 병원이 없습니다. 주소·네이버 검색
          키워드를 확인하세요.
        </p>
      ) : null}

      <div className="search-grid">
        <div className="card">
          <div className="search-chart-title">
            브랜드 검색량 비교 (네이버 검색광고 월간, PC+모바일)
          </div>
          {chartRows.length === 0 && rivals.length > 0 ? (
            <p className="analysis-search-warn">
              {data.meta?.volumeFetchError
                ? `브랜드 검색량: ${data.meta.volumeFetchError}`
                : data.meta?.searchAdConfigured === false
                  ? "브랜드 검색량: NAVER_SEARCHAD_CUSTOMER_ID·API_KEY·SECRET_KEY를 .env.local 또는 Vercel 환경 변수에 설정하세요."
                  : `브랜드 검색량: 병원명 키워드 매칭 없음 (경쟁 ${rivals.length}곳, 검색량 표시 0곳). 키워드 도구에서 상호를 직접 조회해 비교하세요.`}
            </p>
          ) : null}
          <div className="hbar-list">
            {chartRows.map((c) => {
              const barW = searchVolumeBarWidth(c.volume, max);
              return (
                <div
                  key={c.name}
                  className={c.isOurs ? "hbar-row our" : "hbar-row"}
                >
                  <div className="hbar-name">{c.name}</div>
                  <div className="hbar-track">
                    <div
                      className="hbar-fill"
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                  <span className="hbar-value">{formatNumber(c.volume)}</span>
                </div>
              );
            })}
          </div>
          {missingVolume > 0 && chartRows.length > 0 ? (
            <p className="analysis-search-hint" style={{ marginTop: 12 }}>
              검색량 미조회 {missingVolume}곳은 막대에서 제외했습니다 (상호·API
              키워드 불일치).
            </p>
          ) : null}
        </div>

        <div className="insight-cards">
          {(data.insights ?? []).map((item) => (
            <div key={item.title} className="insight-card">
              <div className="insight-card-title">{item.title}</div>
              <div
                className="insight-card-body"
                dangerouslySetInnerHTML={{ __html: item.body }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-label">채널 운영 비교</div>
        <table className="channel-table">
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
            {matrix.map((row) => (
              <tr key={row.hospital} className={row.isOurs ? "our" : undefined}>
                <td>{row.hospital}</td>
                <td className={channelCellClass(row.homepage)}>
                  {row.homepage}
                </td>
                <td className={channelCellClass(row.blog)}>{row.blog}</td>
                <td className={channelCellClass(row.cafe)}>{row.cafe}</td>
                <td className={channelCellClass(row.news)}>{row.news}</td>
                <td className={channelCellClass(row.kin)}>{row.kin}</td>
                <td className={channelCellClass(row.sns)}>{row.sns}</td>
                <td className={channelCellClass(row.video)}>{row.video}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasPending ? (
          <p className="channel-table-note">
            일부 채널은 API 미연동·조회 실패로 비어 있을 수 있습니다.
          </p>
        ) : null}
      </div>
    </>
  );
}
