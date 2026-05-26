# 배포 가이드 (proposal)

## 프로젝트 위치

`캔즈플렉스제안서/proposal`

로컬 개발 서버는 이 폴더에서 실행하세요:

```bash
cd proposal
npm run dev
```

> 예전 `cansplex-web` 폴더의 `npm run dev`는 종료한 뒤, 필요 없으면 폴더를 삭제해도 됩니다.

---

## 1. GitHub 업로드

터미널에서 `proposal` 폴더로 이동 후:

```bash
gh auth login
```

로그인 후:

```bash
gh repo create cansplex-proposal --public --source=. --remote=origin --push
```

(비공개 저장소는 `--private`로 변경)

이미 원격이 있으면:

```bash
git remote add origin https://github.com/YOUR_USERNAME/cansplex-proposal.git
git push -u origin main
```

---

## 2. Vercel 웹 배포

```bash
npx vercel login
npx vercel --prod
```

또는 [vercel.com](https://vercel.com) → **Add New Project** → GitHub 저장소 `proposal` 연결 → Deploy

- **Root Directory**: `proposal` (모노레포인 경우) 또는 저장소 루트
- **Framework**: Next.js (자동 감지)

배포 후 URL 예: `https://cansplex-proposal.vercel.app`

---

## 로컬 빌드 확인

```bash
npm run build
npm start
```
