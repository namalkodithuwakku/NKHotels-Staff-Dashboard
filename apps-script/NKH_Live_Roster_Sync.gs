/***** NK HOTELS LIVE ROSTER — TWO-WAY SYNC *****
 * Sheet ID: 1Bm1GHvIke8CeYkvzyyLpI8jZjQC0DyizeQeF0iho2HE
 * Script Properties required:
 * NKH_ROSTER_SYNC_ENDPOINT = https://YOUR-DASHBOARD.vercel.app/api/integrations/roster/sync
 * NKH_ROSTER_SYNC_SECRET   = same secret configured in Vercel
 */
var NKH_ROSTER_SHEET_ID = "1Bm1GHvIke8CeYkvzyyLpI8jZjQC0DyizeQeF0iho2HE";
var NKH_ROSTER_SHEET_NAME = "Roster";
var NKH_HEADERS = ["Date","Day","Reservations 6:00 AM - 12:00 PM","Reservations 12:00 PM - 2:00 PM","Reservations 2:00 PM - 4:00 PM","Reservations 4:00 PM - 10:00 PM","Digital Marketing 12:00 PM - 2:00 PM","Digital Marketing 2:00 PM - 4:00 PM"];
var NKH_KEYS = ["date","day","reservations_06_12","reservations_12_14","reservations_14_16","reservations_16_22","digital_12_14","digital_14_16"];

function getNKHRosterSettings_() {
  var p = PropertiesService.getScriptProperties();
  var endpoint = String(p.getProperty("NKH_ROSTER_SYNC_ENDPOINT") || "").trim();
  var secret = String(p.getProperty("NKH_ROSTER_SYNC_SECRET") || "").trim();
  if (!endpoint || !secret) throw new Error("Roster sync endpoint/secret missing.");
  return { endpoint: endpoint, secret: secret };
}
function rosterSheet_() {
  return SpreadsheetApp.openById(NKH_ROSTER_SHEET_ID).getSheetByName(NKH_ROSTER_SHEET_NAME);
}
function isoDate_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") return Utilities.formatDate(value, "Asia/Colombo", "yyyy-MM-dd");
  var text = String(value).trim();
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[1] + "-" + match[2] + "-" + match[3] : "";
}
function readRosterRows_() {
  var sheet = rosterSheet_();
  var values = sheet.getDataRange().getValues();
  return values.slice(1).map(function(row) {
    var item = {};
    NKH_KEYS.forEach(function(key, i) { item[key] = i === 0 ? isoDate_(row[i]) : String(row[i] || "").trim(); });
    return item;
  }).filter(function(item) { return item.date; });
}
function pushRosterToDashboard() {
  var settings = getNKHRosterSettings_();
  var response = UrlFetchApp.fetch(settings.endpoint, {
    method: "post", contentType: "application/json",
    headers: { "X-NKH-Roster-Secret": settings.secret },
    payload: JSON.stringify({ rows: readRosterRows_() }), muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error(response.getContentText());
  return JSON.parse(response.getContentText());
}
function refreshRosterFromDashboard() {
  var settings = getNKHRosterSettings_();
  var response = UrlFetchApp.fetch(settings.endpoint + "?from=2026-09-01&to=2027-12-31", {
    method: "get", headers: { "X-NKH-Roster-Secret": settings.secret }, muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error(response.getContentText());
  var data = JSON.parse(response.getContentText());
  var rows = data.rows || [];
  var sheet = rosterSheet_();
  var output = [NKH_HEADERS];
  rows.forEach(function(item) {
    var d = new Date(item.date + "T12:00:00");
    output.push([item.date, Utilities.formatDate(d, "Asia/Colombo", "EEE"), item.reservations_06_12 || "", item.reservations_12_14 || "", item.reservations_14_16 || "", item.reservations_16_22 || "", item.digital_12_14 || "", item.digital_14_16 || ""]);
  });
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), output.length), 8).clearContent();
  sheet.getRange(1, 1, output.length, 8).setValues(output);
  sheet.setFrozenRows(1);
  return { success: true, rows: rows.length };
}
function onEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== NKH_ROSTER_SHEET_NAME || e.range.getRow() === 1) return;
  pushRosterToDashboard();
}
function doPost(e) {
  try {
    var request = JSON.parse(e && e.postData && e.postData.contents || "{}");
    var settings = getNKHRosterSettings_();
    if (String(request.secret || "") !== settings.secret) return jsonRoster_({ success:false, error:"Unauthorized" });
    if (request.action === "refreshFromDashboard") return jsonRoster_(refreshRosterFromDashboard());
    return jsonRoster_({ success:false, error:"Unsupported action" });
  } catch (error) { return jsonRoster_({ success:false, error:String(error) }); }
}
function jsonRoster_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function installNKHRosterTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "pushRosterToDashboard") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("pushRosterToDashboard").timeBased().everyMinutes(10).create();
  return { success:true };
}
