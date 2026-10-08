#!/usr/bin/env node
/*
 * Unit checks for the server payload builder (src/Code.gs) and the client
 * aggregation module (src/Metrics.html). Plain Node, no dependencies:
 *
 *   node tests/aggregation.test.js
 *
 * All rows below are synthetic.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = path.resolve(__dirname, '..', 'src');

/* ---------- load the real source files ---------- */

function formatInZone(date, timeZone, pattern) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  if (pattern === 'yyyy-MM-dd') return `${get('year')}-${get('month')}-${get('day')}`;
  if (pattern === 'yyyy-MM') return `${get('year')}-${get('month')}`;
  throw new Error('Utilities.formatDate stub does not support ' + pattern);
}

// Each test installs its own Sheets / CacheService fakes on the context (see fakeSheets below).
const server = vm.createContext({
  console,
  Utilities: { formatDate: formatInZone }
});
vm.runInContext(fs.readFileSync(path.join(src, 'Code.gs'), 'utf8'), server, { filename: 'Code.gs' });

const metricsSource = fs.readFileSync(path.join(src, 'Metrics.html'), 'utf8')
  .replace(/^\s*<script>/, '')
  .replace(/<\/script>\s*$/, '');
const clientModule = { exports: {} };
vm.runInContext(metricsSource, vm.createContext({ module: clientModule, Intl }), { filename: 'Metrics.html' });
const M = clientModule.exports;

/* ---------- tiny harness ---------- */

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err });
  }
}
// Values created inside a vm context have that context's prototypes; compare as plain JSON.
const plain = (v) => JSON.parse(JSON.stringify(v));
const deepEqual = (actual, expected, msg) => assert.deepStrictEqual(plain(actual), plain(expected), msg);

/* ---------- fixtures ---------- */

// Columns A-Q, then the sequence columns R-X appended after last_checked.
const V1_HEADER = ['activity_id', 'channel', 'user_name', 'user_id', 'lead_id', 'lead_name', 'sent_at',
  'date', 'week_start', 'month', 'template_name', 'via_sequence', 'opened', 'first_opened_at',
  'responded', 'responded_at', 'last_checked'];
const SEQ_COLUMNS = ['sequence_id', 'sequence_name', 'template_id', 'template_label', 'step_label',
  'manual_label', 'lead_key'];
const HEADER = V1_HEADER.concat(SEQ_COLUMNS);

const FIELDS = ['channel', 'user_name', 'date', 'week_start', 'month', 'via_sequence', 'opened', 'responded',
  'sequence_name', 'template_label', 'step_label', 'manual_label', 'lead_key'];
const SEQ_FIELDS = ['sequence_name', 'template_label', 'step_label', 'manual_label', 'lead_key'];
const AR = 'AR - Upcoming Payment Reminders';

function rowFor(header, o) {
  return header.map((h) => (h in o ? o[h] : ''));
}
function sheetRow(o) {
  return rowFor(HEADER, o);
}

const RAW_TEXT = 'Hi Synthetic Lead Alpha, your $450.00 payment is due 10/12. Call +1 (555) 010-0199 or synthetic.alpha@example.com';
const SECRET_STRINGS = ['acti_SECRET1', 'lead_SECRET1', 'Synthetic Lead Alpha', 'Synthetic', 'Alpha',
  'Template with +1 555 0100', 'seq_SECRET1', 'tmpl_SECRET1', 'synthetic.alpha@example.com', '555', '0199',
  '450', RAW_TEXT];

const sheetValues = [
  HEADER,
  sheetRow({ activity_id: 'acti_SECRET1', channel: 'email', user_name: 'Jasmine Bosley', lead_id: 'lead_SECRET1',
    lead_name: 'Synthetic Lead Alpha', template_name: 'Template with +1 555 0100', sent_at: '2026-10-05T16:00:00.000Z',
    date: '2026-10-05', week_start: '2026-10-05', month: '2026-10', via_sequence: true, opened: true,
    responded: false, last_checked: '2026-10-06T13:00:00.000Z', sequence_id: 'seq_SECRET1', sequence_name: AR,
    template_id: 'tmpl_SECRET1', template_label: 'Payment reminder - 7 days out', step_label: 'Step 1 - email',
    lead_key: 'A1B2C3D4E5F6' }),
  sheetRow({ channel: 'EMAIL', user_name: 'Myles Thompson', date: '2026-10-06', week_start: '2026-10-05',
    month: '2026-10', via_sequence: 'FALSE', opened: 'TRUE', responded: 'true',
    last_checked: new Date('2026-10-07T13:00:00.000Z'), template_label: 'Payment link resend',
    manual_label: 'Template: Payment link resend', lead_key: '0123456789ab' }),
  sheetRow({ channel: 'sms', user_name: 'Crystal Belmontes', date: new Date('2026-10-04T19:00:00.000Z'),
    week_start: '', month: new Date('2026-10-01T07:00:00.000Z'), via_sequence: 'TRUE', opened: 'TRUE',
    responded: 'FALSE', last_checked: '2026-10-05T13:00:00.000Z', sequence_name: `  ${AR} `,
    step_label: 'Step 2 - sms', lead_key: 'a1b2c3d4e5f6' }),
  // Un-normalized free text (n8n should never write this) is still scrubbed on the server.
  sheetRow({ channel: 'sms', user_name: 'Jasmine Bosley', sent_at: '2026-09-30T23:30:00.000Z', date: '',
    via_sequence: 'false', opened: '', responded: 'TRUE', lead_name: 'Synthetic Lead Alpha',
    manual_label: RAW_TEXT, lead_key: 'synthetic.alpha@example.com' }),
  sheetRow({}),
  sheetRow({ channel: 'call', user_name: 'Myles Thompson', date: '2026-10-06' })
];

/* ---------- server: boolean normalization + privacy ---------- */

test('server toBool_ normalizes JS booleans and TRUE/FALSE strings', () => {
  const t = server.toBool_;
  [true, 'TRUE', 'true', ' True ', 'yes', 'Y', '1', 1].forEach((v) => assert.strictEqual(t(v), true, String(v)));
  [false, 'FALSE', 'false', 'no', '', '0', 0, null, undefined].forEach((v) => assert.strictEqual(t(v), false, String(v)));
});

test('client Metrics.toBool matches the server for the same inputs', () => {
  [true, false, 'TRUE', 'FALSE', 'true', 'false', '', null, 1, 0, 'yes'].forEach((v) => {
    assert.strictEqual(M.toBool(v), server.toBool_(v), String(v));
  });
});

const payload = plain(server.buildPayload_(sheetValues, {
  now: new Date('2026-10-07T16:00:00.000Z'),
  sheetTimeZone: 'America/Phoenix'
}));

test('payload sends exactly the thirteen allowed fields per row', () => {
  deepEqual(payload.fields, FIELDS);
  payload.rows.forEach((r) => assert.strictEqual(r.length, FIELDS.length));
  deepEqual(Object.keys(payload).sort(),
    ['fields', 'generated_at', 'last_updated', 'missing_columns', 'row_count', 'rows', 'skipped_rows']);
  deepEqual(payload.missing_columns, []);
});

test('payload never contains lead names, emails, phones, ids or raw text', () => {
  const json = JSON.stringify(payload);
  SECRET_STRINGS.forEach((s) => assert.ok(!json.includes(s), 'leaked: ' + s));
  ['lead_name', 'lead_id', 'activity_id', 'template_name', 'user_id', 'sequence_id', 'template_id']
    .forEach((f) => assert.ok(!json.includes(f), 'leaked field: ' + f));
  assert.ok(!/@/.test(json), 'no email-like text');
  payload.rows.forEach((r) => {
    const values = r.slice(FIELDS.indexOf('sequence_name'));
    values.forEach((v) => assert.ok(String(v).length <= 100, 'label over 100 chars: ' + v));
  });
});

test('payload rows are normalized (booleans, Date cells, derived week/month, sent_at fallback)', () => {
  assert.strictEqual(payload.row_count, 4);
  assert.strictEqual(payload.skipped_rows, 1, 'unknown channel skipped, blank row ignored');
  deepEqual(payload.rows[0], ['email', 'Jasmine Bosley', '2026-10-05', '2026-10-05', '2026-10', true, true, false,
    AR, 'Payment reminder - 7 days out', 'Step 1 - email', '', 'a1b2c3d4e5f6']);
  deepEqual(payload.rows[1], ['email', 'Myles Thompson', '2026-10-06', '2026-10-05', '2026-10', false, true, true,
    '', 'Payment link resend', '', 'Template: Payment link resend', '0123456789ab']);
  // Date cell -> sheet-zone date; blank week_start -> Monday; Date month cell -> from date; SMS opened forced false.
  deepEqual(payload.rows[2], ['sms', 'Crystal Belmontes', '2026-10-04', '2026-09-28', '2026-10', true, false, false,
    AR, '', 'Step 2 - sms', '', 'a1b2c3d4e5f6']);
  // No date: falls back to sent_at in America/Phoenix (23:30Z on Sep 30 = 16:30 MST Sep 30).
  // Raw free text loses the lead name, $ amount, digits, phone and email; a non-hash lead_key is dropped.
  deepEqual(payload.rows[3], ['sms', 'Jasmine Bosley', '2026-09-30', '2026-09-28', '2026-09', false, false, true,
    '', '', '', 'Hi, your payment is due Call or', '']);
});

test('only whitelisted columns are sent, even if the sheet grows extra text columns', () => {
  const header = HEADER.concat(['email_body', 'phone', 'subject']);
  const p = plain(server.buildPayload_([header, rowFor(header, {
    channel: 'email', user_name: 'Myles Thompson', date: '2026-10-06', lead_name: 'Synthetic Lead Beta',
    email_body: 'Dear Synthetic Lead Beta, raw body text', phone: '+15550100123', subject: 'Raw subject line',
    sequence_name: AR, lead_key: 'ffffffffffff'
  })], { now: new Date(0) }));
  deepEqual(p.fields, FIELDS);
  const json = JSON.stringify(p);
  ['Synthetic Lead Beta', 'raw body text', '15550100123', 'Raw subject line', 'email_body', 'subject']
    .forEach((s) => assert.ok(!json.includes(s), 'leaked: ' + s));
});

test('label cleaning: templates keep their digits, free text is capped at 100 chars', () => {
  assert.strictEqual(server.cleanManualLabel_('Template: Day 3 reminder', 'X Y'), 'Template: Day 3 reminder');
  assert.strictEqual(server.cleanManualLabel_('Template: Reach me at a.b@example.com', ''), 'Template: Reach me at');
  const long = server.cleanManualLabel_('word '.repeat(60), '');
  assert.ok(long.length <= 100 && long.length > 90);
  assert.strictEqual(server.cleanManualLabel_('thanks Jo-Anne O\'Neil for the update', "Jo-Anne O'Neil"),
    'thanks for the update');
  assert.strictEqual(server.cleanLabel_(null), '');
  assert.strictEqual(server.cleanLeadKey_('ABCDEF012345'), 'abcdef012345');
  ['lead_abc', 'abcdef01234', 'abcdef0123456', 'ghijklmnopqr', ''].forEach((v) =>
    assert.strictEqual(server.cleanLeadKey_(v), '', v));
});

test('missing sequence columns: rows still build, new fields are blank, missing_columns lists them', () => {
  const v1 = plain(server.buildPayload_([V1_HEADER,
    rowFor(V1_HEADER, { channel: 'email', user_name: 'Myles Thompson', date: '2026-10-06', via_sequence: true })],
  { now: new Date(0) }));
  deepEqual(v1.fields, FIELDS);
  deepEqual(v1.rows, [['email', 'Myles Thompson', '2026-10-06', '2026-10-05', '2026-10', true, false, false,
    '', '', '', '', '']]);
  deepEqual(v1.missing_columns, SEQ_FIELDS);

  const partial = plain(server.buildPayload_([V1_HEADER.concat(['sequence_name']),
    rowFor(V1_HEADER.concat(['sequence_name']), { channel: 'sms', user_name: 'X', date: '2026-10-06', sequence_name: AR })],
  { now: new Date(0) }));
  deepEqual(partial.missing_columns, ['template_label', 'step_label', 'manual_label', 'lead_key']);
  assert.strictEqual(partial.rows[0][8], AR);
});

test('last_updated is the max of last_checked across string and Date cells', () => {
  assert.strictEqual(payload.last_updated, '2026-10-07T13:00:00.000Z');
  assert.strictEqual(payload.generated_at, '2026-10-07T16:00:00.000Z');
});

test('missing required columns raise a clear error; empty sheet is fine', () => {
  assert.throws(() => server.buildPayload_([['channel', 'date'], ['email', '2026-10-01']], {}), /user_name/);
  const empty = plain(server.buildPayload_([], { now: new Date(0) }));
  assert.strictEqual(empty.row_count, 0);
  assert.strictEqual(empty.last_updated, null);
  const headerOnly = plain(server.buildPayload_([HEADER], { now: new Date(0) }));
  deepEqual(headerOnly.rows, []);
});

/* ---------- server: reading the sheet through the Sheets Advanced Service ---------- */

const SHEET_ID = '13ZrIQkxulhjES49I8i36VtJ-jiY_A_kv1NxraHERrYs';

/** Fake of the Sheets v4 Advanced Service: Spreadsheets.get + Spreadsheets.Values.get. */
function fakeSheets({ tabs, values, timeZone = 'America/Phoenix' }) {
  const calls = { get: [], values: [] };
  const valueRange = { range: 'messages!A1:Q9', majorDimension: 'ROWS' };
  if (values !== undefined) valueRange.values = values;
  const service = {
    Spreadsheets: {
      get: (id, opts) => {
        calls.get.push({ id, opts });
        return { properties: { timeZone }, sheets: tabs.map((p) => ({ properties: p })) };
      },
      Values: {
        get: (id, range, opts) => {
          calls.values.push({ id, range, opts });
          return JSON.parse(JSON.stringify(valueRange));
        }
      }
    }
  };
  return { service, calls };
}

function fakeCache() {
  const store = new Map();
  return {
    get: (k) => (store.has(k) ? store.get(k) : null),
    put: (k, v) => { store.set(k, v); },
    getAll: (keys) => Object.fromEntries(keys.filter((k) => store.has(k)).map((k) => [k, store.get(k)])),
    putAll: (entries) => { Object.entries(entries).forEach(([k, v]) => store.set(k, v)); }
  };
}

function installServer(sheetsOpts) {
  const sheets = fakeSheets(sheetsOpts);
  const cache = fakeCache();
  server.Sheets = sheets.service;
  server.CacheService = { getScriptCache: () => cache };
  return sheets.calls;
}

const MESSAGES_TAB = { sheetId: 2122950652, title: 'messages' };

// Sheets API shape: UNFORMATTED_VALUE gives real booleans, FORMATTED_STRING gives date strings,
// trailing empty cells are omitted and empty rows come back as [].
const apiValues = [
  HEADER,
  ['acti_SECRET2', 'email', 'Jasmine Bosley', 'user_1', 'lead_SECRET2', 'Synthetic Lead Beta',
    '2026-10-06T16:00:00.000Z', '2026-10-06', '2026-10-05', '2026-10', 'Template with +1 555 0100',
    true, true, '2026-10-06T17:00:00.000Z', true, '2026-10-06T18:00:00.000Z', '2026-10-07T13:00:00.000Z',
    'seq_SECRET2', AR, 'tmpl_SECRET2', 'Payment reminder - 7 days out', 'Step 1 - email', '', 'abcdefabcdef'],
  ['', 'sms', 'Myles Thompson', '', '', '', '', '2026-10-07', '', '', '', false],
  [],
  ['', 'email', 'Crystal Belmontes', '', '', '', '', '2026-10-01', '2026-09-28', '2026-10', '', true, false,
    '', false, '', '2026-10-02T13:00:00.000Z'],
  ['', 'sms']
];

test('padRows_ pads ragged API rows to the widest row', () => {
  deepEqual(server.padRows_([['a', 'b', 'c'], ['x'], []]), [['a', 'b', 'c'], ['x', '', ''], ['', '', '']]);
  deepEqual(server.padRows_([]), []);
});

test('getDashboardData reads the gid tab via Sheets with unformatted values and string dates', () => {
  const calls = installServer({ tabs: [{ sheetId: 0, title: 'Summary' }, MESSAGES_TAB], values: apiValues });
  const p = plain(server.getDashboardData(true));

  assert.strictEqual(calls.get.length, 1);
  assert.strictEqual(calls.get[0].id, SHEET_ID);
  assert.match(calls.get[0].opts.fields, /sheets\.properties\(sheetId,title\)/);
  deepEqual(calls.values, [{ id: SHEET_ID, range: "'messages'",
    opts: { valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING' } }]);

  assert.strictEqual(p.from_cache, false);
  assert.strictEqual(p.row_count, 3);
  assert.strictEqual(p.skipped_rows, 1, 'row with a channel but no date is skipped; [] row ignored');
  deepEqual(p.rows, [
    ['email', 'Jasmine Bosley', '2026-10-06', '2026-10-05', '2026-10', true, true, true,
      AR, 'Payment reminder - 7 days out', 'Step 1 - email', '', 'abcdefabcdef'],
    // Ragged row: missing opened / responded / last_checked / sequence columns read as blank; week and month derived.
    ['sms', 'Myles Thompson', '2026-10-07', '2026-10-05', '2026-10', false, false, false, '', '', '', '', ''],
    ['email', 'Crystal Belmontes', '2026-10-01', '2026-09-28', '2026-10', true, false, false, '', '', '', '', '']
  ]);
  assert.strictEqual(p.last_updated, '2026-10-07T13:00:00.000Z');
  deepEqual(Object.keys(p).sort(),
    ['fields', 'from_cache', 'generated_at', 'last_updated', 'missing_columns', 'row_count', 'rows', 'skipped_rows']);
  const json = JSON.stringify(p);
  ['acti_SECRET2', 'lead_SECRET2', 'Synthetic Lead Beta', 'Template with +1 555 0100', 'user_1',
    'seq_SECRET2', 'tmpl_SECRET2'].forEach((s) => assert.ok(!json.includes(s), 'leaked: ' + s));
});

test('getDashboardData serves the cache until forceRefresh', () => {
  const calls = installServer({ tabs: [MESSAGES_TAB], values: apiValues });
  const first = plain(server.getDashboardData());
  const second = plain(server.getDashboardData());
  assert.strictEqual(first.from_cache, false);
  assert.strictEqual(second.from_cache, true);
  deepEqual(second.rows, first.rows);
  assert.strictEqual(calls.values.length, 1, 'second call must not re-read the sheet');
  assert.strictEqual(plain(server.getDashboardData(true)).from_cache, false);
  assert.strictEqual(calls.values.length, 2);
});

test('tab lookup: gid wins, then the "messages" title, else a clear error; titles are quoted', () => {
  let calls = installServer({ tabs: [{ sheetId: 1, title: 'messages' }, { sheetId: 2122950652, title: "Rep's log" }],
    values: apiValues });
  server.getDashboardData(true);
  assert.strictEqual(calls.values[0].range, "'Rep''s log'");

  calls = installServer({ tabs: [{ sheetId: 0, title: 'Summary' }, { sheetId: 99, title: 'messages' }], values: apiValues });
  server.getDashboardData(true);
  assert.strictEqual(calls.values[0].range, "'messages'");

  installServer({ tabs: [{ sheetId: 0, title: 'Summary' }], values: apiValues });
  assert.throws(() => server.getDashboardData(true), /Could not find the messages tab/);
});

test('an empty tab (API omits values) yields an empty payload', () => {
  installServer({ tabs: [MESSAGES_TAB] });
  const p = plain(server.getDashboardData(true));
  assert.strictEqual(p.row_count, 0);
  assert.strictEqual(p.last_updated, null);
});

/* ---------- client: expand + bucketing ---------- */

const rows = M.expandRows(payload);

test('expandRows turns array rows into objects and keeps them all', () => {
  assert.strictEqual(rows.length, 4);
  deepEqual(plain(rows[1]), {
    channel: 'email', user_name: 'Myles Thompson', date: '2026-10-06', week_start: '2026-10-05',
    month: '2026-10', via_sequence: false, opened: true, responded: true,
    sequence_name: '', template_label: 'Payment link resend', step_label: '',
    manual_label: 'Template: Payment link resend', lead_key: '0123456789ab'
  });
  const fromObjects = M.expandRows({ fields: payload.fields, rows: [
    { channel: 'SMS', user_name: 'Myles Thompson', date: '2026-10-07', via_sequence: 'TRUE', opened: 'TRUE', responded: 'true' },
    { channel: 'email', user_name: 'X', date: 'not-a-date' }
  ] });
  assert.strictEqual(fromObjects.length, 1);
  deepEqual(plain(fromObjects[0]), {
    channel: 'sms', user_name: 'Myles Thompson', date: '2026-10-07', week_start: '2026-10-05',
    month: '2026-10', via_sequence: true, opened: false, responded: true,
    sequence_name: '', template_label: '', step_label: '', manual_label: '', lead_key: ''
  });
});

test('mondayOf handles Monday, mid-week, Sunday and year boundaries', () => {
  assert.strictEqual(M.mondayOf('2026-10-05'), '2026-10-05');
  assert.strictEqual(M.mondayOf('2026-10-07'), '2026-10-05');
  assert.strictEqual(M.mondayOf('2026-10-11'), '2026-10-05');
  assert.strictEqual(M.mondayOf('2027-01-01'), '2026-12-28');
});

test('bucketRange fills every day / week / month in the range', () => {
  deepEqual(M.bucketRange('2026-09-29', '2026-10-02', 'day'),
    ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  deepEqual(M.bucketRange('2026-09-30', '2026-10-14', 'week'),
    ['2026-09-28', '2026-10-05', '2026-10-12']);
  deepEqual(M.bucketRange('2026-11-15', '2027-02-01', 'month'),
    ['2026-11', '2026-12', '2027-01', '2027-02']);
  deepEqual(M.bucketRange('2026-10-02', '2026-10-01', 'day'), []);
});

test('trend buckets by date / week_start / month with zero-filled gaps', () => {
  const day = M.trend(rows, 'day', { start: '2026-09-30', end: '2026-10-06' });
  assert.strictEqual(day.keys.length, 7);
  deepEqual(day.series.emailsSent, [0, 0, 0, 0, 0, 1, 1]);
  deepEqual(day.series.smsSent, [1, 0, 0, 0, 1, 0, 0]);
  deepEqual(day.series.responses, [1, 0, 0, 0, 0, 0, 1]);

  const week = M.trend(rows, 'week', {});
  deepEqual(week.keys, ['2026-09-28', '2026-10-05']);
  deepEqual(week.series.total, [2, 2]);
  deepEqual(week.byUser['Jasmine Bosley'].total, [1, 1]);
  deepEqual(week.byUser['Crystal Belmontes'].smsSent, [1, 0]);

  const month = M.trend(rows, 'month', {});
  deepEqual(month.keys, ['2026-09', '2026-10']);
  deepEqual(month.series.total, [1, 3]);
  deepEqual(month.series.responses, [1, 1]);
});

test('bucket labels read naturally', () => {
  assert.strictEqual(M.bucketLabel('2026-10-05', 'day'), 'Oct 5');
  assert.strictEqual(M.bucketLabel('2026-10-05', 'week'), 'Wk of Oct 5');
  assert.strictEqual(M.bucketLabel('2026-10', 'month'), 'Oct 2026');
  assert.strictEqual(M.formatRange('2026-09-08', '2026-10-07'), 'Sep 8 \u2013 Oct 7, 2026');
});

/* ---------- client: filters ---------- */

test('date filter is inclusive on both ends', () => {
  assert.strictEqual(M.filterRows(rows, { start: '2026-10-04', end: '2026-10-05' }).length, 2);
  assert.strictEqual(M.filterRows(rows, { start: '2026-10-06' }).length, 1);
  assert.strictEqual(M.filterRows(rows, { end: '2026-09-30' }).length, 1);
});

test('user filter: null = everyone, [] = nobody, subset = subset', () => {
  assert.strictEqual(M.filterRows(rows, { users: null }).length, 4);
  assert.strictEqual(M.filterRows(rows, { users: [] }).length, 0);
  assert.strictEqual(M.filterRows(rows, { users: ['Jasmine Bosley'] }).length, 2);
  assert.strictEqual(M.filterRows(rows, { users: ['Jasmine Bosley', 'Crystal Belmontes'] }).length, 3);
});

test('sequence / manual / all filter on via_sequence', () => {
  assert.strictEqual(M.filterRows(rows, { mode: 'sequence' }).length, 2);
  assert.strictEqual(M.filterRows(rows, { mode: 'manual' }).length, 2);
  assert.strictEqual(M.filterRows(rows, { mode: 'all' }).length, 4);
  assert.strictEqual(M.filterRows(rows, { mode: 'manual', users: ['Myles Thompson'], start: '2026-10-06' }).length, 1);
});

/* ---------- client: KPIs and rates ---------- */

test('summarize counts and rates', () => {
  const s = M.summarize(rows);
  deepEqual(
    [s.emailsSent, s.emailsOpened, s.emailsResponded, s.smsSent, s.smsResponded, s.totalSent, s.totalResponded],
    [2, 2, 1, 2, 1, 4, 2]);
  assert.strictEqual(s.openRate, 1);
  assert.strictEqual(s.responseRate, 0.5);
});

test('rates are null (shown as a dash) when there is nothing to divide by', () => {
  const s = M.summarize(M.filterRows(rows, { users: ['Crystal Belmontes'] }));
  assert.strictEqual(s.emailsSent, 0);
  assert.strictEqual(s.openRate, null);
  assert.strictEqual(s.responseRate, 0);
  const none = M.summarize([]);
  assert.strictEqual(none.openRate, null);
  assert.strictEqual(none.responseRate, null);
  assert.strictEqual(M.formatPct(null), '\u2014');
  assert.strictEqual(M.formatPct(0.4567), '45.7%');
});

test('byUser returns one row per requested rep, including reps with no rows', () => {
  const stats = M.byUser(rows, M.REPS.concat(['Nobody']));
  deepEqual(stats.map((s) => [s.user, s.totalSent, s.totalResponded]), [
    ['Jasmine Bosley', 2, 1], ['Myles Thompson', 1, 1], ['Crystal Belmontes', 1, 0], ['Nobody', 0, 0]
  ]);
  assert.strictEqual(stats[1].responseRate, 1);
});

test('listUsers puts the three reps first, then others alphabetically', () => {
  const extra = rows.concat([{ user_name: 'Zed', date: '2026-10-01' }, { user_name: 'Amy', date: '2026-10-01' }]);
  deepEqual(M.listUsers(extra), ['Jasmine Bosley', 'Myles Thompson', 'Crystal Belmontes', 'Amy', 'Zed']);
});

/* ---------- client: periods and change vs previous ---------- */

test('todayKey uses America/Phoenix', () => {
  assert.strictEqual(M.todayKey(new Date('2026-10-08T05:30:00Z')), '2026-10-07');
  assert.strictEqual(M.todayKey(new Date('2026-10-08T07:30:00Z')), '2026-10-08');
});

test('presets produce inclusive ranges ending today', () => {
  deepEqual(plain(M.presetRange('last7', '2026-10-07')), { start: '2026-10-01', end: '2026-10-07' });
  deepEqual(plain(M.presetRange('last30', '2026-10-07')), { start: '2026-09-08', end: '2026-10-07' });
  deepEqual(plain(M.presetRange('last90', '2026-10-07')), { start: '2026-07-10', end: '2026-10-07' });
  deepEqual(plain(M.presetRange('thisMonth', '2026-10-07')), { start: '2026-10-01', end: '2026-10-07' });
  deepEqual(plain(M.presetRange('all', '2026-10-07')), { start: null, end: null });
});

test('previousRange is the equal-length period right before', () => {
  deepEqual(plain(M.previousRange('2026-10-01', '2026-10-07')),
    { start: '2026-09-24', end: '2026-09-30', days: 7 });
  deepEqual(plain(M.previousRange('2026-03-01', '2026-03-31')),
    { start: '2026-01-29', end: '2026-02-28', days: 31 });
  assert.strictEqual(M.previousRange(null, null), null);
  assert.strictEqual(M.previousRange('2026-10-01', null), null);
});

test('change: percent for counts, points for rates, sensible edge cases', () => {
  deepEqual(plain(M.change(12, 10, 'count')), { dir: 'up', label: '+20.0%' });
  deepEqual(plain(M.change(5, 10, 'count')), { dir: 'down', label: '\u221250.0%' });
  deepEqual(plain(M.change(3, 0, 'count')), { dir: 'up', label: 'new' });
  deepEqual(plain(M.change(0, 0, 'count')), { dir: 'flat', label: 'no change' });
  deepEqual(plain(M.change(0.5, 0.4, 'rate')), { dir: 'up', label: '+10.0 pts' });
  deepEqual(plain(M.change(0.3, 0.45, 'rate')), { dir: 'down', label: '\u221215.0 pts' });
  deepEqual(plain(M.change(null, 0.4, 'rate')), { dir: 'na', label: 'n/a' });
});

/* ---------- client: sequences ---------- */

const PD = 'AR - Past Due Follow-up';
const RE = 'Reinstatement Offer';
const FOLLOW = 'following up on your payment';
const QUICK = 'quick question about your account';
const K = (n) => n.toString(16).padStart(12, '0');
const sr = (o) => Object.assign({ channel: 'email', user_name: 'Jasmine Bosley', date: '2026-10-05', via_sequence: false,
  opened: false, responded: false, sequence_name: '', template_label: '', step_label: '', manual_label: '', lead_key: '' }, o);

const seqRows = M.expandRows({ fields: FIELDS, rows: [
  sr({ via_sequence: true, sequence_name: AR, step_label: 'Step 1 - email', opened: true, lead_key: K(1) }),
  sr({ channel: 'sms', via_sequence: true, sequence_name: AR, step_label: 'Step 2 - sms', responded: true, lead_key: K(1) }),
  sr({ user_name: 'Myles Thompson', date: '2026-10-06', via_sequence: true, sequence_name: AR, step_label: 'Step 1 - email',
    opened: true, responded: true, lead_key: K(2) }),
  sr({ user_name: 'Crystal Belmontes', date: '2026-10-12', via_sequence: true, sequence_name: AR,
    template_label: 'Payment reminder - day of', lead_key: K(3) }),
  sr({ user_name: 'Myles Thompson', date: '2026-10-06', sequence_name: PD, step_label: 'Step 1 - email', lead_key: K(4) }),
  sr({ channel: 'sms', user_name: 'Myles Thompson', date: '2026-10-13', sequence_name: PD, step_label: 'Step 2 - sms',
    responded: true, lead_key: K(4) }),
  sr({ user_name: 'Crystal Belmontes', date: '2026-10-07', sequence_name: RE, opened: true, lead_key: K(5) }),
  // Manual (no sequence) rows
  sr({ manual_label: 'Template: Card update request', template_label: 'Card update request', lead_key: K(6) }),
  sr({ manual_label: FOLLOW, lead_key: K(6), opened: true }),
  sr({ channel: 'sms', user_name: 'Myles Thompson', manual_label: FOLLOW, lead_key: K(7), responded: true }),
  sr({ manual_label: FOLLOW, lead_key: K(8), date: '2026-10-13' }),
  sr({ user_name: 'Crystal Belmontes', manual_label: FOLLOW, lead_key: K(8) }),
  sr({ manual_label: QUICK, lead_key: K(6) }),
  sr({ manual_label: QUICK, lead_key: K(6), responded: true }),
  sr({ channel: 'sms', manual_label: QUICK, lead_key: K(7) }),
  sr({ manual_label: QUICK, lead_key: '' }),
  sr({ manual_label: 'thanks see you on the call', lead_key: K(9), opened: true }),
  sr({ manual_label: '', lead_key: K(10) }),
  sr({ channel: 'sms', user_name: 'Myles Thompson', manual_label: '', lead_key: K(11) })
] });
const names = (groups) => groups.map((g) => g.name);

test('bySequence: one row per sequence_name, most sends first, Manual (no sequence) last', () => {
  assert.strictEqual(seqRows.length, 19);
  const groups = M.bySequence(seqRows);
  deepEqual(names(groups), [AR, PD, RE, M.MANUAL_SEQUENCE]);
  const ar = groups[0];
  deepEqual([ar.emailsSent, ar.emailsOpened, ar.emailsResponded, ar.smsSent, ar.smsResponded, ar.distinctLeads],
    [3, 2, 1, 1, 1, 3]);
  assert.strictEqual(ar.openRate, 2 / 3);
  assert.strictEqual(ar.responseRate, 0.5);
  assert.strictEqual(ar.isManual, false);
  const manual = groups[3];
  assert.strictEqual(manual.isManual, true);
  assert.strictEqual(manual.totalSent, 12);
  assert.strictEqual(manual.distinctLeads, 6);
});

test('sortSequences: any column, both directions, empty rates last, Manual pinned last', () => {
  const groups = M.bySequence(seqRows);
  deepEqual(names(M.sortSequences(groups, 'name', 'asc')), [PD, AR, RE, M.MANUAL_SEQUENCE]);
  deepEqual(names(M.sortSequences(groups, 'name', 'desc')), [RE, AR, PD, M.MANUAL_SEQUENCE]);
  deepEqual(names(M.sortSequences(groups, 'openRate', 'desc')), [RE, AR, PD, M.MANUAL_SEQUENCE]);
  deepEqual(names(M.sortSequences(groups, 'openRate', 'asc')), [PD, AR, RE, M.MANUAL_SEQUENCE]);
  // PD and RE both have 1 lead; the tie goes to more sends (PD).
  deepEqual(names(M.sortSequences(groups, 'distinctLeads', 'asc')), [PD, RE, AR, M.MANUAL_SEQUENCE]);
  const withNull = [{ name: 'x', openRate: null, totalSent: 1 }, { name: 'y', openRate: 0.1, totalSent: 1 }];
  deepEqual(names(M.sortSequences(withNull, 'openRate', 'asc')), ['y', 'x']);
  deepEqual(names(M.sortSequences(withNull, 'openRate', 'desc')), ['y', 'x']);
});

test('sequenceDetail: per-rep split and per-step breakdown (step_label, then template_label)', () => {
  const d = M.sequenceDetail(M.rowsForSequence(seqRows, AR), M.REPS);
  deepEqual(d.reps.map((s) => [s.user, s.totalSent, s.totalResponded, s.distinctLeads]),
    [['Jasmine Bosley', 2, 1, 1], ['Myles Thompson', 1, 1, 1], ['Crystal Belmontes', 1, 0, 1]]);
  deepEqual(d.steps.map((s) => [s.name, s.totalSent, s.emailsOpened, s.totalResponded, s.distinctLeads]), [
    ['Step 1 - email', 2, 2, 1, 2],
    ['Step 2 - sms', 1, 0, 1, 1],
    ['Payment reminder - day of', 1, 0, 0, 1]
  ]);
  deepEqual(names(M.byStep(M.rowsForSequence(seqRows, RE))), [M.NO_STEP]);
  const mixed = M.expandRows({ fields: FIELDS, rows: [
    sr({ step_label: 'Step 10 - email' }), sr({ step_label: 'Step 2 - sms', channel: 'sms' }),
    sr({ template_label: 'Zeta' }), sr({ template_label: 'Alpha' }), sr({ template_label: 'Alpha' }), sr({})
  ] });
  deepEqual(names(M.byStep(mixed)), ['Step 2 - sms', 'Step 10 - email', 'Alpha', 'Zeta', M.NO_STEP]);
});

test('distinctLeads counts unique non-empty lead_keys (case-insensitive)', () => {
  assert.strictEqual(M.distinctLeads(seqRows), 11);
  assert.strictEqual(M.distinctLeads([]), 0);
  const mixedCase = M.expandRows({ fields: FIELDS, rows: [
    sr({ lead_key: 'ABCDEF000001' }), sr({ lead_key: 'abcdef000001' }), sr({ lead_key: '' })
  ] });
  assert.strictEqual(M.distinctLeads(mixedCase), 1);
});

test('date, rep and Sequence/Manual filters apply to the sequence views', () => {
  const by = (f) => M.bySequence(M.filterRows(seqRows, f)).map((g) => [g.name, g.totalSent]);
  deepEqual(by({ users: ['Myles Thompson'] }), [[PD, 2], [AR, 1], [M.MANUAL_SEQUENCE, 2]]);
  deepEqual(by({ mode: 'sequence' }), [[AR, 4]]);
  deepEqual(by({ mode: 'manual' }), [[PD, 2], [RE, 1], [M.MANUAL_SEQUENCE, 12]]);
  deepEqual(by({ end: '2026-10-06' }), [[AR, 3], [PD, 1], [M.MANUAL_SEQUENCE, 11]]);
  deepEqual(by({ users: [] }), []);

  // The 3-lead threshold is measured inside the filtered window.
  const late = M.topManualMessages(M.filterRows(seqRows, { start: '2026-10-07' }));
  deepEqual(late.top, []);
  assert.strictEqual(late.other.totalSent, 1);
  assert.strictEqual(M.topManualMessages(M.filterRows(seqRows, { mode: 'sequence' })).manualSent, 0);
});

test('sequenceTrend: one series per sequence; topSequenceNames skips Manual', () => {
  const groups = M.bySequence(seqRows);
  deepEqual(M.topSequenceNames(groups, 2), [AR, PD]);
  deepEqual(M.topSequenceNames(groups, 5), [AR, PD, RE]);
  const t = M.sequenceTrend(seqRows, 'week', { names: [AR, PD] });
  deepEqual(t.keys, ['2026-10-05', '2026-10-12']);
  deepEqual(Object.keys(t.bySequence), [AR, PD]);
  deepEqual(t.bySequence[AR].total, [3, 1]);
  deepEqual(t.bySequence[AR].smsSent, [1, 0]);
  deepEqual(t.bySequence[PD].total, [1, 1]);
  deepEqual(t.bySequence[PD].responses, [0, 1]);
  const range = { start: '2026-10-05', end: '2026-10-07' };
  const day = M.sequenceTrend(M.filterRows(seqRows, range), 'day', Object.assign({ names: [RE] }, range));
  deepEqual(day.bySequence[RE].total, [0, 0, 1]);
  deepEqual(Object.keys(M.sequenceTrend(seqRows, 'month', {}).bySequence), [AR, PD, RE, M.MANUAL_SEQUENCE]);
});

test('topManualMessages: templates always rank, free text needs 3 distinct leads, rest rolls up', () => {
  const m = M.topManualMessages(seqRows);
  deepEqual(m.top.map((s) => [s.name, s.totalSent, s.emailsOpened, s.totalResponded, s.distinctLeads]), [
    [FOLLOW, 4, 1, 1, 3],
    ['Template: Card update request', 1, 0, 0, 1]
  ]);
  assert.strictEqual(m.top[0].responseRate, 0.25);
  assert.strictEqual(m.rankedCount, 2);
  // QUICK has 4 sends but only 2 distinct leads (the blank key doesn't count) -> rolled up with the one-off.
  assert.strictEqual(m.other.name, M.OTHER_MANUAL);
  deepEqual([m.other.totalSent, m.other.groupCount, m.other.totalResponded], [5, 2, 1]);
  assert.strictEqual(m.unlabeled.name, M.UNLABELED);
  assert.strictEqual(m.unlabeled.totalSent, 2);
  assert.strictEqual(m.manualSent, 12);
  assert.ok(!m.top.some((s) => s.name === QUICK));
});

test('topManualMessages ranks by sends, ties alphabetically, and keeps only the top 10', () => {
  const list = [];
  for (let i = 1; i <= 12; i++) {
    for (let j = 0; j < i; j++) list.push(sr({ manual_label: 'Template: T' + String(i).padStart(2, '0'), lead_key: K(1) }));
  }
  list.push(sr({ manual_label: 'Template: Tie B', lead_key: K(1) }), sr({ manual_label: 'Template: Tie A', lead_key: K(1) }));
  for (let j = 0; j < 20; j++) list.push(sr({ manual_label: 'popular but only two leads', lead_key: K(j % 2) }));
  const m = M.topManualMessages(M.expandRows({ fields: FIELDS, rows: list }));
  assert.strictEqual(m.top.length, 10);
  assert.strictEqual(m.rankedCount, 14);
  deepEqual(names(m.top), ['T12', 'T11', 'T10', 'T09', 'T08', 'T07', 'T06', 'T05', 'T04', 'T03'].map((t) => 'Template: ' + t));
  assert.strictEqual(m.other.totalSent, 20);
  assert.strictEqual(m.unlabeled, null);
  const ties = M.topManualMessages(M.expandRows({ fields: FIELDS, rows: list }), { limit: 20 });
  deepEqual(names(ties.top).slice(-3), ['Template: T01', 'Template: Tie A', 'Template: Tie B']);
});

test('sequenceDataStatus: missing or unfilled columns degrade; Overview numbers are unaffected', () => {
  assert.strictEqual(M.sequenceDataStatus(payload, M.expandRows(payload)).available, true);

  const v1 = plain(server.buildPayload_([V1_HEADER,
    rowFor(V1_HEADER, { channel: 'email', user_name: 'Myles Thompson', date: '2026-10-06', opened: true })],
  { now: new Date(0) }));
  const v1Rows = M.expandRows(v1);
  deepEqual(plain(M.sequenceDataStatus(v1, v1Rows)), { available: false, reason: 'missing_columns', missing: SEQ_FIELDS });
  assert.strictEqual(M.summarize(v1Rows).emailsOpened, 1);

  // A pre-upgrade cached payload: eight fields, no missing_columns key.
  const oldPayload = { fields: FIELDS.slice(0, 8), rows: [['sms', 'Myles Thompson', '2026-10-06', '', '', true, false, true]] };
  const oldRows = M.expandRows(oldPayload);
  deepEqual(plain(M.sequenceDataStatus(oldPayload, oldRows)).missing, SEQ_FIELDS);
  deepEqual([oldRows[0].sequence_name, oldRows[0].manual_label, oldRows[0].lead_key], ['', '', '']);
  assert.strictEqual(M.summarize(oldRows).smsResponded, 1);
  deepEqual(names(M.bySequence(oldRows)), [M.MANUAL_SEQUENCE]);
  assert.strictEqual(M.topManualMessages(oldRows).unlabeled.totalSent, 1);

  const unfilled = { fields: FIELDS, missing_columns: [], rows: [sr({})] };
  assert.strictEqual(M.sequenceDataStatus(unfilled, M.expandRows(unfilled)).reason, 'not_filled');
  const emptySheet = { fields: FIELDS, missing_columns: [], rows: [] };
  assert.strictEqual(M.sequenceDataStatus(emptySheet, []).available, true);
});

/* ---------- report ---------- */

let failed = 0;
results.forEach((r) => {
  if (r.ok) {
    console.log('  \u2713 ' + r.name);
  } else {
    failed++;
    console.log('  \u2717 ' + r.name + '\n      ' + String(r.err && r.err.message).split('\n').join('\n      '));
  }
});
console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed (' + results.length + ' checks)');
process.exit(failed ? 1 : 0);
