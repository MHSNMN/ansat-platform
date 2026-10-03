export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
] as const;
export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const MEMBER_ALLOWED_STATUS_CHANGES = new Set<TaskStatus>([
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
]);

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    (TASK_STATUSES as readonly string[]).includes(value.toUpperCase())
  );
}

export function normalizeStatus(value: string): TaskStatus {
  const upper = value.toUpperCase();
  if ((TASK_STATUSES as readonly string[]).includes(upper)) {
    return upper as TaskStatus;
  }
  return "TODO";
}

export function canUpdateTaskStatus(
  uid: string,
  role: string,
  assigneeUids: unknown,
): boolean {
  return (
    role === "admin" ||
    role === "super_admin" ||
    (Array.isArray(assigneeUids) && assigneeUids.includes(uid))
  );
}
