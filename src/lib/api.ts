import { auth } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function getUserId(): string {
  const user = auth?.currentUser;
  if (user) return user.uid;

  let devId = localStorage.getItem("bugpilot-dev-user-id");
  if (!devId) {
    devId = "dev-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("bugpilot-dev-user-id", devId);
  }
  return devId;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const userId = getUserId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };

  headers["X-User-Id"] = userId;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export interface BugFilters {
  status?: string;
  severity?: string;
  priority?: string;
  bugType?: string;
  search?: string;
}

export interface CreateBugPayload {
  title: string;
  description?: string;
  bugType?: string;
  severity?: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  environment?: string;
  tags?: string[];
}

export interface SubmitFeedbackPayload {
  title?: string;
  bugTitle?: string;
  bugType?: string;
  severity?: string;
  bugDescription: string;
  stepsToReproduce?: string;
  environment?: string;
  reporterEmail?: string;
  attachments?: string[];
}

export interface PublicForm {
  formId: string;
  title: string;
  description: string;
  bugType: string;
  severity: string;
  priority?: string;
  environment?: string;
}

export interface Bug {
  _id: string;
  formId: string;
  title: string;
  description: string;
  bugType: string;
  severity: string;
  priority: string;
  status: string;
  assignee: string;
  reporter: string;
  environment: string;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

export interface InsightsFilters {
  dateRange?: "7" | "30" | "all";
  status?: string;
  severity?: string;
  bugType?: string;
}

export interface InsightSeriesItem {
  label?: string;
  date?: string;
  count: number;
}

export interface Insights {
  totalBugs: number;
  openBugs: number;
  inProgressBugs: number;
  resolvedBugs: number;
  closedBugs: number;
  criticalBugs: number;
  resolutionRate: number;
  averageResolutionTime: number;
  statusDistribution: InsightSeriesItem[];
  severityDistribution: InsightSeriesItem[];
  bugsOverTime: InsightSeriesItem[];
  categoryDistribution: InsightSeriesItem[];
}

export interface Submission {
  _id: string;
  formId: { formId: string; title: string } | string;
  formTitle: string;
  bugTitle?: string;
  bugType?: string;
  severity?: string;
  bugDescription: string;
  stepsToReproduce: string;
  environment: string;
  reporterEmail: string;
  attachments?: string[];
  status: string;
  createdAt: string;
}

export interface Stats {
  overview: {
    totalBugs: number;
    openBugs: number;
    inProgressBugs: number;
    criticalBugs: number;
    totalSubmissions: number;
    acceptanceRate: number;
  };
  bugsByStatus: Record<string, number>;
  bugsBySeverity: Record<string, number>;
  bugsByType: Record<string, number>;
  bugsByPriority: Record<string, number>;
  submissionsByStatus: Record<string, number>;
}

export async function getBugs(filters?: BugFilters): Promise<Bug[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.bugType) params.set("bugType", filters.bugType);
  if (filters?.search) params.set("search", filters.search);

  const query = params.toString();
  return request<Bug[]>(`/bugs${query ? `?${query}` : ""}`);
}

export async function createBug(data: CreateBugPayload): Promise<Bug> {
  const bug = await request<Bug>("/bugs", {
    method: "POST",
    body: JSON.stringify(data),
  });
  window.dispatchEvent(new Event("bugpilot:bugs-changed"));
  return bug;
}

export async function updateBug(
  formId: string,
  data: Partial<Bug>
): Promise<Bug> {
  const bug = await request<Bug>(`/bugs/${formId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  window.dispatchEvent(new Event("bugpilot:bugs-changed"));
  return bug;
}

export async function deleteBug(formId: string): Promise<void> {
  await request(`/bugs/${formId}`, { method: "DELETE" });
  window.dispatchEvent(new Event("bugpilot:bugs-changed"));
}

export async function getPublicForm(formId: string): Promise<PublicForm> {
  return request<PublicForm>(`/bugs/public/${formId}`);
}

export async function submitFeedback(
  formId: string,
  data: SubmitFeedbackPayload
): Promise<{ message: string; id: string }> {
  return request(`/bugs/public/${formId}/submit`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getSubmissions(
  status?: string
): Promise<Submission[]> {
  const query = status ? `?status=${status}` : "";
  return request<Submission[]>(`/submissions${query}`);
}

export async function updateSubmission(
  id: string,
  status: string
): Promise<Submission> {
  return request<Submission>(`/submissions/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export interface SettingsPayload {
  newBugNotifications: boolean;
  statusChangeNotifications: boolean;
  notificationEmail: string;
  applicationName: string;
  supportEmail: string;
  theme: "Light" | "Dark" | "System";
  primaryColor: string;
}

export async function getSettings(): Promise<SettingsPayload> {
  return request<SettingsPayload>("/settings");
}

export async function updateSettings(data: SettingsPayload): Promise<SettingsPayload> {
  return request<SettingsPayload>("/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getStats(): Promise<Stats> {
  return request<Stats>("/stats");
}

export async function getInsights(filters: InsightsFilters = {}): Promise<Insights> {
  const params = new URLSearchParams();
  if (filters.dateRange) params.set("dateRange", filters.dateRange);
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.bugType) params.set("bugType", filters.bugType);
  const query = params.toString();
  return request<Insights>(`/insights${query ? `?${query}` : ""}`);
}

