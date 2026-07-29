/***** NKH READ-ONLY PROPERTY CALENDAR SYNC *****
 * Reads source sheets only. It never clears, edits or formats a source sheet.
 * Required Script Properties:
 * NKH_CALENDAR_SYNC_ENDPOINT = https://YOUR-DASHBOARD.vercel.app/api/integrations/calendar/sync
 * NKH_CALENDAR_SYNC_SECRET   = same value as Vercel NKH_CALENDAR_SYNC_SECRET
 */

function runNKHCalendarSync() {
  var settings = getNKHCalendarSyncSettings_();
  var sources = fetchNKHCalendarSources_(settings);
  var result = { success: true, properties: sources.length, synced: 0, failed: 0, details: [] };

  sources.forEach(function(source) {
    try {
      var calendar = readNKHPropertyCalendar_(source.calendar_sheet_code);
      sendNKHCalendarCopy_(settings, {
        propertyId: source.id,
        rooms: calendar.rooms,
        bookings: calendar.bookings
      });
      result.synced++;
      result.details.push({ property: source.property_name, rooms: calendar.rooms.length, bookings: calendar.bookings.length });
    } catch (error) {
      result.failed++;
      result.details.push({ property: source.property_name, error: String(error) });
      try { sendNKHCalendarCopy_(settings, { propertyId: source.id, error: String(error) }); } catch (ignored) {}
    }
  });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function readNKHPropertyCalendar_(spreadsheetId) {
  var spreadsheet = SpreadsheetApp.openById(String(spreadsheetId || "").trim());
  var rooms = [], bookings = [], errors = [];
  spreadsheet.getSheets().forEach(function(sheet) {
    var values = sheet.getDataRange().getDisplayValues();
    if (!values.length) return;
    var headerInfo = findNKHCalendarHeaders_(values);
    if (!headerInfo) return;
    try {
      var parsed = parseNKHCalendarTable_(sheet.getName(), values, headerInfo);
      rooms = rooms.concat(parsed.rooms);
      bookings = bookings.concat(parsed.bookings);
    } catch (error) { errors.push(sheet.getName() + ": " + String(error)); }
  });
  rooms = uniqueNKHCalendarItems_(rooms, "sourceKey");
  bookings = uniqueNKHCalendarItems_(bookings, "sourceKey");
  if (!rooms.length && !bookings.length) {
    throw new Error("No supported room or booking table was found. Expected headers such as Room, Guest, Check In and Check Out." + (errors.length ? " " + errors.join(" | ") : ""));
  }
  if (!rooms.length) {
    bookings.forEach(function(booking, index) {
      rooms.push({ sourceKey: booking.roomName, roomName: booking.roomName, roomType: booking.roomType || "", roomStatus: "Available", sortOrder: index });
    });
    rooms = uniqueNKHCalendarItems_(rooms, "sourceKey");
  }
  return { rooms: rooms, bookings: bookings };
}

function findNKHCalendarHeaders_(values) {
  var aliases = nkhCalendarAliases_();
  for (var row = 0; row < Math.min(values.length, 12); row++) {
    var normalized = values[row].map(normalizeNKHCalendarHeader_);
    var map = {};
    Object.keys(aliases).forEach(function(field) {
      var index = normalized.findIndex(function(header) { return aliases[field].indexOf(header) !== -1; });
      if (index !== -1) map[field] = index;
    });
    if (map.room !== undefined && (map.guest !== undefined || map.roomType !== undefined || map.roomStatus !== undefined)) {
      return { row: row, map: map };
    }
  }
  return null;
}

function parseNKHCalendarTable_(sheetName, values, headerInfo) {
  var map = headerInfo.map, rooms = [], bookings = [];
  for (var row = headerInfo.row + 1; row < values.length; row++) {
    var item = values[row];
    var roomName = valueNKHCalendar_(item, map.room);
    if (!roomName) continue;
    var roomType = valueNKHCalendar_(item, map.roomType);
    rooms.push({
      sourceKey: sheetName + "|" + roomName,
      roomName: roomName,
      roomType: roomType,
      roomStatus: valueNKHCalendar_(item, map.roomStatus) || "Available",
      sortOrder: row
    });
    var checkIn = dateNKHCalendar_(valueNKHCalendar_(item, map.checkIn));
    var checkOut = dateNKHCalendar_(valueNKHCalendar_(item, map.checkOut));
    var guest = valueNKHCalendar_(item, map.guest);
    if (!guest || !checkIn || !checkOut || checkOut <= checkIn) continue;
    var reference = valueNKHCalendar_(item, map.reference);
    bookings.push({
      sourceKey: reference || [sheetName, roomName, checkIn, checkOut, guest].join("|"),
      bookingReference: reference,
      guestName: guest,
      roomName: roomName,
      roomType: roomType,
      bookingSource: valueNKHCalendar_(item, map.source) || "FIT",
      bookingStatus: valueNKHCalendar_(item, map.bookingStatus) || "Confirmed",
      checkIn: checkIn,
      checkOut: checkOut,
      notes: valueNKHCalendar_(item, map.notes)
    });
  }
  return { rooms: rooms, bookings: bookings };
}

function nkhCalendarAliases_() {
  return {
    room: ["room","roomno","roomnumber","roomname","unit","unitno"],
    roomType: ["roomtype","type","category","roomcategory","nickname"],
    roomStatus: ["roomstatus","availability","operationalstatus"],
    guest: ["guest","guestname","name","customer","customername"],
    checkIn: ["checkin","arrival","arrivaldate","from","startdate"],
    checkOut: ["checkout","departure","departuredate","to","enddate"],
    source: ["source","bookingsource","channel","ota"],
    bookingStatus: ["status","bookingstatus","reservationstatus"],
    reference: ["bookingid","bookingreference","reservationid","confirmationcode","reference","ref"],
    notes: ["notes","remark","remarks","comment","comments"]
  };
}
function normalizeNKHCalendarHeader_(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function valueNKHCalendar_(row, index) { return index === undefined ? "" : String(row[index] || "").trim(); }
function dateNKHCalendar_(value) {
  if (!value) return "";
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) return "";
  return Utilities.formatDate(parsed, "Asia/Colombo", "yyyy-MM-dd");
}
function uniqueNKHCalendarItems_(items, key) {
  var seen = {};
  return items.filter(function(item) { var value = String(item[key] || ""); if (!value || seen[value]) return false; seen[value] = true; return true; });
}
function getNKHCalendarSyncSettings_() {
  var properties = PropertiesService.getScriptProperties();
  var endpoint = String(properties.getProperty("NKH_CALENDAR_SYNC_ENDPOINT") || "").trim();
  var secret = String(properties.getProperty("NKH_CALENDAR_SYNC_SECRET") || "").trim();
  if (!endpoint || !secret) throw new Error("Calendar sync endpoint or secret is missing from Script Properties.");
  return { endpoint: endpoint, secret: secret };
}
function fetchNKHCalendarSources_(settings) {
  var response = UrlFetchApp.fetch(settings.endpoint, { method: "get", headers: { "X-NKH-Calendar-Secret": settings.secret }, muteHttpExceptions: true });
  var data = JSON.parse(response.getContentText() || "{}");
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || data.success !== true) throw new Error(data.error || "Unable to load property calendar sources.");
  return data.properties || [];
}
function sendNKHCalendarCopy_(settings, payload) {
  var response = UrlFetchApp.fetch(settings.endpoint, { method: "post", contentType: "application/json", headers: { "X-NKH-Calendar-Secret": settings.secret }, payload: JSON.stringify(payload), muteHttpExceptions: true });
  var data = JSON.parse(response.getContentText() || "{}");
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error(data.error || "Dashboard rejected the calendar copy.");
  return data;
}
function installNKHCalendarSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "runNKHCalendarSync") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("runNKHCalendarSync").timeBased().everyMinutes(10).create();
  return { success: true, intervalMinutes: 10 };
}
function testNKHCalendarSyncReadOnly() {
  var settings = getNKHCalendarSyncSettings_();
  var sources = fetchNKHCalendarSources_(settings);
  if (!sources.length) return { success: true, properties: 0 };
  var calendar = readNKHPropertyCalendar_(sources[0].calendar_sheet_code);
  Logger.log(JSON.stringify({ property: sources[0].property_name, rooms: calendar.rooms.length, bookings: calendar.bookings.length }, null, 2));
  return { success: true, property: sources[0].property_name, rooms: calendar.rooms.length, bookings: calendar.bookings.length };
}
