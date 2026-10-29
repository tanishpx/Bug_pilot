#!/usr/bin/env node

/**
 * Bug Pilot Traffic & Load Simulator
 * Sends continuous simulated traffic across all primary API endpoints.
 * 
 * Usage:
 *   node monitoring/scripts/simulate_traffic.js [duration_seconds] [concurrency]
 * Example:
 *   node monitoring/scripts/simulate_traffic.js 45 4
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const DURATION_SEC = parseInt(process.argv[2] || "45", 10);
const CONCURRENCY = parseInt(process.argv[3] || "4", 10);

const ENDPOINTS = [
  { method: "GET", path: "/health" },
  { method: "GET", path: "/api/health" },
  { method: "GET", path: "/api/stats" },
  { method: "GET", path: "/api/bugs" },
  { method: "GET", path: "/api/settings" },
  { method: "POST", path: "/api/bugs", body: { title: "Test Load Bug", description: "Automated probe", severity: "Low", priority: "Low" } },
];

let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
const stopTime = Date.now() + DURATION_SEC * 1000;

async function sendRequest(item) {
  try {
    const url = `${BASE_URL}${item.path}`;
    const options = {
      method: item.method,
      headers: { "Content-Type": "application/json" },
    };
    if (item.body) {
      options.body = JSON.stringify(item.body);
    }
    const res = await fetch(url, options);
    totalRequests++;
    if (res.ok || res.status === 400 || res.status === 401) {
      successfulRequests++;
    } else {
      failedRequests++;
    }
  } catch (err) {
    totalRequests++;
    failedRequests++;
  }
}

async function worker() {
  while (Date.now() < stopTime) {
    const item = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    await sendRequest(item);
    // Slight jitter between 80ms and 200ms
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));
  }
}

async function main() {
  console.log(`[Simulator] Starting load generator targeting ${BASE_URL}`);
  console.log(`[Simulator] Duration: ${DURATION_SEC}s | Concurrency: ${CONCURRENCY} workers`);

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  const ticker = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((stopTime - Date.now()) / 1000));
    process.stdout.write(`\r[Simulator] Running... ${remaining}s left | Requests sent: ${totalRequests} `);
  }, 1000);

  await Promise.all(workers);
  clearInterval(ticker);

  console.log("\n[Simulator] Completed load simulation.");
  console.log(`[Simulator] Total Requests: ${totalRequests}`);
  console.log(`[Simulator] Success: ${successfulRequests} | Failed: ${failedRequests}`);
}

main().catch(console.error);
