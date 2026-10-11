export type BugSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type BugStatus = 'New' | 'Reviewed' | 'Accepted' | 'Rejected' | 'In Progress' | 'Resolved';
export type BugType = 'UI' | 'Backend' | 'Performance' | 'Security' | 'Database' | 'Other';

export interface InvestigationNote {
  id: string;
  author: string;
  hypothesis?: string;
  details: string;
  suggestedFix?: string;
  timestamp: string;
}

export interface BugReport {
  id: string;
  title: string;
  description: string;
  type: BugType;
  severity: BugSeverity;
  status: BugStatus;
  stepsToReproduce?: string;
  environment?: string;
  reporterEmail?: string;
  attachments?: string[];
  logs?: string;
  relatedFiles?: string[];
  investigationNotes?: InvestigationNote[];
  createdAt: string;
  updatedAt: string;
}

export interface BugFilter {
  status?: BugStatus | string;
  severity?: BugSeverity | string;
  type?: BugType | string;
  search?: string;
  limit?: number;
}

export interface CreateBugInput {
  title: string;
  description: string;
  type?: BugType;
  severity?: BugSeverity;
  stepsToReproduce?: string;
  environment?: string;
  reporterEmail?: string;
  logs?: string;
  relatedFiles?: string[];
}

export interface AddInvestigationNoteInput {
  bugId: string;
  author?: string;
  hypothesis?: string;
  details: string;
  suggestedFix?: string;
}
