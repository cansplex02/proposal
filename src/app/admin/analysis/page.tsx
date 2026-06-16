import { redirect } from "next/navigation";

export default function AdminAnalysisPage() {
  redirect("/studio/analysis?admin=1");
}
