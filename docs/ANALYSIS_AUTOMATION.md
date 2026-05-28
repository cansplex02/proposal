# 경쟁분석 반자동화 가이드

`CANSPLEX_Analysis_Sample.html` 구조를 유지하면서, **제안서(병원)마다** 상권·키워드 데이터를 채워 넣는 워크플로입니다.

## API 구성 (2종)

| 용도 | 출처 | 환경변수 |
|------|------|----------|
| 주소 → 위·경도 | **네이버 Maps Geocoding** (우선) 또는 카카오 로컬 | `NAVER_MAP_CLIENT_ID` + `NAVER_MAP_CLIENT_SECRET` / `KAKAO_REST_API_KEY` |
| 반경 1.5km **상가·업종** 집계 | [공공데이터포털 상가(상권)정보](https://www.data.go.kr/data/15012005/openapi.do) | `DATA_GO_KR_SERVICE_KEY` |
| **주거·직장·유동 인구** (365 화면과 동일 계열) | [소상공인365](https://bigdata.sbiz.or.kr/#/) 오픈 API | `SBIZ365_API_KEY` + `SBIZ365_POPULATION_PATH` |

> 소상공인365 웹 UI([bigdata.sbiz.or.kr](https://bigdata.sbiz.or.kr/#/))와 동일 브랜드이나, **인구·매출 등 집계 API**는 365 포털에서 별도 신청·명세 확인이 필요합니다.  
> 마이페이지 → 오픈 API 신청현황에서 **상세분석(반경)** 등 사용 API의 **정확한 URL**을 `SBIZ365_POPULATION_PATH`에 넣으세요.

## 제안서 1건 만들기 (권장 루틴)

### 1) 입력 JSON 작성

`data/analysis-inputs/병원slug.json`

```json
{
  "slug": "gangnam-skin",
  "clinicName": "○○피부과",
  "address": "서울 서초구 서초대로 365",
  "specialty": "피부과",
  "regions": ["강남", "서초동", "양재역"],
  "radiusMeters": 1500,
  "overrides": {
    "search": {
      "competitors": [
        { "name": "경쟁A", "volume": 1200 },
        { "name": "○○피부과", "volume": 450, "isOurs": true }
      ]
    }
  }
}
```

- **자동**: 상권 업종 차트, 키워드 표, 좌표·주소
- **수동 overrides**: 네이버 검색량·채널표·인구(365 API 미연동 시)

### 2) 생성 실행 (로컬)

```bash
cd proposal
cp .env.example .env.local   # 키 입력
npm run generate:analysis -- --input data/analysis-inputs/gangnam-skin.json
```

생성물:

- `data/reports/{slug}.json` — 원본 데이터
- `src/content/generated/{slug}-body.html` — 페이지 HTML

### 3) 확인 · 배포

- 미리보기: `http://localhost:3000/analysis/{slug}`
- 샘플(수동 HTML): `/analysis`
- `git add` → `push` → Vercel 재배포

### 4) 제안서에 링크

제안서 CTA 또는 병원분석 섹션 링크를 `/analysis/{slug}` 로 연결합니다.

---

## 키워드 자동 생성

**규칙**: `{지역}{진료주제}` 조합 (예: `양재역` + `유방초음파` → `양재역유방초음파`)

- **지역**: `--regions` 또는 주소에서 동·역·구 추출
- **주제**: `--topics` 또는 `src/lib/analysis/specialties.ts` 의 진료과 템플릿

진료과 템플릿 추가는 `specialties.ts` 에 한 줄씩 확장하면 됩니다.

### 효과적인 키워드 운영 팁

1. **1차(지역+핵심과)**: 피부과, ○○역피부과  
2. **2차(증상·시술)**: 여드름, 레이저토닝  
3. **3차(차별)**: 여의사, 야간진료, 전문의  
4. 제안서마다 `regions` 6~10개(역·동·대표 상권명) 유지 → 표 가독성

네이버 키워드 도구 / 검색광고 플래너로 **검색량 상위 3~5개**만 골라 `keywordTopics` 앞에 넣으면 품질이 올라갑니다.

---

## 매 제안서 워크플로 (팀용)

| 단계 | 담당 | 도구 |
|------|------|------|
| 주소·진료과 접수 | 기획 | 슬랙/노션 |
| `analysis-inputs/{slug}.json` | 기획 | 5분 |
| `npm run generate:analysis` | 개발 또는 기획(로컬) | 1분 |
| 검색량·경쟁사 표 | 마케팅 | overrides JSON |
| 인구 0이면 365에서 수치 복사 | 마케팅 | overrides.population |
| `/analysis/{slug}` QA | 기획 | 브라우저 |
| 배포 | 개발 | git push |

**폴더 규칙**

- `data/analysis-inputs/` — 사람이 쓰는 입력 (Git 보관)
- `data/reports/` — API 결과 JSON (Git 보관)
- `src/content/generated/` — 빌드용 HTML (Git 보관)

---

## 웹 UI (로컬)

`http://localhost:3000/admin/analysis`

- 주소·진료과만 넣고 생성 (로컬 dev 전용, Vercel에서는 파일 저장 불가)

## API (로컬 자동화)

```http
POST /api/analysis/generate
Authorization: Bearer {ANALYSIS_ADMIN_SECRET}
Content-Type: application/json

{ "slug", "clinicName", "address", "specialty", "regions?", "keywordTopics?" }
```

---

## 한계 · 보완

- **검색량·채널 비교**는 네이버 데이터라 API 자동화 없음 → `overrides.search` 수동
- **지도 이미지**는 Kakao Static Map 등 추가 연동 가능 (현재는 좌표·주소 텍스트)
- 365 인구 API 경로는 **발급 문서마다 다를 수 있음** → 연결 안 되면 `overrides.population` 사용
