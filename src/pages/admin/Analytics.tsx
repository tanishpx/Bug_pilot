import { useCallback, useEffect, useState } from "react";
import { getInsights, type Insights, type InsightsFilters, type InsightSeriesItem } from "../../lib/api";
import { BUG_STATUSES, SEVERITIES } from "../../lib/forms";

const chartStatuses = ["Open", "In Progress", "Resolved", "Closed"];
const chartSeverities = ["Critical", "High", "Medium", "Low"];

function BarChart({ title, data }: { title: string; data: InsightSeriesItem[] }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <section className="chart-card">
      <h3>{title}</h3>
      <div className="bar-chart">
        {data.map((item) => (
          <div className="bar-row" key={item.label}>
            <span className="bar-label">{item.label}</span>
            <div className="bar-track"><div className="bar-fill fill-status" style={{ width: `${(item.count / max) * 100}%` }} /></div>
            <span className="bar-count">{item.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TimeChart({ data }: { data: InsightSeriesItem[] }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <section className="chart-card insight-time-card">
      <div className="chart-heading"><h3>Bugs over time</h3><span>{data.reduce((sum, item) => sum + item.count, 0)} created</span></div>
      <div className="time-chart" aria-label="Bugs created over time">
        {data.map((item) => (
          <div className="time-point" key={item.date} title={`${item.date}: ${item.count}`}>
            <div className="time-bar" style={{ height: `${Math.max((item.count / max) * 100, item.count ? 8 : 2)}%` }} />
            <span>{item.date?.slice(5)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Analytics() {
  const [filters, setFilters] = useState<InsightsFilters>({ dateRange: "30" });
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInsights = useCallback(async () => {
    setError("");
    try {
      setInsights(await getInsights(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    const refresh = () => loadInsights();
    window.addEventListener("bugpilot:bugs-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("bugpilot:bugs-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadInsights]);

  const updateFilter = (key: keyof InsightsFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  };

  if (loading && !insights) return <div className="admin-loading"><p>Loading insights...</p></div>;
  if (error && !insights) return <div className="empty-state"><i className="fa-solid fa-triangle-exclamation"></i><h3>Failed to load insights</h3><p>{error}</p><button className="btn ghost" onClick={loadInsights}>Retry</button></div>;
  if (!insights) return null;

  const filterBar = <div className="insight-filters"><FilterControls filters={filters} updateFilter={updateFilter} categories={insights.categoryDistribution.map((item) => item.label || "Other")} /></div>;
  if (insights.totalBugs === 0) return (
    <>
      <div className="admin-head"><div><h1>Insights</h1><p>Resolution metrics at a glance</p></div><button className="btn ghost" onClick={loadInsights}>Refresh</button></div>
      {filterBar}
      <div className="empty-state"><i className="fa-solid fa-chart-line"></i><h3>No data yet</h3><p>Create bugs and collect submissions to see insights.</p></div>
    </>
  );

  const statusData = chartStatuses.map((label) => ({ label, count: insights.statusDistribution.find((item) => item.label === label)?.count || 0 }));
  const severityData = chartSeverities.map((label) => ({ label, count: insights.severityDistribution.find((item) => item.label === label)?.count || 0 }));

  return (
    <>
      <div className="admin-head"><div><h1>Insights</h1><p>Resolution metrics at a glance</p></div><button className="btn ghost" onClick={loadInsights}><i className="fa-solid fa-rotate"></i> Refresh</button></div>
      {filterBar}
      {error && <div className="insight-error">{error}</div>}
      <div className="stats-row insight-stats">
        <Metric label="Total Bugs" value={insights.totalBugs} icon="fa-bug" />
        <Metric label="Open Bugs" value={insights.openBugs} icon="fa-circle-dot" />
        <Metric label="In Progress Bugs" value={insights.inProgressBugs} icon="fa-spinner" />
        <Metric label="Resolved Bugs" value={insights.resolvedBugs} icon="fa-check" />
        <Metric label="Closed Bugs" value={insights.closedBugs} icon="fa-check-double" />
        <Metric label="Critical Bugs" value={insights.criticalBugs} icon="fa-fire" />
      </div>
      <TimeChart data={insights.bugsOverTime} />
      <div className="chart-grid insight-grid">
        <BarChart title="Status distribution" data={statusData} />
        <BarChart title="Severity distribution" data={severityData} />
        <BarChart title="Category distribution" data={insights.categoryDistribution} />
        <section className="chart-card resolution-card"><h3>Resolution metrics</h3><div><strong>{insights.resolutionRate.toFixed(1)}%</strong><span>Resolution rate</span></div><div><strong>{insights.averageResolutionTime.toFixed(1)} days</strong><span>Average resolution time</span></div></section>
      </div>
    </>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: string }) {
  return <div className="stat-card"><div className="stat-icon"><i className={`fa-solid ${icon}`} /></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>;
}

function FilterControls({ filters, updateFilter, categories }: { filters: InsightsFilters; updateFilter: (key: keyof InsightsFilters, value: string) => void; categories: string[] }) {
  return <>
    <label>Date range<select value={filters.dateRange || "all"} onChange={(event) => updateFilter("dateRange", event.target.value)}><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="all">All time</option></select></label>
    <label>Status<select value={filters.status || ""} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{BUG_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
    <label>Severity<select value={filters.severity || ""} onChange={(event) => updateFilter("severity", event.target.value)}><option value="">All severities</option>{SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}</select></label>
    {categories.length > 0 && <label>Category<select value={filters.bugType || ""} onChange={(event) => updateFilter("bugType", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>}
  </>;
}
