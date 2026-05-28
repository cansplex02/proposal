import { redirect } from "next/navigation";

/** 별도 페이지 → 분석 페이지 키워드 섹션으로 이동 */
export default function AdminKeywordsRedirect() {
  redirect("/analysis#keywords");
}
