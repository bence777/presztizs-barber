import { authApi, jsonOnly, safeApiError } from "../../../lib/server/guestAuth";
export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };

export default async function handler(req, res) {
  if (!jsonOnly(req, res, "POST")) return;
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Adj meg egy érvényes e-mail-címet." });
  }
  try {
    const result = await authApi("otp", { method: "POST", body: { email, create_user: true } });
    if (result.status === 429) {
      return res.status(429).json({ error: "Túl sok kérés. Várj legalább egy percet az új kód előtt." });
    }
    // Do not disclose if a specific email has a saved profile.
    if (!result.ok) {
      console.warn("[guest-auth] otp dispatch failed", result.status);
      return res.status(503).json({ error: "Most nem sikerült elküldeni a kódot. Próbáld újra később." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) { return safeApiError(res, error, "send-code"); }
}
