export type BugType =
  | "UI"
  | "Runtime"
  | "Performance"
  | "Security"
  | "API"
  | "Other";

export type Severity = "Low" | "Medium" | "High" | "Critical";

export type BugStatus =
  | "Open"
  | "Triaged"
  | "Assigned"
  | "In Progress"
  | "Resolved"
  | "Fixed"
  | "Retest"
  | "Closed"
  | "Reopened";

export type Priority = "P0" | "P1" | "P2" | "P3";

export interface FeedbackForm {
  id: string;
  title: string;
  description: string;
  bugType: BugType;
  severity: Severity;
  priority: Priority;
  status: BugStatus;
  assignee: string;
  reporter: string;
  environment: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const BUG_TYPES: BugType[] = [
  "UI",
  "Runtime",
  "Performance",
  "Security",
  "API",
  "Other",
];

export const SEVERITIES: Severity[] = ["Low", "Medium", "High", "Critical"];

export const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

export const BUG_STATUSES: BugStatus[] = [
  "Open",
  "Triaged",
  "Assigned",
  "In Progress",
  "Resolved",
  "Fixed",
  "Retest",
  "Closed",
  "Reopened",
];
