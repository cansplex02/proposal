import Link from "next/link";

type Props = { slug: string; clinicName?: string };

export default function PublicAnalysisNav({ slug, clinicName }: Props) {
  return (
    <nav className="public-analysis-nav">
      <Link href={`/p/${slug}`} className="public-analysis-nav-back">
        ← 제안서로 돌아가기
      </Link>
      {clinicName ? (
        <span className="public-analysis-nav-title">{clinicName} · 경쟁분석</span>
      ) : null}
    </nav>
  );
}
