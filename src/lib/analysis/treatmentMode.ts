export type TreatmentMode = "surgery" | "nonsurgery";

/** 진료과 기본 주제에 수술/비수술 모드 적용 */
export function applyTreatmentModeTopics(
  topics: string[],
  specialty: string,
  mode: TreatmentMode
): string[] {
  const cleaned = topics.map((t) => t.trim()).filter(Boolean);
  const surgeryRx =
    /(수술|절제|시술|라식|라섹|스마일|백내장|임플란트|맘모톰|교정수술|수술후기|수술비용)/;

  let next =
    mode === "nonsurgery"
      ? cleaned.filter((t) => !surgeryRx.test(t))
      : cleaned.filter(Boolean);

  if (mode === "nonsurgery") {
    const specTrim = specialty.trim();
    if (specTrim === "피부과" || specTrim.includes("피부과")) {
      next = next.filter((t) => t !== "쁘띠" && t !== "쁘띠시술");
      next.push("내성발톱");
    } else if (
      specTrim === "비뇨의학과" ||
      specTrim === "비뇨기과" ||
      specTrim.includes("비뇨의학과") ||
      specTrim.includes("비뇨기과")
    ) {
      next = next.filter((t) => t !== "정관수술" && t !== "포경수술");
      for (const k of ["전립선염", "발기부전"]) {
        if (!next.includes(k)) next.push(k);
      }
    }
  } else if (
    specialty.trim() === "정형외과" ||
    specialty.trim().includes("정형외과")
  ) {
    const extras = [
      "관절내시경술",
      "척추내시경술",
      "허리수술",
      "무릎수술",
      "어깨수술",
      "회전근개봉합술",
    ];
    const main = specialty.trim();
    const rest = next.filter((t) => t !== main && !extras.includes(t));
    next = [main, ...extras, ...rest];
  } else if (
    specialty.trim() === "신경외과" ||
    specialty.trim().includes("신경외과")
  ) {
    const extras = ["척추내시경술", "허리수술", "디스크수술", "협착증수술"];
    const main = specialty.trim();
    const rest = next.filter((t) => t !== main && !extras.includes(t));
    next = [main, ...extras, ...rest];
  } else if (
    specialty.trim() === "성형외과" ||
    specialty.trim().includes("성형외과")
  ) {
    next = [...next, "안면거상"];
  } else if (
    specialty.trim() === "화상외과" ||
    specialty.trim().includes("화상외과")
  ) {
    next = [...next, "화상수술"];
  } else if (
    specialty.trim() === "산부인과" ||
    specialty.trim().includes("산부인과")
  ) {
    next = [...next, "임신중절수술", "낙태수술"];
  } else if (
    specialty.trim() === "비뇨의학과" ||
    specialty.trim() === "비뇨기과" ||
    specialty.trim().includes("비뇨의학과") ||
    specialty.trim().includes("비뇨기과")
  ) {
    next = next.filter((t) => t !== "전립선염" && t !== "발기부전");
    next = [...next, "정관수술", "포경수술"];
  }

  const specTrim = specialty.trim();
  if (
    specTrim === "신경과" ||
    specTrim === "신경외과" ||
    specTrim === "피부과" ||
    specTrim.includes("신경과") ||
    specTrim.includes("신경외과") ||
    specTrim.includes("피부과")
  ) {
    const rest = next.filter((t) => t !== specTrim && t !== "대상포진");
    next = [specTrim, "대상포진", ...rest];
  }

  return [...new Set(next)].filter(Boolean).slice(0, 12);
}
