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
  'Details'
];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('The Ed Ladder | Time Clock')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setupTimeClock() {
  const sheet = getLogSheet_();
  SpreadsheetApp.flush();
  return 'Connected to "' + sheet.getName() + '" in spreadsheet ' + SPREADSHEET_ID + '.';
}

function submitTimeClockAction(action, args) {
  const values = Array.isArray(args) ? args : [];

  switch (action) {
    case 'recordCheckIn':
      return recordCheckIn(values[0]);
    case 'recordCheckOut':
      return recordCheckOut();
    case 'recordBreakOut':
      return recordBreakOut();
    case 'recordBreakIn':
      return recordBreakIn();
    case 'reportRunningLate':
      return reportRunningLate(values[0], values[1]);
    case 'reportUnableToAttend':
      return reportUnableToAttend(values[0], values[1]);
    case 'recordLunchRetroactive':
      return recordLunchRetroactive(values[0], values[1]);
    default:
      throw new Error('Unknown time-clock action: ' + action);
  }
}

function recordCheckIn(rc) {
  requireValue_(rc, 'RC');
  appendLog_('Check In', { rc: rc });
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

function reportRunningLate(rc, minutes) {
  requireValue_(rc, 'RC');
  const lateMinutes = Number(minutes);
  if (!Number.isFinite(lateMinutes) || lateMinutes < 1 || lateMinutes > 480) {
    throw new Error('Late minutes must be between 1 and 480.');
  }
  appendLog_('Running Late', { rc: rc, lateMinutes: lateMinutes });
  return 'Your team was notified that you’ll be about ' + lateMinutes + ' minutes late.';
}

function reportUnableToAttend(rc, needsSickPay) {
  requireValue_(rc, 'RC');
  appendLog_('Unable to Attend', {
    rc: rc,
    sickPayRequested: needsSickPay ? 'Yes' : 'No'
  });
  setStatus_('Unable to attend today', rc);
  return 'Your absence was recorded.';
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
      values.details || ''
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

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    sheet.getRange(1, 1, 1, LOG_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#386fd1')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
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
