import { redirect } from "next/navigation";

/** 리포트 생성 UI는 /analysis 히어로에 통합. secret만 쿼리로 전달 */
export default function AdminAnalysisPage() {
  redirect("/analysis?admin=1");
}
