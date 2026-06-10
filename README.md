# CANSPLEX Proposal (Next.js)

캔즈플렉스 GEO 제안서 · 갤러리 · 경쟁분석을 Next.js로 제공합니다.

## 페이지

| 경로 | 설명 |
|------|------|
| `/` | GEO 제안서 |
| `/gallery` | 디자인 갤러리 |
| `/analysis` | 경쟁분석 · **섹션 03**에서 진료과·병원명 검색 후 리포트 생성 |
| `/admin/analysis` | `/analysis?admin=1` 로 이동 (secret 필드) |

## 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000

### 경쟁분석 직접 검색

1. http://localhost:3000/analysis — **03 검색량·디지털 채널** 섹션 폼
2. **진료과** · **병원명** → 필요 시「주소 찾기」
3.「경쟁분석 생성」(로컬, `.env.local` API 키 필요)

## 원본 HTML 재변환

상위 폴더의 HTML·이미지 수정 후:

```bash
npm run convert
```

## 배포

Vercel에 `proposal` 루트로 연결하거나:

```bash
npm run build
npx vercel --prod
```
