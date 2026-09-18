import FeedbackForm from "../models/FeedbackForm.js";

const RESOLVED_STATUSES = ["Resolved", "Fixed"];
const CLOSED_STATUSES = ["Closed"];

function distribution(rows) {
  return rows.reduce((result, row) => {
    result[row._id] = row.count;
    return result;
  }, {});
}

function startOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

export async function getInsights(req, res) {
  try {
    const { dateRange = "all", status, severity, bugType } = req.query;
    const match = { userId: req.userId };

    if (status) match.status = status;
    if (severity) match.severity = severity;
    if (bugType) match.bugType = bugType;

    const rangeDays = dateRange === "7" || dateRange === "30" ? Number(dateRange) : null;
    const today = startOfDay(new Date());
    const rangeStart = rangeDays ? addDays(today, -(rangeDays - 1)) : null;
    if (rangeStart) match.createdAt = { $gte: rangeStart };

    const bugs = await FeedbackForm.find(match)
      .select("status severity bugType createdAt updatedAt resolvedAt")
      .lean();

    const statusDistribution = {
      Open: 0,
      "In Progress": 0,
      Resolved: 0,
      Closed: 0,
    };
    const severityDistribution = {};
    const categoryDistribution = {};

    for (const bug of bugs) {
      if (bug.status === "Closed") {
        statusDistribution.Closed += 1;
      } else if (RESOLVED_STATUSES.includes(bug.status)) {
        statusDistribution.Resolved += 1;
      } else if (bug.status === "Open" || bug.status === "Reopened") {
        statusDistribution.Open += 1;
      } else {
        statusDistribution["In Progress"] += 1;
      }

      severityDistribution[bug.severity] = (severityDistribution[bug.severity] || 0) + 1;
      categoryDistribution[bug.bugType] = (categoryDistribution[bug.bugType] || 0) + 1;
    }

    const resolvedBugs = bugs.filter((bug) => RESOLVED_STATUSES.includes(bug.status)).length;
    const closedBugs = bugs.filter((bug) => CLOSED_STATUSES.includes(bug.status)).length;
    const completedBugs = bugs.filter((bug) =>
      [...RESOLVED_STATUSES, ...CLOSED_STATUSES].includes(bug.status)
    );
    const resolutionTimes = completedBugs
      .map((bug) => {
        const resolvedAt = bug.resolvedAt || bug.updatedAt;
        return resolvedAt && bug.createdAt
          ? new Date(resolvedAt).getTime() - new Date(bug.createdAt).getTime()
          : null;
      })
      .filter((value) => value !== null && value >= 0);
    const averageResolutionTime = resolutionTimes.length
      ? resolutionTimes.reduce((sum, value) => sum + value, 0) /
        resolutionTimes.length /
        (1000 * 60 * 60 * 24)
      : 0;

    const bugsOverTime = [];
    if (rangeDays) {
      for (let index = 0; index < rangeDays; index += 1) {
        const date = addDays(rangeStart, index);
        bugsOverTime.push({ date: formatDay(date), count: 0 });
      }
      const counts = new Map(bugsOverTime.map((entry) => [entry.date, entry]));
      for (const bug of bugs) {
        const entry = counts.get(formatDay(new Date(bug.createdAt)));
        if (entry) entry.count += 1;
      }
    } else {
      const counts = new Map();
      for (const bug of bugs) {
        const date = formatDay(new Date(bug.createdAt));
        counts.set(date, (counts.get(date) || 0) + 1);
      }
      bugsOverTime.push(...[...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })));
    }

    const totalBugs = bugs.length;
    res.json({
      totalBugs,
      openBugs: statusDistribution.Open,
      inProgressBugs: statusDistribution["In Progress"],
      resolvedBugs,
      closedBugs,
      criticalBugs: bugs.filter((bug) => bug.severity === "Critical").length,
      resolutionRate: totalBugs ? ((resolvedBugs + closedBugs) / totalBugs) * 100 : 0,
      averageResolutionTime,
      statusDistribution: Object.entries(statusDistribution).map(([label, count]) => ({ label, count })),
      severityDistribution: Object.entries(severityDistribution).map(([label, count]) => ({ label, count })),
      categoryDistribution: Object.entries(categoryDistribution).map(([label, count]) => ({ label, count })),
      bugsOverTime,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}