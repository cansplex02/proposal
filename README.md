# CANSPLEX Proposal (Next.js)

캔즈플렉스 GEO 제안서 · 갤러리 · 경쟁분석을 Next.js로 제공합니다.

## 페이지

| 경로 | 설명 |
|------|------|
| `/` | GEO 제안서 |
| `/gallery` | 디자인 갤러리 |
| `/analysis` | 경쟁분석 샘플 |

## 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000

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
