📂 **Advanced URL Shortener - Full Project Structure (Optimized & High-Quality)**

### **1. Cloudflare Worker Script (`worker.js`)**
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const slug = url.pathname.substring(1);

    // Fetch the destination URL from Cloudflare KV
    const shortURL = await LINKS.get(slug);
    if (!shortURL) {
      return new Response("Shortlink not found!", { status: 404 });
    }

    // Capture visitor details
    const referrer = request.headers.get("Referer") || "Direct";
    const userAgent = request.headers.get("User-Agent");
    const ip = request.headers.get("CF-Connecting-IP");
    const country = request.headers.get("CF-IPCountry");
    const city = request.headers.get("CF-Visitor") || "Unknown City";

    // Determine if it's a bot
    const isBot = /bot|crawl|spider/i.test(userAgent);
    const clickType = isBot ? "bad" : "good";

    // Extract referring domain
    let refDomain = new URL(referrer).hostname || "Direct";

    // Store analytics in Cloudflare D1 Database
    await DB.prepare(`INSERT INTO analytics (slug, referrer, refDomain, ip, country, city, clickType, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(slug, referrer, refDomain, ip, country, city, clickType, Date.now())
      .run();

    // Redirect user to the destination URL
    return Response.redirect(shortURL, 301);
  }
};
```

---

### **2. Cloudflare KV Storage (For Short Links)**
- **Create KV Namespace**: `LINKS`
- **Example Key-Value Data:**
```json
{
  "abc123": "https://example.com",
  "news": "https://itisuniqueofficial.news"
}
```

---

### **3. Cloudflare D1 Database (For Advanced Analytics)**
- **Run SQL Migration:**
```sql
CREATE TABLE analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT,
    referrer TEXT,
    refDomain TEXT,
    ip TEXT,
    country TEXT,
    city TEXT,
    clickType TEXT,
    timestamp INTEGER
);
```

---

### **4. GitHub Actions - Auto-Sync Short Links (`.github/workflows/deploy.yml`)**
```yaml
name: Deploy to Cloudflare KV

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

      - name: Sync Shortlinks with Cloudflare KV
        run: |
          curl -X PUT "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/storage/kv/namespaces/YOUR_NAMESPACE_ID/bulk" \
          -H "Authorization: Bearer YOUR_CLOUDFLARE_API_TOKEN" \
          -H "Content-Type: application/json" \
          --data-binary @shortlinks.json
```

---

### **5. Admin Panel (Frontend) - `index.html`**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clicksy Analytics</title>
    <script>
        async function fetchAnalytics() {
            let response = await fetch("/stats");
            let data = await response.json();
            document.getElementById("analytics").innerText = JSON.stringify(data, null, 2);
        }
    </script>
</head>
<body onload="fetchAnalytics()">
    <h1>Clicksy Analytics</h1>
    <pre id="analytics">Loading...</pre>
</body>
</html>
```

---

### ✅ **Final Steps (High-Quality & Optimized)**
1️⃣ **Deploy Cloudflare Worker** with `worker.js`
2️⃣ **Create KV Storage (`LINKS`) & D1 Database (`analytics` table)**
3️⃣ **Host Admin Panel using GitHub Pages or Vercel**
4️⃣ **Set Up GitHub Actions for Auto-Sync**

---

🚀 **Now with:**
✅ **Good vs. Bad Click Categorization**
✅ **Referring Domain Tracking**
✅ **Better Optimized Performance**

Enjoy your **Advanced & High-Quality URL Shortener!** 🎉
