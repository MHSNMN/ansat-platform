import { getSupabaseAdminClient } from "../supabaseAdmin";

export class TaskRepository {
  async listTasks(options?: {
    platform?: string;
    stage?: string;
    status?: string;
    profileId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tasks: any[]; total: number }> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { tasks: [], total: 0 };

    const limit = Math.min(options?.limit || 100, 200);
    const offset = options?.offset || 0;

    try {
      let query = supabase
        .from("tasks")
        .select(
          `
          *,
          task_assignments (
            profile_id,
            profiles (
              id, full_name, email, avatar_url
            )
          )
        `,
          { count: "exact" },
        )
        .eq("is_archived", false);

      if (options?.platform) {
        query = query.eq("platform", options.platform);
      }
      if (options?.stage) {
        query = query.eq("stage", options.stage);
      }
      if (options?.status) {
        query = query.eq("status", options.status);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error || !data) {
        console.warn("[TaskRepository] listTasks error:", error?.message);
        return { tasks: [], total: 0 };
      }

      const tasks = data.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description || "",
        platform: t.platform,
        priority: t.priority,
        stage: t.stage,
        status: t.status,
        dueDate: t.due_date,
        pointsReward: t.points_reward || 0,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        assignments: (t.task_assignments || []).map((a: any) => ({
          profileId: a.profile_id,
          name: a.profiles?.full_name,
          email: a.profiles?.email,
        })),
      }));

      return { tasks, total: count || data.length };
    } catch (err: any) {
      console.warn(
        "[TaskRepository] listTasks exception:",
        err?.message || err,
      );
      return { tasks: [], total: 0 };
    }
  }

  async upsertTask(task: any): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !task.id) return false;

    try {
      const payload: any = {
        id: task.id,
        title: task.title,
        description: task.description || "",
        platform: task.platform || "tasks",
        priority: task.priority || "MEDIUM",
        stage: task.stage || "TODO",
        status: task.status || "OPEN",
        due_date: task.dueDate || task.due_date || null,
        points_reward: task.pointsReward || 0,
        is_archived: false,
        updated_at: new Date().toISOString(),
      };

      const currentPayload = { ...payload };
      let upsertOk = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        const { error } = await supabase.from("tasks").upsert(currentPayload);
        if (!error) {
          upsertOk = true;
          break;
        }
        const missingMatch = error.message.match(
          /Could not find the ['"]([^'"]+)['"] column of ['"]tasks['"]/i,
        );
        if (missingMatch && missingMatch[1]) {
          delete currentPayload[missingMatch[1]];
          continue;
        }
        console.warn("[TaskRepository] upsertTask error:", error.message);
        break;
      }

      if (!upsertOk) return false;

      // Sync assignments if provided
      if (Array.isArray(task.assignedProfileIds)) {
        await supabase.from("task_assignments").delete().eq("task_id", task.id);
        if (task.assignedProfileIds.length > 0) {
          const rows = task.assignedProfileIds.map((pid: string) => ({
            task_id: task.id,
            profile_id: pid,
          }));
          await supabase.from("task_assignments").insert(rows);
        }
      }

      return true;
    } catch (err: any) {
      console.error(
        "[TaskRepository] upsertTask exception:",
        err?.message || err,
      );
      return false;
    }
  }

  async archiveTask(taskId: string, archivedBy: string): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !taskId) return false;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: archivedBy,
          status: "ARCHIVED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      return !error;
    } catch {
      return false;
    }
  }
}

export const taskRepository = new TaskRepository();
