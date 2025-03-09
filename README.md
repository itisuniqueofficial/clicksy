📂 **Clicksy-URL-Shortener - Full Project Code**

---

### **1. Cloudflare Worker (`worker.js`)**
```javascript
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
```

---

### **2. Frontend - Admin Panel (`frontend/index.html`)**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clicksy Analytics</title>
    <link rel="stylesheet" href="styles.css">
    <script defer src="script.js"></script>
</head>
<body>
    <h1>Clicksy Analytics</h1>
    <input type="text" id="domainInput" placeholder="Enter domain (optional)">
    <button onclick="fetchAnalytics()">Get Stats</button>
    <pre id="analytics">Loading...</pre>
</body>
</html>
```

---

### **3. Frontend - JavaScript (`frontend/script.js`)**
```javascript
async function fetchAnalytics() {
    let domain = document.getElementById('domainInput').value;
    let url = "/stats";
    if (domain) url += "?domain=" + encodeURIComponent(domain);
    
    let response = await fetch(url);
    let data = await response.json();
    document.getElementById("analytics").innerText = JSON.stringify(data, null, 2);
}
```

---

### **4. Frontend - CSS (`frontend/styles.css`)**
```css
body {
    font-family: Arial, sans-serif;
    text-align: center;
    margin: 20px;
}
input, button {
    margin: 10px;
    padding: 10px;
}
pre {
    background: #f4f4f4;
    padding: 10px;
    border-radius: 5px;
    text-align: left;
}
```

---

### **5. Cloudflare KV Storage (`shortlinks.json`)**
```json
{
  "google": "https://google.com",
  "news": "https://itisuniqueofficial.news"
}
```

---

### **6. GitHub Actions Workflow (`.github/workflows/deploy.yml`)**
```yaml
name: Deploy to Cloudflare

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v3

      - name: Deploy Worker to Cloudflare
        run: |
          curl -X PUT "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/workers/scripts/clicksy" \
          -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
          -H "Content-Type: application/javascript" \
          --data-binary @worker.js

      - name: Sync Shortlinks with Cloudflare KV
        run: |
          curl -X PUT "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/storage/kv/namespaces/YOUR_NAMESPACE_ID/bulk" \
          -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
          -H "Content-Type: application/json" \
          --data-binary @shortlinks.json
```

---

### **7. README.md**
```md
# Clicksy URL Shortener

## Features
✅ Cloudflare Worker-based URL Shortener
✅ Stores short links in KV Storage
✅ Advanced analytics stored in Cloudflare D1 Database
✅ Tracks referring domains, good vs. bad clicks
✅ GitHub Actions for automatic deployment

## How to Use
1. Deploy `worker.js` to Cloudflare Workers.
2. Set up KV Storage (`CLICKSY`) & D1 Database (`analytics`).
3. Host the `frontend` on GitHub Pages or Vercel.
4. Set up GitHub Actions for auto-sync.

## API Endpoints
- `/slug` → Redirects to long URL
- `/stats?domain=example.com` → Fetch stats for a domain

## Deployment
- Push changes to GitHub → Auto-deployed to Cloudflare 🚀
```

---

## ✅ **Final Steps**
1️⃣ **Create a GitHub repository** and upload these files.  
2️⃣ **Push the repo to GitHub.**  
3️⃣ **Go to Cloudflare > Workers > Upload `worker.js`.**  
4️⃣ **Set up KV (`CLICKSY`) and D1 database (`analytics`).**  
5️⃣ **Store your API Token in GitHub Secrets (`CLOUDFLARE_API_TOKEN`).**  
6️⃣ **Enable GitHub Actions** for automatic updates.  

Now your **Clicksy URL Shortener is fully automated & optimized!** 🚀
