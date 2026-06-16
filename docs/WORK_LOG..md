# 경쟁분석·제안서 작업 일지 (2026-05-29)

CANSPLEX 제안서(`proposal`) 프로젝트에서 **섹션 03 검색량·디지털 채널** 경쟁분석 자동화와 UI/저장 구조를 정리·구현한 내용입니다.

---

## 1. 목표

- 네이버 지도·검색광고·오픈검색 API로 **경쟁병원·검색량·채널(O/△/X)** 수집
- 별도 생성 페이지 없이 **`/analysis` 섹션 03** 안에서 입력 → 결과 표시
- 샘플 리포트는 기본 숨김, 생성 후에만 결과 노출
- slug별 상세 URL 제거, 로컬 JSON 저장만 유지

---

## 2. UI 변경 (`/analysis` 섹션 03)

### 2.1 검색 폼 (`AnalysisSearchPanel.tsx`)

| 항목 | 내용 |
|------|------|
| 배치 | 섹션 03 인트로 아래 `#analysis-search-tool` (별도 `/analysis/create` 없음) |
| 1행 3열 | **진료과** · **병원명 (선택)** · **네이버 검색 키워드** |
| 2행 | **병원 주소** + 「주소 찾기」 (병원명 있을 때만 주소 자동 조회 가능) |
| 고급 설정 | 접기 메뉴 **제거** (키워드는 메인 행으로 이동) |
| placeholder | 진료과·병원명·주소 예시 문구 **제거** |
| URL slug 입력 | **제거** (서버에서 자동 생성만) |
| Admin Secret | `?admin=1` 일 때만 생성 버튼 옆 표시 |

### 2.2 결과 표시 (`AnalysisPageView.tsx`, `AnalysisSearchResults.tsx`)

- 생성 후 **페이지 이동 없음** — 폼 바로 아래 `#analysis-search-results`에 표시
- JSON 응답은 **React 컴포넌트**로 렌더 (막대·인사이트·채널 표); HTML 폴백(`searchBody`) 유지
- 생성 전: 「경쟁분석 생성」 안내 문구만 (강남 등 샘플 막대 **기본 숨김**)
- 생성 후: 결과 영역으로 스크롤

### 2.3 개원 예정 (병원명 없음)

- **진료과 필수**, **병원명 선택**
- 병원명 없으면 **주소 필수** (상권·반경·지도 검색 중심 좌표)
- 검색량 막대: **우리 병원 행 없음** (경쟁병원만)
- 인사이트: 「개원 예정」 기준 문구
- slug: `planned-{hash}` (`suggestSlugFromAddressSpecialty`)

---

## 3. 라우팅·페이지

| 변경 | 설명 |
|------|------|
| 삭제 | `src/app/analysis/[slug]/page.tsx` |
| 유지 | `src/app/analysis/page.tsx` 단일 페이지 |
| redirect | `next.config.ts`: `/analysis/:slug` → `/analysis` |

slug는 **공유 URL이 아님**. `data/reports/{slug}.json` 저장·재조회용 식별자만 사용.

---

## 4. API

| 경로 | 역할 |
|------|------|
| `POST /api/analysis/generate` | 리포트 생성, JSON+HTML 반환, 로컬 시 파일 저장 |
| `POST /api/analysis/resolve-address` | 병원명 → 주소 (네이버 지역검색) |
| `GET /api/analysis/report/[slug]` | 저장된 JSON 재조회 |

**generate 검증**

- 필수: `specialty`
- 주소: 병원명 없으면 입력 필수; 있으면 「주소 찾기」/자동 조회 후 없으면 400
- `ANALYSIS_ADMIN_SECRET`: production은 Bearer, development는 미설정·미전송 시 통과 가능

---

## 5. 수집·필터 로직 (신규·주요 모듈)

```
mainSearchKeyword (지역+진료과 또는 사용자 입력)
    → resolveMapPlaces (Playwright 지도 / 지역검색 폴백)
    → filterCompetitorPlaces (진료과·카테고리·시설 tier)
    → filterCompetitorsWithinRadiusAdaptive (1.5→2.5→3km 확대)
    → naverSearchAd 검색량
    → channelAudit (블로그·카페·뉴스·지식인·SNS·영상 O/△/X)
```

| 파일 | 역할 |
|------|------|
| `buildAutoSearch.ts` | 섹션 03 자동 조립 |
| `resolveMapPlaces.ts` | 지도 1페이지 경쟁사 |
| `naverMapCompetitors.ts` | Playwright 지도 스크래핑 |
| `naverLocalSearch.ts` | 지역검색 API, 좌표 보강, 주소 조회 |
| `competitorFilter.ts` | 진료과·상호 매칭·tier |
| `competitorRadius.ts` | 반경 필터·지역 힌트 |
| `naverSearchAd.ts` | 검색광고 검색량 |
| `channelAudit.ts` / `channelMarks.ts` | 채널 점검 |
| `searchInsights.ts` | 인사이트 A·B·E |
| `normalizeSearchPayload.ts` | API 응답 → 화면용 정규화 |
| `splitAnalysisBody.ts` | `analysis-body.html` → 섹션 03/04 분리 |

### 5.1 버그 수정 (경쟁사 2곳만 나오던 문제)

- 지역검색 **최대 50건**·좌표 매칭 (`enrichPlacesWithLocalCoords`)
- 반경 **1.5 → 2.5 → 3km** 단계 확대
- `splitSearchSection`: 섹션 4 마커 없을 때 `searchIntro`/`searchBody` 비어 폼 미노출 → `end` 보정

---

## 6. 결과 파일 위치

로컬에서 생성·저장 시 (Vercel 배포 환경에서는 디스크 저장 불가):

| 종류 | 경로 |
|------|------|
| JSON (원본) | `data/reports/{slug}.json` |
| HTML 조각 | `src/content/generated/{slug}-body.html` |
| CLI 입력 예 | `data/analysis-inputs/*.json` |

**slug 예**

- 병원명 있음: `bupyeong-green`, `clinic-18ujonm` 등
- 병원명 없음: `planned-6qezj7` 등

---

## 7. 환경·실행

`.env.local` (예시 키):

- 네이버 Open API (지역검색)
- SearchAD (검색량)
- 지도/지오코딩 (Playwright·Kakao 등 프로젝트 설정 따름)
- `ANALYSIS_ADMIN_SECRET` (선택)

```bash
# 개발 서버
npm run dev
# → http://localhost:3000/analysis (섹션 03 폼)

# CLI 리포트 생성
npm run generate:analysis -- --input data/analysis-inputs/bupyeong-green.json

# Playwright (지도 수집)
npx playwright install chromium
```

관리자 Secret UI: `http://localhost:3000/analysis?admin=1`

---

## 8. 알려진 제한

| 항목 | 내용 |
|------|------|
| Vercel | `writeAnalysisOutputs` 파일 저장 불가 → 로컬 생성 후 Git |
| 섹션 01~02 | 공공 API·365 미연동 시 0/placeholder |
| 섹션 04 | 키워드 맵은 `KeywordGeneratorPanel` 별도 |
| 채널 수집 | API·Playwright 실패 시 `—` 또는 부분 결과 |

---

## 9. 오늘 추가·수정된 주요 파일 (참고)

**컴포넌트**

- `src/components/AnalysisSearchPanel.tsx`
- `src/components/AnalysisSearchResults.tsx`
- `src/components/AnalysisPageView.tsx`

**API**

- `src/app/api/analysis/generate/route.ts`
- `src/app/api/analysis/resolve-address/route.ts`
- `src/app/api/analysis/report/[slug]/route.ts`

**스타일**

- `src/styles/analysis.css` (`.analysis-search-*`)

**기타**

- `src/lib/analysis/suggestSlug.ts`
- `src/lib/analysis/types.ts` (`clinicName` 선택, `SearchGeneratedPayload` 등)
- `docs/ANALYSIS_AUTOMATION.md` (기존 자동화 문서, 일부와 중복 가능)

---

## 10. 사용자 흐름 요약

1. `/analysis` → 섹션 03으로 스크롤
2. 진료과 입력 (+ 병원명·키워드·주소 선택)
3. 「경쟁분석 생성」 (1~2분)
4. 같은 페이지에서 경쟁병원 막대·인사이트·채널 표 확인
5. (로컬) `data/reports/{slug}.json` 자동 저장

---

## 11. 변경 이력 (2026-06-10)

> **운영 규칙:** 이후 모든 업데이트·버그 수정·배포는 이 섹션(또는 날짜별 하위 절)에 누적 기록한다.

### 11.1 UI·표시

| 항목 | 내용 |
|------|------|
| 섹션 01~04 | 분석 **생성 전**에는 숨김, 생성 후에만 노출 (`AnalysisPageView`) |
| 검색량 막대 | 실제 검색량 **비율**로 막대 높이 반영 (`AnalysisSearchResults`) |
| 반경 문구 | 그래프·카드에서 반경 km 문구 **제거** |
| 네트워크 안내 | `* 네트워크 병/의원은 통합검색량으로 조회됩니다.` — 그래프 **밖·오른쪽** footnote |
| 채널 표 | `△` 의미 설명 추가; 홈페이지 **영문 도메인** 오탐 수정 (`channelMarks.ts`) |
| placeholder | 진료과·병원명·주소 `예:` 문구 제거, 공략 키워드만 유지 (`AnalysisUnifiedForm`) |
| 통합 폼 | `AnalysisSearchPanel` → **`AnalysisUnifiedForm`** (섹션 01~04 한 번에 생성) |

### 11.2 검색량·키워드 로직 (`naverSearchAd.ts` 등)

| 항목 | 내용 |
|------|------|
| 마취통증 | `마취통증의학과` → `통증의학과` 후보 추가 |
| 지점명 | 의원 뒤 **지점·지역명** 제거 (예: `고려척척신경외과의원 부천` → `고려척척신경외과의원`) |
| 단독 지역명 | `부천` 등 **단독 지역 꼬리**도 제거 (`isBranchLocationTail`) |
| 집계 방식 | 후보 키워드 **합산 ❌ → 최댓값 1개 ✅** |
| 채널 수집 | `channelAudit.ts` — `mergeWebSearchHits` 배열 평탄화 버그 수정 |

### 11.3 상권지도 로딩 멈춤 수정 (2026-06-10)

**증상:** `소상공인365 상권지도 불러오는 중…` 에서 진행 없음.

**원인**

1. HTML 슬롯에 로딩 placeholder만 남고 React가 교체 실패 (DOM 타이밍)
2. `SBIZ365_MARKET_KEY` 미설정 → 365 iframe URL 없음 (`data-embed-url=""`)
3. 키 없을 때도 **정적 지도 fallback**이 떠야 하나 portal 미부착으로 로딩 문구만 유지

**수정**

| 파일 | 변경 |
|------|------|
| `src/lib/analysis/sbiz365MarketMap.ts` | `buildMarketMapSlotData()` 추가 |
| `src/lib/analysis/types.ts` | `MarketMapSlotData`, `SearchGeneratedPayload.marketMap` |
| `src/app/api/analysis/generate/route.ts` | 응답에 `marketMap` 포함 |
| `src/lib/analysis/renderHtml.ts` | 슬롯 내부 로딩 문구 제거 → 빈 `#analysis-market-map-slot` |
| `src/components/MarketMapSlot.tsx` | `createRoot` 직접 마운트 + `MutationObserver` 재연결 |
| `src/components/MarketRadiusMap.tsx` | embed 없으면 `/api/analysis/map-image` 정적 지도 fallback |
| `src/components/AnalysisPageView.tsx` | `marketMap` state → `MarketMapSlot` 전달 |
| `src/components/AnalysisUnifiedForm.tsx` | API `marketMap` payload 전달 |
| `src/app/api/analysis/map-image/route.ts` | 네이버 정적지도 → OSM fallback |
| `src/styles/analysis.css` | `.market-map-fallback`, `.market-map-static` |

**환경 변수**

| 변수 | 용도 | Vercel (2026-06-10) |
|------|------|---------------------|
| `SBIZ365_DETAIL_KEY` | 주거·직장 인구 (섹션 01) | ✅ 설정됨 |
| `SBIZ365_MARKET_KEY` | 365 상권지도 iframe | ❌ 미설정 → 정적 지도 fallback |

### 11.4 배포

| 항목 | 내용 |
|------|------|
| URL | `https://proposal-seven-chi.vercel.app/analysis` |
| 커밋 (참고) | `2858175` 채널·검색량 UI · `ffd2921` placeholder · `8741fbc` 단독 지역명 검색량 보정 |
| 상권지도 수정 | 로컬 빌드 확인 완료, **배포·커밋 대기** (사용자 미요청) |

### 11.5 알려진 제한 (갱신)

| 항목 | 내용 |
|------|------|
| 섹션 01 인구 0 | Vercel에 `SBIZ365_DETAIL_KEY` 없을 때 → 키 추가 후 해결 |
| 상권지도 | `SBIZ365_MARKET_KEY` 없으면 365 iframe 대신 **정적 지도** + 「365에서 크게 보기」 링크 |
| UI 문구 | `renderHtml.ts`에 `상호+진료과명 합산` 문구 잔존 — 실제 로직은 **최댓값** (정리 여지) |
| 구 generated HTML | `src/content/generated/*` 일부에 구 로딩 문구 포함 — **재생성** 시 새 슬롯 구조 적용 |

### 11.6 접속 500 · CSS 없음 (2026-06-10) — **해결**

**증상:** `localhost:3000` 접속 즉시 500, 스타일 전부 사라짐 (CSS 파일 문제 아님).

**원인:** `.next` **캐시 손상** — dev 서버 가동 중 `npm run build` 등으로 webpack 청크 불일치.

```
Cannot find module './611.js'
Require stack: ...\.next\server\webpack-runtime.js
```

**조치:** `npm run dev:reset` (포트 3000~3002 종료 → `.next` 삭제 → `next dev` 재시작)

**확인:** `GET /analysis` → **200**, `analysis/page.css`·`layout.css` 로드 정상.

> dev 중 production build 후 페이지가 깨지면 **항상 `npm run dev:reset`** 먼저 시도.

### 11.7 오류 점검 (2026-06-10)

**빌드·린트:** `npm run build` ✅ · `npm run lint` — **에러 0**, 경고 9 (미사용 변수·`<img>` 권고, debug 스크립트)

| 심각도 | 오류 | 원인 | 상태 |
|--------|------|------|------|
| 🔴 | `/api/analysis/map-image` **500** `fetch failed` | 네이버 정적지도 **403** → OSM `staticmap.de` **연결 실패** → fallback 없음 | ✅ OSM **타일 fallback** (`tile.openstreetmap.org`) 추가 후 **200** |
| 🟠 | 365 상권지도 iframe 없음 | `SBIZ365_MARKET_KEY` 로컬·Vercel **미설정** | 정적 지도 fallback으로 대체 (키 발급 시 iframe 가능) |
| 🟠 | 네이버 정적지도 403 | `NAVER_MAP_CLIENT_ID`는 있으나 **Static Map API** 권한·앱 설정 불일치 추정 | OSM 타일로 우회; NCP 콘솔에서 Static Map 활성화 필요 |
| 🟡 | UI 문구 불일치 | `renderHtml.ts`·구 generated HTML: `상호+진료과명 합산` — 실제는 **후보 최댓값** | `AnalysisSearchResults.tsx`는 올바른 문구 사용 중 |
| 🟡 | 구 상권지도 HTML | 일부 `generated/*`에 `불러오는 중…` placeholder | **재생성** 필요 |
| ⚪ | `geocode-regions/route.ts` | `fetchNearbyStations`·`fetchNearbyDongs` 미사용 | 동작 영향 없음 |

**API 스모크 (로컬)**

- `POST /api/analysis/generate` → 200, 인구·`marketMap` 정상
- `GET /api/analysis/map-image` → 수정 전 500 → 수정 후 **200 image/png**

---

### 11.8 상권지도 UI 깨짐·흐림 (2026-06-10)

**증상:** 지도 흐림, 주소·안내 문구 겹침, `반경 1.5km · 정적 지도` 표시.

**원인**

1. `SBIZ365_MARKET_KEY` 없음 → 365 iframe 대신 **OSM 단일 타일(256px)** 을 640px로 늘려 표시
2. `map-area-footer`가 `position:absolute`로 지도·노란 안내 박스 위에 겹침
3. `mapNote`(주소+반경)와 footer 주소 **중복**

**수정:** fallback을 OSM **embed iframe**으로 교체, static 모드 footer를 지도 **아래** 배치 (`map-area--static`, `map-area-footer--static`)

**추가 (하단 빈 영역):** 왼쪽 차트 카드와 `align-items:stretch`로 높이가 맞춰지는데 OSM iframe만 288px + `justify-content:center` → 회색 여백.

**지도 꽉 채움 (2026-06-10):** iframe `position:absolute; inset:0`, 푸터는 지도 위 오버레이, 카드 패딩까지 negative margin으로 맞춤 (`analysis-market-map-root`).

---

## 12. 작업실 / 공개 뷰 분리 (2026-06-10)

### 12.1 URL 구조

| 역할 | 경쟁분석 | 디자인 갤러리 |
|------|----------|----------------|
| 작업실 | `/studio/analysis` (`?admin=1`, `?slug=`) | `/studio/gallery` |
| **고객 공유 링크** | `/p/{slug}` 제안서 메인 | (보류) |
| CTA 「결과 확인」 | `/r/{slug}` 경쟁분석 | — |
| CTA 「캔즈플렉스 디자인」 | **`/gallery` 원본 갤러리** (작업실 `/studio/gallery`·`/g/` 연동 보류) |

### 12.3 결과 수동 수정 (2026-06-10)

`/analysis`(·`/studio/analysis`)에서 **전체 분석 생성** 후 각 섹션 아래 수동 보정:

| 섹션 | 수동 수정 |
|------|-----------|
| **03 검색량·디지털 채널** | 경쟁병원 추가·삭제, 검색량, 채널 O/△/X, 인사이트 |
| 01·02·04 | 자동 생성만 (수동 수정 없음) |

- `PATCH /api/analysis/report/{slug}` — `search`·`population`·`market`·`keywords` 부분 저장
- 이미 **발행됨** 상태면 저장 시 공개본(`/r/`) 자동 재발행
- **버튼 가시성:** 밝은 본문에서 `studio-btn--ghost` 흰 글씨 → 파란 윤곽 버튼으로 수정, 생성 직후 패널 **기본 펼침**
- **공유 링크:** 생성 직후 숨김 → 섹션 03 수정 후 **「개별링크 만들기」** → `/p/{slug}` 복사·열기 (자동 발행 제거)

### 12.4 dev 서버 500 · 생성 안 됨 (2026-06-12)

**증상:** `/`·`/analysis` 500, CSS 깨짐, 분석 생성 후 화면 갱신 실패

**원인:** `.next` 캐시 손상 (`Cannot find module './611.js'`, `__webpack_modules__[moduleId] is not a function`) — `npm run build`와 `npm run dev` 동시 실행·HMR 중단 시 흔함

**해결:** `npm run dev:reset` (`.next` 삭제 후 dev 재시작)

**확인:** reset 후 `/`·`/analysis` 200, `POST /api/analysis/generate` 200
| 구 URL | `/analysis` → 작업실 redirect | `/gallery` → 작업실 redirect |
| 구 slug URL | `/analysis/:slug` → `/r/:slug` | — |

### 12.2 저장·발행

| 경로 | 용도 |
|------|------|
| `data/reports/{slug}.json` | 경쟁분석 **draft** |
| `data/published/reports/{slug}.json` | **발행** 스냅샷 (공개 뷰만 읽음) |
| `data/reports-index.json` | 메인 제안서 버튼 연결용 인덱스 |
| `data/galleries/{slug}.json` | 갤러리 draft |
| `data/published/galleries/{slug}.json` | 갤러리 발행 |
| `data/galleries-index.json` | 갤러리 인덱스 |

**API**

- `POST /api/analysis/publish/[slug]` — 발행
- `PATCH /api/analysis/report/[slug]` — 섹션 03 수동 저장
- `PUT /api/gallery/[slug]` · `POST /api/gallery/publish/[slug]`
- `GET /api/publish/index` — 인덱스 조회

### 12.3 작업실 기능

- **경쟁분석:** 생성 → `SearchSectionEditor` (검색량·채널·인사이트) → **공개 발행**
- **갤러리:** HTML 편집·draft 저장 → **공개 발행**
- Admin Secret: `?admin=1` + toolbar/폼 secret 입력

### 12.5 작업실 링크 복사 UI (2026-06-10)

- 생성 후 결과 영역 위 `PublicLinkCopy` — 전체 URL 표시 · **링크 복사** · 열기
- 미발행 시 안내: 발행 후 `/r/{slug}` 활성화
- **생성 시 자동 발행** (`generate` API) — 링크 복사 직후 `/r/{slug}` 접속 가능
- 섹션 03 수동 수정 후 **「다시 발행」** 으로 공개본 갱신

### 12.4 메인 제안서 연결

병원별 제안서 CTA `href`를 발행된 공개 URL로 설정:

- 고객 공유 → `/p/{slug}` (제안서) → 「결과 확인」→ `/r/{slug}`
- 캔즈플렉스 디자인 → `/g/{slug}`

(인덱스: `data/reports-index.json`, `data/galleries-index.json`)

---

*최초 작성: 2026-05-29 · 최종 갱신: 2026-06-10*
