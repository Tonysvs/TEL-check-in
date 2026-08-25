const SPREADSHEET_ID = '1Jju4GsByyI1IAzVc-QgMiJCGOuVZEpNecm_ORh9nfWE';
const LOG_SHEET_NAME = 'Time Clock Log';
const TIME_ZONE = 'America/Los_Angeles';

const LOG_HEADERS = [
  'Timestamp',
  'Date',
  'Time',
  'Employee Email',
  'Action',
  'RC',
  'Late Minutes',
  'Lunch Start',
  'Lunch End',
  'Sick Pay Requested',
  'Details',
  'Expected Checkout',
  'Reminder Status'
];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('The Ed Ladder | Time Clock')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setupTimeClock() {
  const sheet = getLogSheet_();
  installCheckoutReminderTrigger_();
  SpreadsheetApp.flush();
  return 'Connected to "' + sheet.getName() + '" and installed checkout reminders.';
}

function submitTimeClockAction(action, args) {
  const values = Array.isArray(args) ? args : [];

  switch (action) {
    case 'recordCheckIn':
      return recordCheckIn(values[0], values[1]);
    case 'recordCheckOut':
      return recordCheckOut();
    case 'recordBreakOut':
      return recordBreakOut();
    case 'recordBreakIn':
      return recordBreakIn();
    case 'reportRunningLate':
      return reportRunningLate(values[0], values[1], values[2]);
    case 'reportUnableToAttend':
      return reportUnableToAttend(values[0], values[1]);
    case 'recordLunchRetroactive':
      return recordLunchRetroactive(values[0], values[1]);
    default:
      throw new Error('Unknown time-clock action: ' + action);
  }
}

function recordCheckIn(rc, expectedCheckout) {
  requireValue_(rc, 'RC');
  requireValue_(expectedCheckout, 'Expected checkout time');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(expectedCheckout))) {
    throw new Error('Expected checkout time must be a valid time.');
  }
  appendLog_('Check In', { rc: rc, expectedCheckout: expectedCheckout });
  setStatus_('Checked in at ' + rc, rc);
  return 'Checked in at ' + rc + '.';
}

function recordCheckOut() {
  appendLog_('Check Out', { rc: getStatusRc_() });
  setStatus_('Checked out', '');
  return 'You are checked out.';
}

function recordBreakOut() {
  appendLog_('Break Start', { rc: getStatusRc_() });
  setStatus_('On break', getStatusRc_());
  return 'Your break has started.';
}

function recordBreakIn() {
  const rc = getStatusRc_();
  appendLog_('Break End', { rc: rc });
  setStatus_(rc ? 'Checked in at ' + rc : 'Checked in', rc);
  return 'Your break has ended.';
}

function reportRunningLate(rc, minutes, message) {
  requireValue_(rc, 'RC');
  const lateMinutes = Number(minutes);
  if (!Number.isFinite(lateMinutes) || lateMinutes < 1 || lateMinutes > 480) {
    throw new Error('Late minutes must be between 1 and 480.');
  }
  const note = String(message || '').trim().slice(0, 500);
  appendLog_('Running Late', { rc: rc, lateMinutes: lateMinutes, details: note });
  setStatus_('Running ' + lateMinutes + ' minutes late to ' + rc, rc);
  return 'Your team was notified that you’ll be about ' + lateMinutes + ' minutes late.';
}

function reportUnableToAttend(rc, needsSickPay) {
  requireValue_(rc, 'RC');
  appendLog_('Unable to Attend', {
    rc: rc,
    sickPayRequested: needsSickPay ? 'Yes' : 'No'
  });
  setStatus_('Unable to attend today at ' + rc, rc);
  return 'Your absence at ' + rc + ' was recorded and your team was notified.';
}

function recordLunchRetroactive(lunchStart, lunchEnd) {
  requireValue_(lunchStart, 'Lunch start');
  requireValue_(lunchEnd, 'Lunch end');
  appendLog_('Lunch', {
    rc: getStatusRc_(),
    lunchStart: lunchStart,
    lunchEnd: lunchEnd,
    details: lunchStart + ' – ' + lunchEnd
  });
  return 'Your lunch was recorded.';
}

function getStatus() {
  return PropertiesService.getUserProperties().getProperty('timeClockStatus') || 'Ready to check in';
}

function appendLog_(action, values) {
  const now = new Date();
  const email = Session.getActiveUser().getEmail() || 'Unknown user';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = getLogSheet_();
    sheet.appendRow([
      now,
      Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM-dd'),
      Utilities.formatDate(now, TIME_ZONE, 'h:mm:ss a'),
      email,
      action,
      values.rc || '',
      values.lateMinutes || '',
      values.lunchStart || '',
      values.lunchEnd || '',
      values.sickPayRequested || '',
      values.details || '',
      values.expectedCheckout || '',
      ''
    ]);
  } finally {
    lock.releaseLock();
  }
}

function getLogSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(LOG_SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
  sheet.getRange(1, 1, 1, LOG_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#386fd1')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() <= 1) {
    sheet.autoResizeColumns(1, LOG_HEADERS.length);
  }

  return sheet;
}

function setStatus_(status, rc) {
  const properties = PropertiesService.getUserProperties();
  properties.setProperty('timeClockStatus', status);
  if (rc) {
    properties.setProperty('timeClockRc', rc);
  } else {
    properties.deleteProperty('timeClockRc');
  }
}

function getStatusRc_() {
  return PropertiesService.getUserProperties().getProperty('timeClockRc') || '';
}

function requireValue_(value, label) {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error(label + ' is required.');
  }
}

function installCheckoutReminderTrigger_() {
  const handler = 'checkoutReminderSweep';
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });

  if (!exists) {
    ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
  }
}

function checkoutReminderSweep() {
  const sheet = getLogSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const rows = sheet.getRange(2, 1, lastRow - 1, LOG_HEADERS.length).getValues();
  const openShifts = {};

  rows.forEach(function(row, index) {
    const email = String(row[3] || '').trim().toLowerCase();
    const action = row[4];
    if (!email || email === 'unknown user') return;

    if (action === 'Check In') {
      openShifts[email] = {
        rowNumber: index + 2,
        email: email,
        date: row[1],
        rc: row[5],
        expectedCheckout: row[11],
        reminderStatus: row[12]
      };
    } else if (action === 'Check Out') {
      delete openShifts[email];
    }
  });

  const now = new Date();
  Object.keys(openShifts).forEach(function(email) {
    sendCheckoutReminderIfDue_(sheet, openShifts[email], now);
  });
}

function sendCheckoutReminderIfDue_(sheet, shift, now) {
  if (!shift.expectedCheckout) return;
  const dateText = shift.date instanceof Date
    ? Utilities.formatDate(shift.date, TIME_ZONE, 'yyyy-MM-dd')
    : String(shift.date);
  const departure = Utilities.parseDate(
    dateText + ' ' + String(shift.expectedCheckout),
    TIME_ZONE,
    'yyyy-MM-dd HH:mm'
  );
  const minutesUntil = (departure.getTime() - now.getTime()) / 60000;
  const stageRanks = { '': 0, soon: 1, due: 2, late: 3 };
  let stage = '';
  let subject = '';
  let message = '';

  if (minutesUntil <= -15) {
    stage = 'late';
    subject = 'You may still be checked in';
    message = 'Your expected departure time passed more than 15 minutes ago. Please check out now or contact your manager if your time needs correction.';
  } else if (minutesUntil <= 0) {
    stage = 'due';
    subject = 'Time to check out';
    message = 'You reached your expected departure time. Please check out before leaving your RC.';
  } else if (minutesUntil <= 10) {
    stage = 'soon';
    subject = 'Your shift ends soon';
    message = 'Your expected departure time is in about 10 minutes. Remember to check out before leaving your RC.';
  }

  if (!stage || stageRanks[stage] <= (stageRanks[shift.reminderStatus] || 0)) return;

  const appUrl = ScriptApp.getService().getUrl();
  const linkLine = appUrl ? '\n\nOpen the time clock: ' + appUrl : '';
  MailApp.sendEmail({
    to: shift.email,
    subject: subject,
    body: message + '\n\nRC: ' + shift.rc + linkLine,
    htmlBody: '<p>' + message + '</p><p><strong>RC:</strong> ' + shift.rc + '</p>' +
      (appUrl ? '<p><a href="' + appUrl + '">Open the time clock</a></p>' : '')
  });
  sheet.getRange(shift.rowNumber, 13).setValue(stage);
}
