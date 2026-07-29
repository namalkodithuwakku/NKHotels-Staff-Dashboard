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

function doPost(e) {
  try {
    var request = JSON.parse(
      e && e.postData && e.postData.contents || "{}"
    );
    if (String(request.action || "") !== "backgroundCalendarRefresh") {
      return jsonNKHCalendarResponse_({
        success: false,
        error: "Unsupported calendar action."
      });
    }
    var settings = getNKHCalendarSyncSettings_();
    if (!request.secret || String(request.secret) !== settings.secret) {
      return jsonNKHCalendarResponse_({
        success: false,
        error: "Unauthorized"
      });
    }
    var propertyId = String(request.propertyId || "").trim();
    var sources = fetchNKHCalendarSources_(settings);
    var source = sources.find(function(item) {
      return String(item.id || "") === propertyId;
    });
    if (!source) {
      return jsonNKHCalendarResponse_({
        success: false,
        error: "Calendar property was not found."
      });
    }
    var calendar = readNKHPropertyCalendar_(
      source.calendar_sheet_code
    );
    var saved = sendNKHCalendarCopy_(settings, {
      propertyId: source.id,
      rooms: calendar.rooms,
      bookings: calendar.bookings
    });
    return jsonNKHCalendarResponse_({
      success: true,
      property: source.property_name,
      rooms: saved.rooms,
      bookings: saved.bookings
    });
  } catch (error) {
    return jsonNKHCalendarResponse_({
      success: false,
      error: String(error && error.message || error)
    });
  }
}

function jsonNKHCalendarResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function readNKHPropertyCalendar_(spreadsheetId) {
  var spreadsheet = SpreadsheetApp.openById(String(spreadsheetId || "").trim());
  var now = new Date();
  var years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  var rooms = [];
  var bookings = [];
  var foundYearSheets = 0;
  var parsedYearSheets = 0;
  var skippedYears = [];

  /*
   * Uses the existing client-portal Calendar Engine directly:
   * - year-named sheets
   * - Date row and room columns
   * - cell text for guest/block
   * - cell background for OTA source
   * - NKHOTELS_BOOKING_V1 notes for booking details
   *
   * Calendar Engine.gs and Color Engine.gs must exist in this same
   * Master Apps Script project.
   */
  years.forEach(function(year) {
    var sheet = spreadsheet.getSheetByName(String(year));
    if (!sheet) return;

    foundYearSheets++;
    var parsed;

    try {
      parsed = parseCalendarSheet_(sheet, year, null);
      parsedYearSheets++;
    } catch (error) {
      skippedYears.push(
        String(year) + ": " + String(error && error.message || error)
      );
      return;
    }

    (parsed.rooms || []).forEach(function(room, index) {
      rooms.push({
        sourceKey: String(room.name || "").trim(),
        roomName: String(room.name || "").trim(),
        roomType: String(room.nickname || "").trim(),
        roomStatus: String(room.status || "READY").trim(),
        sortOrder: index
      });
    });

    (parsed.reservations || []).forEach(function(reservation) {
      var details = reservation.details || {};
      var bookingId = String(
        details.bookingId ||
        reservation.id ||
        ""
      ).trim();
      var roomName = String(
        reservation.room ||
        details.room ||
        ""
      ).trim();
      var checkIn = String(
        reservation.checkIn ||
        details.checkIn ||
        ""
      ).trim();
      var checkOut = String(
        reservation.checkOut ||
        details.checkOut ||
        ""
      ).trim();
      var guestName = String(
        reservation.guest ||
        details.guest ||
        "Guest"
      ).trim();
      var bookingReference = String(
        details.bookingRef ||
        ""
      ).trim();
      var notes = String(
        reservation.notes ||
        details.notes ||
        ""
      ).trim();
      var bookingSource = String(
        reservation.source ||
        details.source ||
        "FIT"
      ).trim();
      var groupKey = bookingReference
        ? "REF|" + bookingReference.toLowerCase()
        : [
            guestName.toLowerCase().replace(/\s+/g, " "),
            bookingSource.toLowerCase(),
            checkIn,
            checkOut,
            notes.toLowerCase().replace(/\s+/g, " ")
          ].join("|");

      if (!roomName || !checkIn || !checkOut) return;

      bookings.push({
        sourceKey: [
          bookingId || guestName,
          roomName,
          checkIn,
          checkOut
        ].join("|"),
        groupKey: groupKey,
        bookingReference: bookingReference || bookingId,
        guestName: guestName,
        roomName: roomName,
        roomType: String(
          reservation.roomType ||
          details.roomType ||
          ""
        ).trim(),
        bookingSource: bookingSource,
        bookingStatus: String(
          reservation.status ||
          details.bookingStatus ||
          "Confirmed"
        ).trim(),
        checkIn: checkIn,
        checkOut: checkOut,
        notes: notes
      });
    });
  });

  if (!foundYearSheets) {
    throw new Error(
      "No calendar year sheet was found for " +
      years.join(", ") +
      "."
    );
  }

  if (!parsedYearSheets) {
    throw new Error(
      "Calendar year sheets were found, but none matched the current " +
      "calendar layout. " +
      skippedYears.join(" | ")
    );
  }

  rooms = uniqueNKHCalendarItems_(rooms, "sourceKey");
  bookings = uniqueNKHCalendarItems_(bookings, "sourceKey");

  return {
    rooms: rooms,
    bookings: bookings,
    parsedYears: parsedYearSheets,
    skippedYears: skippedYears
  };
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
  Logger.log(JSON.stringify({
    property: sources[0].property_name,
    rooms: calendar.rooms.length,
    bookings: calendar.bookings.length,
    parsedYears: calendar.parsedYears,
    skippedYears: calendar.skippedYears
  }, null, 2));
  return { success: true, property: sources[0].property_name, rooms: calendar.rooms.length, bookings: calendar.bookings.length };
}
