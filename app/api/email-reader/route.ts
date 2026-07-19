import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_WEBAPP_URL;

export async function GET() {
  if (!GOOGLE_SCRIPT_URL) {
    return NextResponse.json(
      { success: false, error: "GOOGLE_SCRIPT_URL missing" },
      { status: 500 }
    );
  }

  const url = `${GOOGLE_SCRIPT_URL}?action=getEmailReaderItems`;

  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { success: false, error: "Google Script returned invalid JSON" },
      { status: 500 }
    );
  }

  if (!data.success || !Array.isArray(data.items)) {
    return NextResponse.json(data);
  }

  const createdTasks = await supabaseAdmin<Array<{ source_email_id: string | null }>>(
    "nkh_tasks?select=source_email_id&source_email_id=not.is.null&archived_at=is.null"
  );
  const createdEmailIds = new Set(
    createdTasks.map((task) => String(task.source_email_id || "").trim()).filter(Boolean)
  );
  const items = data.items.filter((item: { emailId?: string; id?: string }) => {
    const emailId = String(item.emailId || item.id || "").trim();
    return !emailId || !createdEmailIds.has(emailId);
  });

  return NextResponse.json({ ...data, items });
}
