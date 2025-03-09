// User-Agent parser
function parseUserAgent(ua) {
  const device = /Mobile|Tablet|iPad|iPhone|Android/i.test(ua) ? (/Tablet|iPad/i.test(ua) ? "Tablet" : "Mobile") : "Desktop";
  const browser = /Chrome|Safari|Firefox|Edge|Opera|MSIE/i.exec(ua)?.[0] || "Unknown";
  const os = /Windows|Mac OS|Linux|Android|iOS/i.exec(ua)?.[0] || "Unknown";
  return { device, browser, os };
}

// Source type detection
function detectSource(referrer) {
  if (!referrer || referrer === "Direct") return "direct";
  const domain = new URL(referrer).hostname;
  if (/google|bing|yahoo/i.test(domain)) return "search";
  if (/facebook|twitter|instagram|linkedin/i.test(domain)) return "social";
  return "other";
}

// Durable Object for real-time analytics
export class LiveAnalytics {
  constructor(state) {
    this.state = state;
    this.clients = new Set();
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const clientWs = webSocketPair[0];
    const serverWs = webSocketPair[1];

    serverWs.accept();
    this.clients.add(serverWs);

    serverWs.addEventListener("close", () => this.clients.delete(serverWs));
    return new Response(null, { status: 101, webSocket: clientWs });
  }

  async broadcast(data) {
    const msg = JSON.stringify(data);
    for (const client of this.clients) {
      client.send(msg);
    }
  }
}

export default {
  async fetch(request, env) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const slug = url.pathname.substring(1);

    if (slug === "stats") return handleStats(request, env);
    if (slug === "live") return env.LIVE_ANALYTICS.fetch(request);

    // Rate limiting (max 100 requests/hour per IP)
    const ip = request.headers.get("CF-Connecting-IP");
    const rateKey = `rate:${ip}`;
    let rateCount = parseInt(await env.CLICKSY.get(rateKey)) || 0;
    if (rateCount > 100) {
      return new Response("Rate limit exceeded", { status: 429 });
    }
    await env.CLICKSY.put(rateKey, rateCount + 1, { expirationTtl: 3600 });

    // Fetch shortlink
    const shortURL = await env.CLICKSY.get(slug, { cacheTtl: 3600 });
    if (!shortURL) {
      return new Response("Shortlink not found!", { status: 404 });
    }

    // Detailed tracking
    const referrer = request.headers.get("Referer") || "Direct";
    const userAgent = request.headers.get("User-Agent") || "Unknown";
    const country = request.headers.get("CF-IPCountry") || "Unknown";
    const city = request.headers.get("CF-Visitor") || "Unknown";
    const refDomain = referrer !== "Direct" ? new URL(referrer).hostname : "Direct";
    const isBot = /bot|crawl|spider/i.test(userAgent);
    const clickType = isBot ? "bad" : (rateCount > 50 ? "suspicious" : "good");
    const { device, browser, os } = parseUserAgent(userAgent);
    const queryParams = url.searchParams.toString();
    const sessionId = `${ip}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const sourceType = detectSource(referrer);
    const responseTime = Date.now() - startTime;

    // Store in D1
    await env.DB.prepare(`
      INSERT INTO analytics (slug, original_url, referrer, ref_domain, ip, country, city, click_type, user_agent, device_type, browser, os, query_params, session_id, source_type, timestamp, response_time, rate_limit_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(slug, shortURL, referrer, refDomain, ip, country, city, clickType, userAgent, device, browser, os, queryParams, sessionId, sourceType, Date.now(), responseTime, rateCount).run();

    // Update live sessions
    await env.DB.prepare(`
      INSERT OR REPLACE INTO live_sessions (session_id, ip, slug, last_active)
      VALUES (?, ?, ?, ?)
    `).bind(sessionId, ip, slug, Date.now()).run();

    // Broadcast to WebSocket clients
    await env.LIVE_ANALYTICS.fetch(new Request("http://live", {
      method: "POST",
      body: JSON.stringify({ slug, ip, clickType, timestamp: Date.now() })
    }));

    return Response.redirect(shortURL, 301);
  }
};

async function handleStats(request, env) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  const timeRange = url.searchParams.get("time") || "24h";
  const limit = parseInt(url.searchParams.get("limit")) || 100;

  const timeFilter = {
    "1h": Date.now() - 60 * 60 * 1000,
    "24h": Date.now() - 24 * 60 * 60 * 1000,
    "7d": Date.now() - 7 * 24 * 60 * 60 * 1000,
    "30d": Date.now() - 30 * 24 * 60 * 60 * 1000
  }[timeRange] || Date.now() - 24 * 60 * 60 * 1000;

  let query = `
    SELECT 
      ref_domain,
      COUNT(*) as total_clicks,
      SUM(click_type = 'good') as good_clicks,
      SUM(click_type = 'bad') as bad_clicks,
      SUM(click_type = 'suspicious') as suspicious_clicks,
      AVG(response_time) as avg_response_time,
      COUNT(DISTINCT ip) as unique_visitors,
      COUNT(DISTINCT session_id) as unique_sessions,
      GROUP_CONCAT(DISTINCT country) as countries,
      GROUP_CONCAT(DISTINCT device_type) as devices,
      GROUP_CONCAT(DISTINCT source_type) as sources
    FROM analytics
    WHERE timestamp >= ?
  `;
  const params = [timeFilter];
  if (domain) {
    query += ` AND ref_domain = ?`;
    params.push(domain);
  }
  query += ` GROUP BY ref_domain ORDER BY total_clicks DESC LIMIT ?`;
  params.push(limit);

  const result = await env.DB.prepare(query).bind(...params).all();
  return new Response(JSON.stringify(result.results), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" }
  });
}
