/**
 * Cloudflare Email Worker for Mohasib
 *
 * Receives inbound emails addressed to *@mohasibai.com via Cloudflare Email Routing,
 * converts them to raw RFC 2822 text, and forwards to the Next.js inbound webhook.
 *
 * Bindings required (set in Cloudflare dashboard or wrangler.toml [vars]):
 *   APP_URL       — e.g. https://mohasibai.com  (no trailing slash)
 *   WORKER_SECRET — shared secret, must match WORKER_SECRET in Vercel env
 */
export default {
  async email(message, env, _ctx) {
    // Read the full raw email (RFC 2822) from the stream
    const raw = await new Response(message.raw).text();

    const subject = message.headers.get("subject") ?? "";

    const payload = JSON.stringify({
      to: message.to,
      from: message.from,
      subject,
      raw,
    });

    const res = await fetch(`${env.APP_URL}/api/email/inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": env.WORKER_SECRET ?? "",
      },
      body: payload,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[mohasib-email] inbound webhook failed ${res.status}: ${text}`);
      // Signal a temporary delivery failure so Cloudflare can retry instead of
      // silently accepting and losing the message.
      throw new Error(`Inbound webhook failed with HTTP ${res.status}`);
    } else {
      const json = await res.json().catch(() => ({}));
      console.log(`[mohasib-email] routed to ${json.dossier ?? "?"}, processed ${json.processed ?? 0} attachment(s)`);
      if (json.routed === false) {
        throw new Error(`Inbound message was not routed: ${json.reason ?? "unknown reason"}`);
      }
    }
  },
};
