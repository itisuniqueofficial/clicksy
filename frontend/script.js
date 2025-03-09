let chart;
let statsData = [];

async function fetchAnalytics() {
    const domain = document.getElementById('domainInput').value;
    const timeRange = document.getElementById('timeRange').value;
    let url = "https://clicksy.itisuniqueofficial.workers.dev/stats?time=" + timeRange;
    if (domain) url += "&domain=" + encodeURIComponent(domain);

    const response = await fetch(url);
    statsData = await response.json();

    updateTable(statsData);
    updateChart(statsData);
}

function updateTable(data) {
    const tbody = document.querySelector('#statsTable tbody');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.ref_domain}</td>
            <td>${row.total_clicks}</td>
            <td>${row.good_clicks}</td>
            <td>${row.bad_clicks}</td>
            <td>${row.suspicious_clicks}</td>
            <td>${row.avg_response_time.toFixed(2)}</td>
            <td>${row.unique_visitors}</td>
            <td>${row.unique_sessions}</td>
            <td>${row.countries}</td>
            <td>${row.devices}</td>
            <td>${row.sources}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateChart(data) {
    const ctx = document.getElementById('clicksChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(row => row.ref_domain),
            datasets: [
                { label: 'Good Clicks', data: data.map(row => row.good_clicks), backgroundColor: '#28a745' },
                { label: 'Bad Clicks', data: data.map(row => row.bad_clicks), backgroundColor: '#dc3545' },
                { label: 'Suspicious Clicks', data: data.map(row => row.suspicious_clicks), backgroundColor: '#ffc107' }
            ]
        },
        options: { scales: { y: { beginAtZero: true } } }
    });
}

function exportToCSV() {
    const headers = Object.keys(statsData[0]).join(",");
    const rows = statsData.map(row => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'clicksy_analytics.csv';
    link.click();
}

// WebSocket for live updates
function initWebSocket() {
    const ws = new WebSocket('wss://clicksy.itisuniqueofficial.workers.dev/live');
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        document.getElementById('liveCount').textContent = parseInt(document.getElementById('liveCount').textContent) + 1;
        fetchAnalytics(); // Refresh stats on new click
    };
    ws.onerror = () => console.error("WebSocket error");
    ws.onclose = () => setTimeout(initWebSocket, 1000); // Reconnect on close
}

// Initial load
window.onload = () => {
    fetchAnalytics();
    initWebSocket();
};
