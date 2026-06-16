import Link from "next/link";
import "@/styles/studio.css";

export default function PublicReportNotFound() {
  return (
    <main className="studio-not-found">
      <h1>경쟁분석 결과를 찾을 수 없습니다</h1>
      <p>
        이 링크는 <strong>공개 발행</strong>된 리포트만 열립니다. 작업실에서
        분석을 생성한 뒤 「공개 발행」을 눌러 주세요.
      </p>
      <p>
        <Link href="/studio/analysis?admin=1">작업실로 이동</Link>
      </p>
    </main>
  );
}
