export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "completed" | "error" | "interrupted";
}

export interface SubAgent {
  id: string;
  name: string;
  subAgentName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "pending" | "active" | "completed" | "error";
}

export interface FileItem {
  path: string;
  content: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  updatedAt?: Date;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterruptData {
  value: any;
  ns?: string[];
  scope?: string;
}

export interface ActionRequest {
  name: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface ReviewConfig {
  actionName: string;
  allowedDecisions?: string[];
}

export interface ToolApprovalInterruptData {
  action_requests: ActionRequest[];
  review_configs?: ReviewConfig[];
}

export type ShareMode = "private" | "public_link" | "org_only" | "restricted";
export type SharePermission = "view" | "fork" | "edit";

export interface ThreadShare {
  id: string;
  thread_id: string;
  owner_id?: string;
  org_id?: string;
  share_token: string;
  share_mode: ShareMode;
  permission: SharePermission;
  snapshot_data?: SharedThreadSnapshot;
  is_active: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  owner_email?: string;
}

export interface ThreadCollaborator {
  id: string;
  thread_id: string;
  user_id: string;
  invited_by?: string;
  role: "viewer" | "editor";
  created_at: string;
  email?: string;
  full_name?: string;
}

export interface SharedThreadSnapshot {
  title: string;
  threadId: string;
  authorName?: string;
  authorEmail?: string;
  authorRole?: string;
  createdAt: string;
  messages: any[];
  todos?: TodoItem[];
  files?: Record<string, string>;
  ui?: any;
  opportunitySummary?: {
    keyword?: string;
    score?: number;
    recommendation?: string;
  };
}

