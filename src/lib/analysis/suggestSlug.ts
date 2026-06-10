function hashKey(key: string): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** 병원명 → 저장용 slug (영문 있으면 사용, 없으면 clinic-해시) */
export function suggestSlugFromClinicName(clinicName: string): string {
  const bare = clinicName
    .replace(/\s+/g, "")
    .replace(/(의원|병원|클리닉|센터|의료원|한의원|치과)$/u, "");
  const latin = bare.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (latin.length >= 3) return latin.slice(0, 40);

  return `clinic-${hashKey(bare)}`;
}

/** 개원 예정 등 병원명 없을 때 — 주소·진료과 기준 */
export function suggestSlugFromAddressSpecialty(
  address: string,
  specialty: string
): string {
  const key = `${address.replace(/\s+/g, "")}|${specialty.replace(/\s+/g, "")}`;
  return `planned-${hashKey(key)}`;
}
