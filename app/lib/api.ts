import { Task } from "../types/tasks";

export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch("/api/tasks", { cache: "no-store" });
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Tasks API returned invalid JSON.");
  }

  if (!data.success) throw new Error(data.error || "Failed to load tasks");

  return data.tasks || [];
}

export async function fetchProperties(): Promise<string[]> {
  const response = await fetch("/api/properties", { cache: "no-store" });
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Properties API returned invalid JSON.");
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to load properties");
  }

  return data.properties || [];
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  staffName: string
) {
  const params = new URLSearchParams({ taskId, status, staffName });

  const response = await fetch(`/api/tasks/update?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Task update API returned invalid JSON.");
  }

  if (!data.success) throw new Error(data.error || "Failed to update task");

  return data;
}

export async function createTask(input: {
  taskType: string;
  source?: string;
  property: string;
  note?: string;
  subject?: string;
  priority?: string;
  staffName: string;
  staffPhone?: string;
  shift?: string;
}) {
  const response = await fetch("/api/tasks/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Create task API returned invalid JSON.");
  }

  if (!data.success) throw new Error(data.error || "Failed to create task");

  return data;
}
export async function fetchEmailReaderItems() {
  const response = await fetch("/api/email-reader", { cache: "no-store" });
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Email Reader API returned invalid JSON.");
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to load email reader items");
  }

  return data.items || [];
}

export async function refreshGmailInbox() {
  const response = await fetch("/api/integrations/gmail/refresh", {
    method: "POST",
    cache: "no-store",
  });
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Gmail refresh API returned invalid JSON.");
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to refresh Gmail inbox");
  }

  return data as { success: true; imported: number };
}

export async function fetchInboxNotificationCounts() {
  const response = await fetch("/api/notifications/counts", {
    cache: "no-store",
  });
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Notification counts API returned invalid JSON.");
  }

  if (!data.success) {
    throw new Error(data.error || "Failed to load notification counts");
  }

  return {
    whatsapp: Math.max(0, Number(data.counts?.whatsapp || 0)),
    sms: Math.max(0, Number(data.counts?.sms || 0)),
  };
}

export async function ignoreAIEmail(input: {
  emailId?: string;
  emailIds?: string[];
  staffName: string;
  reason?: string;
}) {
  const response = await fetch("/api/email-reader/ignore", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ignore AI email API returned invalid JSON.");
  }

  if (!data.success && !data.ignoredCount) {
    throw new Error(data.error || "Failed to ignore AI email");
  }

  return data;
}

export async function startEmailTask(input: {
  emailId: string;
  staffName: string;
  shift?: string;
  property?: string;
  taskType?: string;
  category?: string;
  priority?: string;
  aiTitle?: string;
  subject?: string;
  summary?: string;
  action?: string;
  event?: string;
  bookingId?: string;
  gmailLink?: string;
  from?: string;
  to?: string;
  time?: string;
}) {
  const response = await fetch("/api/email-reader/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Create email task API returned invalid JSON."
    );
  }

  if (!data.success) {
    throw new Error(
      data.error || "Failed to create email task"
    );
  }

  return data;
}

/* ==========================================================
   Super Mode
========================================================== */

export type SuperModeStatus = {
  success?: boolean;
  active: boolean;
  staffName: string;
  staffPhone?: string;
  startedAt?: string;
  expiresAt?: string;
  remainingSeconds: number;
  sessionId?: string;
  message?: string;
};

async function readSuperModeResponse(
  response: Response,
  fallbackMessage: string
): Promise<SuperModeStatus> {
  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `${fallbackMessage}: invalid JSON response.`
    );
  }

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.error ||
        data?.message ||
        fallbackMessage
    );
  }

  return {
    active: data?.active === true,
    staffName: String(
      data?.staffName || ""
    ),
    staffPhone: String(
      data?.staffPhone || ""
    ),
    startedAt: String(
      data?.startedAt || ""
    ),
    expiresAt: String(
      data?.expiresAt || ""
    ),
    remainingSeconds: Math.max(
      0,
      Number(
        data?.remainingSeconds || 0
      )
    ),
    sessionId: String(
      data?.sessionId || ""
    ),
    message: String(
      data?.message || ""
    ),
  };
}

export async function fetchSuperStatus(
  staffName: string
): Promise<SuperModeStatus> {
  const params = new URLSearchParams({
    staffName,
  });

  const response = await fetch(
    `/api/super/status?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  return readSuperModeResponse(
    response,
    "Failed to load Super status"
  );
}

export async function startSuperSession(input: {
  staffName: string;
  staffPhone?: string;
  shiftActive: boolean;
}): Promise<SuperModeStatus> {
  const response = await fetch(
    "/api/super/start",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(input),
    }
  );

  return readSuperModeResponse(
    response,
    "Failed to start Super"
  );
}

export async function extendSuperSession(input: {
  staffName: string;
}): Promise<SuperModeStatus> {
  const response = await fetch(
    "/api/super/extend",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(input),
    }
  );

  return readSuperModeResponse(
    response,
    "Failed to extend Super"
  );
}

export async function endSuperSession(input: {
  staffName: string;
  reason?: string;
}): Promise<SuperModeStatus> {
  const response = await fetch(
    "/api/super/end",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(input),
    }
  );

  return readSuperModeResponse(
    response,
    "Failed to end Super"
  );
}
