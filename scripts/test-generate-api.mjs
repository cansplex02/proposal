const body = {
  clinicName: "부평그린마취통증의학과의원",
  specialty: "마취통증의학과",
  address: "인천 부평구 부평동",
  mainSearchKeyword: "부평 정형외과",
  radiusMeters: 1500,
  includeMapAds: true,
};

const r = await fetch("http://localhost:3000/api/analysis/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const j = await r.json();
console.log("status", r.status);
console.log("error", j.error);
console.log("rivalCount", j.rivalCount);
console.log("searchKeyword", j.searchKeyword);
console.log(
  "competitors",
  j.search?.competitors?.length,
  j.search?.competitors?.filter((c) => !c.isOurs).map((c) => c.name)
);
console.log("searchBodyLen", j.searchBody?.length);
console.log("warnings", j.warnings);
