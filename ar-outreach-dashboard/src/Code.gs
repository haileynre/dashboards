/**
 * AR Payment Reminders - Outreach Dashboard (Subto)
 *
 * Serves the web app and a privacy-filtered, cached copy of the `messages` tab.
 * Only the fields in PAYLOAD_FIELDS ever leave the server; lead-level columns
 * (lead_name, lead_id, activity_id, template_name, ...) are read but dropped here.
 */

var CONFIG = {
  SHEET_ID: '13ZrIQkxulhjES49I8i36VtJ-jiY_A_kv1NxraHERrYs',
  SHEET_GID: 2122950652,
  SHEET_NAME_FALLBACK: 'messages',
  TIME_ZONE: 'America/Phoenix',
  TITLE: 'AR Payment Reminders - Outreach Dashboard (Subto)',
  CACHE_KEY: 'ar_outreach_payload_v1',
  CACHE_SECONDS: 600,
  // CacheService caps each value at 100 KB; stay well under it.
  CACHE_CHUNK_CHARS: 50000
};

var PAYLOAD_FIELDS = [
  'channel',
  'user_name',
  'date',
  'week_start',
  'month',
  'via_sequence',
  'opened',
  'responded'
];

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CONFIG.TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Called from the browser via google.script.run.
 * @param {boolean} forceRefresh  true = skip the 10-minute cache and re-read the sheet.
 */
function getDashboardData(forceRefresh) {
  var cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    var cached = readCache_(cache);
    if (cached) {
      cached.from_cache = true;
      return cached;
    }
  }

  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = getMessagesSheet_(ss);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var values = lastRow > 0 && lastCol > 0
    ? sheet.getRange(1, 1, lastRow, lastCol).getValues()
    : [];

  var payload = buildPayload_(values, {
    now: new Date(),
    sheetTimeZone: ss.getSpreadsheetTimeZone() || CONFIG.TIME_ZONE
  });
  writeCache_(cache, payload);
  payload.from_cache = false;
  return payload;
}

function getMessagesSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === CONFIG.SHEET_GID) return sheets[i];
  }
  var byName = ss.getSheetByName(CONFIG.SHEET_NAME_FALLBACK);
  if (byName) return byName;
  throw new Error('Could not find the messages tab (gid ' + CONFIG.SHEET_GID +
    ' or name "' + CONFIG.SHEET_NAME_FALLBACK + '") in the dashboard spreadsheet.');
}

/**
 * Pure transform from sheet values (header row + data rows) to the browser payload.
 * @param {Array<Array<*>>} values  getValues() output, header in row 0.
 * @param {{now: Date, sheetTimeZone: string}} opts
 */
function buildPayload_(values, opts) {
  opts = opts || {};
  var now = opts.now || new Date();
  var sheetTz = opts.sheetTimeZone || CONFIG.TIME_ZONE;

  var header = (values[0] || []).map(function (h) {
    return String(h === null || h === undefined ? '' : h).trim().toLowerCase();
  });
  var col = {};
  ['channel', 'user_name', 'sent_at', 'date', 'week_start', 'month',
    'via_sequence', 'opened', 'responded', 'last_checked'].forEach(function (name) {
    col[name] = header.indexOf(name);
  });

  var missing = ['channel', 'user_name'].filter(function (name) { return col[name] < 0; });
  if (col.date < 0 && col.sent_at < 0) missing.push('date');
  if (values.length > 0 && missing.length) {
    throw new Error('The messages tab is missing required column(s): ' + missing.join(', '));
  }

  var rows = [];
  var skipped = 0;
  var lastChecked = null;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (isBlankRow_(row)) continue;

    var channel = normalizeChannel_(cell_(row, col.channel));
    var date = toDateKey_(cell_(row, col.date), sheetTz) ||
      toDateKey_(cell_(row, col.sent_at), CONFIG.TIME_ZONE);
    if (!channel || !date) {
      skipped++;
      continue;
    }

    var weekStart = cleanKey_(cell_(row, col.week_start), /^\d{4}-\d{2}-\d{2}$/) || mondayOf_(date);
    var month = cleanKey_(cell_(row, col.month), /^\d{4}-\d{2}$/) || date.slice(0, 7);
    var userName = String(cell_(row, col.user_name) || '').trim() || '(unassigned)';

    rows.push([
      channel,
      userName,
      date,
      weekStart,
      month,
      toBool_(cell_(row, col.via_sequence)),
      channel === 'email' ? toBool_(cell_(row, col.opened)) : false,
      toBool_(cell_(row, col.responded))
    ]);

    var checked = toMillis_(cell_(row, col.last_checked));
    if (checked !== null && (lastChecked === null || checked > lastChecked)) lastChecked = checked;
  }

  return {
    fields: PAYLOAD_FIELDS.slice(),
    rows: rows,
    row_count: rows.length,
    skipped_rows: skipped,
    last_updated: lastChecked === null ? null : new Date(lastChecked).toISOString(),
    generated_at: now.toISOString()
  };
}

function cell_(row, index) {
  return index >= 0 && row && index < row.length ? row[index] : null;
}

function isBlankRow_(row) {
  if (!row) return true;
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== '' && row[i] !== null && row[i] !== undefined) return false;
  }
  return true;
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

/** Accepts JS booleans, 'TRUE'/'FALSE'/'true'/'yes'/'1', and numbers. Blank = false. */
function toBool_(v) {
  if (v === true || v === false) return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null || v === undefined) return false;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y' || s === '1';
}

function normalizeChannel_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return s === 'email' || s === 'sms' ? s : '';
}

/** Returns 'YYYY-MM-DD' for a text date, an ISO datetime, or a Date cell; null otherwise. */
function toDateKey_(v, timeZone) {
  if (v === null || v === undefined || v === '') return null;
  if (isDate_(v)) return Utilities.formatDate(v, timeZone, 'yyyy-MM-dd');
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var ms = Date.parse(s);
  if (isNaN(ms)) return null;
  return Utilities.formatDate(new Date(ms), timeZone, 'yyyy-MM-dd');
}

/** Only trusts week_start / month cells that are already clean text keys. */
function cleanKey_(v, pattern) {
  if (v === null || v === undefined || isDate_(v)) return null;
  var s = String(v).trim();
  return pattern.test(s) ? s : null;
}

function mondayOf_(dateKey) {
  var p = dateKey.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function toMillis_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (isDate_(v)) return v.getTime();
  var ms = Date.parse(String(v).trim());
  return isNaN(ms) ? null : ms;
}

function writeCache_(cache, payload) {
  try {
    var json = JSON.stringify(payload);
    var size = CONFIG.CACHE_CHUNK_CHARS;
    var count = Math.ceil(json.length / size) || 1;
    var stamp = String(Date.now());
    var entries = {};
    for (var i = 0; i < count; i++) {
      entries[CONFIG.CACHE_KEY + '_' + stamp + '_' + i] = json.substr(i * size, size);
    }
    cache.putAll(entries, CONFIG.CACHE_SECONDS);
    cache.put(CONFIG.CACHE_KEY, stamp + ':' + count, CONFIG.CACHE_SECONDS);
  } catch (e) {
    console.warn('Dashboard cache write skipped: ' + e);
  }
}

function readCache_(cache) {
  try {
    var manifest = cache.get(CONFIG.CACHE_KEY);
    if (!manifest) return null;
    var parts = manifest.split(':');
    var count = parseInt(parts[1], 10);
    if (!parts[0] || !(count > 0)) return null;
    var keys = [];
    for (var i = 0; i < count; i++) keys.push(CONFIG.CACHE_KEY + '_' + parts[0] + '_' + i);
    var got = cache.getAll(keys);
    var json = '';
    for (var k = 0; k < keys.length; k++) {
      if (got[keys[k]] === null || got[keys[k]] === undefined) return null;
      json += got[keys[k]];
    }
    return JSON.parse(json);
  } catch (e) {
    console.warn('Dashboard cache read skipped: ' + e);
    return null;
  }
}
