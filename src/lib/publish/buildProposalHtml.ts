/** 병원별 제안서 HTML — CTA 「결과 확인」만 `/r/{slug}`로 연결 (갤러리는 `/gallery` 유지) */

export function buildClientProposalHtml(
  baseHtml: string,
  ctx: {
    slug: string;
    clinicName?: string;
    preview?: boolean;
  }
): string {
  const analysisHref = `/r/${encodeURIComponent(ctx.slug)}${
    ctx.preview ? "?preview=1" : ""
  }`;

  let html = baseHtml.replace(
    /<a href="\/analysis" class="cta-button"/g,
    `<a href="${analysisHref}" class="cta-button"`
  );

  if (ctx.clinicName?.trim()) {
    const name = escapeHtml(ctx.clinicName.trim());
    html = html.replace(
      /<strong>병원 분석\.<\/strong>/,
      `<strong>${name}</strong> 병원 분석.`
    );
  }

  return html;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
