import client from "prom-client";

// Collect default Node.js runtime metrics (CPU, memory, event loop lag, GC)
client.collectDefaultMetrics({ prefix: "bugpilot_" });

// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: "bugpilot_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// HTTP request counter
export const httpRequestsTotal = new client.Counter({
  name: "bugpilot_http_requests_total",
  help: "Total number of HTTP requests handled",
  labelNames: ["method", "route", "status_code"],
});

// Active requests gauge
export const httpActiveRequests = new client.Gauge({
  name: "bugpilot_http_active_requests",
  help: "Number of active HTTP requests currently being processed",
});

// Middleware to monitor incoming requests
export const metricsMiddleware = (req, res, next) => {
  // Avoid metrics endpoint measuring itself recursively
  if (req.path === "/metrics") {
    return next();
  }

  httpActiveRequests.inc();
  const start = process.hrtime();

  res.on("finish", () => {
    httpActiveRequests.dec();
    const elapsed = process.hrtime(start);
    const durationInSeconds = elapsed[0] + elapsed[1] / 1e9;
    const route = req.baseUrl + (req.route?.path || req.path || "unknown");

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationInSeconds);
  });

  next();
};

export { client };
