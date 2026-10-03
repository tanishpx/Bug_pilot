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
  "Fixed",
  "Retest",
  "Closed",
  "Reopened",
];

export const initialForms: FeedbackForm[] = [
  {
    id: "bug-001",
    title: "Checkout button stays disabled after applying a valid discount",
    description:
      "After a valid discount code is applied, the order total updates but the checkout button remains disabled until the page is refreshed.",
    bugType: "Runtime",
    severity: "High",
    priority: "P1",
    status: "Open",
    assignee: "",
    reporter: "Maya Chen",
    environment: "Production, Chrome 128, Windows 11",
    tags: ["checkout", "discount", "regression"],
    createdAt: "2026-09-18T14:32:00.000Z",
    updatedAt: "2026-09-18T14:32:00.000Z",
  },
  {
    id: "bug-002",
    title: "Profile avatar appears stretched on mobile devices",
    description:
      "On narrow screens, uploaded square profile photos render with a stretched aspect ratio in the account menu.",
    bugType: "UI",
    severity: "Medium",
    priority: "P2",
    status: "Triaged",
    assignee: "Jordan Lee",
    reporter: "Alex Morgan",
    environment: "Staging, Safari 17, iOS 17",
    tags: ["profile", "mobile", "image"],
    createdAt: "2026-09-20T09:15:00.000Z",
    updatedAt: "2026-09-21T11:40:00.000Z",
  },
];

const FORMS_STORAGE_KEY = "bugpilot-feedback-forms";

export function loadForms(): FeedbackForm[] {
  try {
    const storedForms = localStorage.getItem(FORMS_STORAGE_KEY);
    return storedForms ? (JSON.parse(storedForms) as FeedbackForm[]) : initialForms;
  } catch {
    return initialForms;
  }
}

export function saveForms(forms: FeedbackForm[]): void {
  localStorage.setItem(FORMS_STORAGE_KEY, JSON.stringify(forms));
}
