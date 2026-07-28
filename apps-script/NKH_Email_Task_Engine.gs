/***** NKH EMAIL TO TASK ENGINE — SUPABASE V1 *****/

const NKH_EMAIL_ENGINE = {
  timezone: "Asia/Colombo",
  startHour: 6,
  stopHour: 22,
  maximumThreads: 30,
  maximumMessagesPerRequest: 20,
  processedHistoryLimit: 1500,
  query: "in:inbox newer_than:3d",
  labels: {
    created: "NKH Task Created",
    duplicate: "NKH Task Created",
    review: "NKH Task Review",
    ignored: "NKH Task Ignored",
    auto_ignored: "NKH Automatically Ignored",
    error: "NKH Task Failed"
  }
};

function runNKHEmailTaskEngine() {
  if (!isNKHEmailEngineActive_()) {
    Logger.log("NKH Email Task Engine is outside 06:00–22:00 Asia/Colombo.");
    return { success: true, skipped: true, reason: "Outside operating hours" };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { success: true, skipped: true, reason: "Another execution is active" };
  }

  try {
    return processNKHEmailTasks_();
  } finally {
    lock.releaseLock();
  }
}

function processNKHEmailTasks_() {
  const settings = getNKHEmailEngineSettings_();
  const processed = getNKHProcessedEmailIds_();
  const baseline = Number(settings.baseline || 0);
  const threads = GmailApp.search(NKH_EMAIL_ENGINE.query, 0, NKH_EMAIL_ENGINE.maximumThreads);
  const pending = [];
  const threadByMessageId = {};

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      const messageId = String(message.getId() || "").trim();
      if (!messageId || processed[messageId]) return;
      if (baseline && message.getDate().getTime() < baseline) return;
      pending.push({
        messageId: messageId,
        threadId: String(thread.getId() || ""),
        from: String(message.getFrom() || ""),
        to: String(message.getTo() || ""),
        subject: String(message.getSubject() || ""),
        body: cleanNKHEmailBody_(message.getPlainBody() || "").slice(0, 8000),
        receivedAt: message.getDate().toISOString(),
        gmailUrl: "https://mail.google.com/mail/u/0/#inbox/" + thread.getId(),
        attachmentNames: []
      });
      threadByMessageId[messageId] = thread;
    });
  });

  if (!pending.length) {
    return { success: true, found: 0, created: 0 };
  }

  const totals = { created: 0, duplicate: 0, review: 0, ignored: 0, auto_ignored: 0, error: 0 };
  for (let offset = 0; offset < pending.length; offset += NKH_EMAIL_ENGINE.maximumMessagesPerRequest) {
    const batch = pending.slice(offset, offset + NKH_EMAIL_ENGINE.maximumMessagesPerRequest);
    const response = sendNKHEmailTaskBatch_(settings, batch);

    (response.results || []).forEach(function(result) {
      const messageId = String(result.messageId || "");
      const status = String(result.status || "error").toLowerCase();
      totals[status] = Number(totals[status] || 0) + 1;

      const thread = threadByMessageId[messageId];
      if (thread && NKH_EMAIL_ENGINE.labels[status]) {
        thread.addLabel(getOrCreateNKHEmailLabel_(NKH_EMAIL_ENGINE.labels[status]));
      }

      /*
       * Created, duplicate, review and ignored messages are final.
       * Errors are deliberately not recorded, so the next run retries them.
       */
      if (["created", "duplicate", "review", "ignored", "auto_ignored"].indexOf(status) !== -1) {
        processed[messageId] = Date.now();
      }
    });
  }

  saveNKHProcessedEmailIds_(processed);
  const result = {
    success: true,
    found: pending.length,
    created: totals.created,
    duplicate: totals.duplicate,
    review: totals.review,
    ignored: totals.ignored,
    automaticallyIgnored: totals.auto_ignored,
    errors: totals.error
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function sendNKHEmailTaskBatch_(settings, messages) {
  const response = UrlFetchApp.fetch(settings.endpoint, {
    method: "post",
    contentType: "application/json",
    headers: { "X-NKH-Email-Secret": settings.secret },
    payload: JSON.stringify({ messages: messages }),
    followRedirects: true,
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const text = response.getContentText();
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Dashboard returned invalid JSON. HTTP " + status + ": " + text.slice(0, 300));
  }
  if (status < 200 || status >= 300 || data.success !== true) {
    throw new Error("Dashboard email task API failed. HTTP " + status + ": " + String(data.error || text));
  }
  return data;
}

function isNKHEmailEngineActive_() {
  const hour = Number(Utilities.formatDate(new Date(), NKH_EMAIL_ENGINE.timezone, "H"));
  return hour >= NKH_EMAIL_ENGINE.startHour && hour < NKH_EMAIL_ENGINE.stopHour;
}

function cleanNKHEmailBody_(body) {
  return String(body || "")
    .replace(/\r/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getNKHEmailEngineSettings_() {
  const properties = PropertiesService.getScriptProperties();
  const endpoint = String(properties.getProperty("NKH_EMAIL_TASK_ENDPOINT") || "").trim();
  const secret = String(properties.getProperty("NKH_EMAIL_TASK_SECRET") || "").trim();
  if (!endpoint) throw new Error("NKH_EMAIL_TASK_ENDPOINT is missing from Script Properties.");
  if (!secret) throw new Error("NKH_EMAIL_TASK_SECRET is missing from Script Properties.");
  return {
    endpoint: endpoint,
    secret: secret,
    baseline: properties.getProperty("NKH_EMAIL_ENGINE_BASELINE") || "0"
  };
}

function getNKHProcessedEmailIds_() {
  const raw = PropertiesService.getScriptProperties().getProperty("NKH_EMAIL_PROCESSED_IDS");
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (error) {
    Logger.log("Processed ID history was invalid and has been reset.");
    return {};
  }
}

function saveNKHProcessedEmailIds_(ids) {
  const trimmed = {};
  Object.keys(ids)
    .sort(function(a, b) { return Number(ids[b] || 0) - Number(ids[a] || 0); })
    .slice(0, NKH_EMAIL_ENGINE.processedHistoryLimit)
    .forEach(function(id) { trimmed[id] = ids[id]; });
  PropertiesService.getScriptProperties()
    .setProperty("NKH_EMAIL_PROCESSED_IDS", JSON.stringify(trimmed));
}

function getOrCreateNKHEmailLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function installNKHEmailTaskTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "runNKHEmailTaskEngine") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  PropertiesService.getScriptProperties()
    .setProperty("NKH_EMAIL_ENGINE_BASELINE", String(Date.now()));
  ScriptApp.newTrigger("runNKHEmailTaskEngine")
    .timeBased()
    .everyMinutes(10)
    .create();
  return { success: true, intervalMinutes: 10, baseline: new Date().toISOString() };
}

function testNKHEmailTaskEngineReadOnly() {
  const processed = getNKHProcessedEmailIds_();
  const threads = GmailApp.search(NKH_EMAIL_ENGINE.query, 0, 10);
  const candidates = [];
  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      const id = String(message.getId() || "");
      if (!id || processed[id]) return;
      candidates.push({
        id: id,
        from: message.getFrom(),
        subject: message.getSubject(),
        receivedAt: message.getDate()
      });
    });
  });
  Logger.log(JSON.stringify(candidates, null, 2));
  return { success: true, candidates: candidates.length };
}

function clearNKHEmailTaskTrigger() {
  let deleted = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "runNKHEmailTaskEngine") {
      ScriptApp.deleteTrigger(trigger);
      deleted++;
    }
  });
  return { success: true, deleted: deleted };
}
