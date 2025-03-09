export default {
  async fetch(request) {
    const url = new URL(request.url);
    const slug = url.pathname.substring(1);

    if (slug === "stats") {
      return handleStats(request);
    }

    // Fetch shortlink from Cloudflare KV
    const shortURL = await CLICKSY.get(slug);
    if (!shortURL) {
      return new Response("Shortlink not found!", { status: 404 });
    }

    // Capture visitor details
    const referrer = request.headers.get("Referer") || "Direct";
    const userAgent = request.headers.get("User-Agent");
    const ip = request.headers.get("CF-Connecting-IP");
    const country = request.headers.get("CF-IPCountry");
    const city = request.headers.get("CF-Visitor") || "Unknown City";
    const refDomain = referrer !== "Direct" ? new URL(referrer).hostname : "Direct";
    const isBot = /bot|crawl|spider/i.test(userAgent);
    const clickType = isBot ? "bad" : "good";

    // Store analytics in Cloudflare D1
    await DB.prepare(`INSERT INTO analytics (slug, referrer, refDomain, ip, country, city, clickType, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(slug, referrer, refDomain, ip, country, city, clickType, Date.now())
      .run();

    // Redirect to the original URL
    return Response.redirect(shortURL, 301);
  }
};

async function handleStats(request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  let query = `SELECT refDomain, COUNT(*) as totalClicks, 
              SUM(clickType = 'good') as goodClicks, 
              SUM(clickType = 'bad') as badClicks 
              FROM analytics`;
  if (domain) query += ` WHERE refDomain = ?`;
  query += ` GROUP BY refDomain ORDER BY totalClicks DESC`;

  const result = domain ? await DB.prepare(query).bind(domain).all() : await DB.prepare(query).all();
  return new Response(JSON.stringify(result.results), { headers: { "Content-Type": "application/json" } });
}
