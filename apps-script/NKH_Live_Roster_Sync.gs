/***** NK HOTELS MASTER WORK ROSTER SYNC *****
 * Authoritative roster: Master Work.xlsx in Google Drive
 * File ID: 114XLQ2dbhURHaD95HpDgOrS2evbP9h-R
 *
 * One-time Apps Script setup:
 * 1. Enable Advanced Google Service: Drive API.
 * 2. Script Properties:
 *    NKH_ROSTER_SYNC_ENDPOINT = https://YOUR-DASHBOARD.vercel.app/api/integrations/roster/sync
 *    NKH_ROSTER_SYNC_SECRET   = same secret configured in Vercel
 * 3. Run installNKHMasterWorkRosterTrigger().
 *
 * The script converts Master Work.xlsx to a temporary native Sheet only long
 * enough to read the first (Roster) tab, pushes it to the dashboard, then
 * trashes the temporary conversion. Master Work.xlsx is never overwritten.
 */
var NKH_MASTER_WORK_FILE_ID = "114XLQ2dbhURHaD95HpDgOrS2evbP9h-R";
var NKH_LIVE_ROSTER_SHEET_ID = "1Bm1GHvIke8CeYkvzyyLpI8jZjQC0DyizeQeF0iho2HE";
var NKH_LIVE_ROSTER_SHEET_NAME = "Roster";
var NKH_HEADERS = ["Date","Day","Reservations 6:00 AM - 12:00 PM","Reservations 12:00 PM - 2:00 PM","Reservations 2:00 PM - 4:00 PM","Reservations 4:00 PM - 10:00 PM","Digital Marketing 12:00 PM - 2:00 PM","Digital Marketing 2:00 PM - 4:00 PM"];
var NKH_KEYS = ["date","day","reservations_06_12","reservations_12_14","reservations_14_16","reservations_16_22","digital_12_14","digital_14_16"];

function getNKHRosterSettings_() {
  var p = PropertiesService.getScriptProperties();
  var endpoint = String(p.getProperty("NKH_ROSTER_SYNC_ENDPOINT") || "").trim();
  if (!endpoint) {
    var calendarEndpoint = String(p.getProperty("NKH_CALENDAR_SYNC_ENDPOINT") || "").trim();
    endpoint = calendarEndpoint.replace(/\/calendar\/sync\/?$/, "/roster/sync");
  }
  var secret = String(p.getProperty("NKH_ROSTER_SYNC_SECRET") || p.getProperty("NKH_CALENDAR_SYNC_SECRET") || "").trim();
  if (!endpoint || !secret) throw new Error("Roster sync endpoint/secret missing.");
  return { endpoint: endpoint, secret: secret };
}
function isoDate_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") return Utilities.formatDate(value, "Asia/Colombo", "yyyy-MM-dd");
  var text = String(value).trim();
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[1] + "-" + match[2] + "-" + match[3] : "";
}
function normalizedMasterWorkRows_(values) {
  // Master Work Roster: row 2 has column labels; data starts row 3.
  // A Date, B Day, C-F Reservations, G-H OFF, I separator, J-K Digital Marketing.
  return values.slice(2).map(function(row) {
    return {
      date: isoDate_(row[0]),
      day: String(row[1] || "").trim(),
      reservations_06_12: String(row[2] || "").trim(),
      reservations_12_14: String(row[3] || "").trim(),
      reservations_14_16: String(row[4] || "").trim(),
      reservations_16_22: String(row[5] || "").trim(),
      digital_12_14: String(row[9] || "").trim(),
      digital_14_16: String(row[10] || "").trim()
    };
  }).filter(function(item) { return item.date; });
}
function readMasterWorkRoster_() {
  var temp = null;
  try {
    temp = Drive.Files.copy(
      { title: "NKH Roster Sync Temporary " + new Date().getTime(), mimeType: MimeType.GOOGLE_SHEETS },
      NKH_MASTER_WORK_FILE_ID,
      { convert: true }
    );
    var spreadsheet = SpreadsheetApp.openById(temp.id);
    var roster = spreadsheet.getSheets()[0];
    return normalizedMasterWorkRows_(roster.getDataRange().getValues());
  } finally {
    if (temp && temp.id) Drive.Files.trash(temp.id);
  }
}
function mirrorLiveRoster_(rows) {
  var sheet = SpreadsheetApp.openById(NKH_LIVE_ROSTER_SHEET_ID).getSheetByName(NKH_LIVE_ROSTER_SHEET_NAME);
  var output = [NKH_HEADERS];
  rows.forEach(function(item) {
    output.push([item.date,item.day,item.reservations_06_12,item.reservations_12_14,item.reservations_14_16,item.reservations_16_22,item.digital_12_14,item.digital_14_16]);
  });
  var clearRows = Math.max(sheet.getLastRow(), output.length);
  if (clearRows) sheet.getRange(1,1,clearRows,8).clearContent();
  sheet.getRange(1,1,output.length,8).setValues(output);
  sheet.setFrozenRows(1);
}
function syncMasterWorkRosterToDashboard() {
  var settings = getNKHRosterSettings_();
  var rows = readMasterWorkRoster_();
  var response = UrlFetchApp.fetch(settings.endpoint, {
    method: "post",
    contentType: "application/json",
    headers: { "X-NKH-Roster-Secret": settings.secret },
    payload: JSON.stringify({ rows: rows }),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error(response.getContentText());
  mirrorLiveRoster_(rows);
  return JSON.parse(response.getContentText());
}
function installNKHMasterWorkRosterTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "syncMasterWorkRosterToDashboard") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("syncMasterWorkRosterToDashboard").timeBased().everyMinutes(10).create();
  return syncMasterWorkRosterToDashboard();
}
