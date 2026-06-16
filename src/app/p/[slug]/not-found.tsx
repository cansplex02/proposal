import Link from "next/link";
import "@/styles/studio.css";

export default function ClientProposalNotFound() {
  return (
    <main className="studio-not-found">
      <h1>제안서를 찾을 수 없습니다</h1>
      <p>
        이 링크는 발행된 병원 제안서용입니다. 작업실에서 분석을 생성·발행한
        뒤 공유 링크를 사용해 주세요.
      </p>
      <p>
        <Link href="/studio/analysis?admin=1">작업실로 이동</Link>
      </p>
    </main>
  );
}
