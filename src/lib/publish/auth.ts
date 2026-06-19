export function isAdminAuthorized(req: Request): boolean {
  const secret = process.env.ANALYSIS_ADMIN_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export function adminUnauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
