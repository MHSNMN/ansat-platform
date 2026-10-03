import "dotenv/config";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { getSupabaseAdminClient } from "../src/server/supabaseAdmin";

async function runBackup() {
  console.log("📦 بدء النسخ الاحتياطي لبيانات Supabase الحرجة...");
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ تعذر الاتصال بـ Supabase للنسخ الاحتياطي.");
    process.exit(1);
  }

  const backupTables = [
    "profiles",
    "roles",
    "permissions",
    "role_permissions",
    "user_permission_overrides",
    "platform_access",
    "books",
    "chapters",
    "recordings",
    "tasks",
    "public_library",
    "activities",
    "certificates",
    "drive_files",
  ];

  const backupData: Record<string, any[]> = {};

  for (const table of backupTables) {
    try {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        console.warn(`⚠️ تحذير أثناء نسخ الجدول ${table}:`, error.message);
        backupData[table] = [];
      } else {
        backupData[table] = data || [];
        console.log(`✅ تم استخراج جدول ${table}: ${backupData[table].length} سجل`);
      }
    } catch (err: any) {
      console.warn(`⚠️ استثناء أثناء نسخ الجدول ${table}:`, err?.message || err);
      backupData[table] = [];
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const jsonStr = JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      platform: "Ensat",
      version: "2.0.0",
      data: backupData,
    },
    null,
    2
  );

  // Compress to gzip
  const compressed = zlib.gzipSync(Buffer.from(jsonStr, "utf-8"));
  const filename = `ensat_backup_${timestamp}.json.gz`;
  const filePath = path.join(backupDir, filename);

  fs.writeFileSync(filePath, compressed);
  console.log(`\n🎉 تم حفظ النسخة الاحتياطية بنجاح:`);
  console.log(`- الملف: ${filePath}`);
  console.log(`- الحجم: ${Math.round(compressed.length / 1024)} KB`);
}

runBackup().catch((err) => {
  console.error("❌ خطأ في عملية النسخ الاحتياطي:", err);
  process.exit(1);
});
