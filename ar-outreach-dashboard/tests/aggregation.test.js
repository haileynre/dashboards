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

const HEADER = ['activity_id', 'channel', 'user_name', 'user_id', 'lead_id', 'lead_name', 'sent_at',
  'date', 'week_start', 'month', 'template_name', 'via_sequence', 'opened', 'first_opened_at',
  'responded', 'responded_at', 'last_checked'];

function sheetRow(o) {
  return HEADER.map((h) => (h in o ? o[h] : ''));
}

const SECRET_STRINGS = ['acti_SECRET1', 'lead_SECRET1', 'Synthetic Lead Alpha', 'Template with +1 555 0100'];

const sheetValues = [
  HEADER,
  sheetRow({ activity_id: 'acti_SECRET1', channel: 'email', user_name: 'Jasmine Bosley', lead_id: 'lead_SECRET1',
    lead_name: 'Synthetic Lead Alpha', template_name: 'Template with +1 555 0100', sent_at: '2026-10-05T16:00:00.000Z',
    date: '2026-10-05', week_start: '2026-10-05', month: '2026-10', via_sequence: true, opened: true,
    responded: false, last_checked: '2026-10-06T13:00:00.000Z' }),
  sheetRow({ channel: 'EMAIL', user_name: 'Myles Thompson', date: '2026-10-06', week_start: '2026-10-05',
    month: '2026-10', via_sequence: 'FALSE', opened: 'TRUE', responded: 'true',
    last_checked: new Date('2026-10-07T13:00:00.000Z') }),
  sheetRow({ channel: 'sms', user_name: 'Crystal Belmontes', date: new Date('2026-10-04T19:00:00.000Z'),
    week_start: '', month: new Date('2026-10-01T07:00:00.000Z'), via_sequence: 'TRUE', opened: 'TRUE',
    responded: 'FALSE', last_checked: '2026-10-05T13:00:00.000Z' }),
  sheetRow({ channel: 'sms', user_name: 'Jasmine Bosley', sent_at: '2026-09-30T23:30:00.000Z', date: '',
    via_sequence: 'false', opened: '', responded: 'TRUE' }),
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

test('payload sends exactly the eight allowed fields per row', () => {
  deepEqual(payload.fields,
    ['channel', 'user_name', 'date', 'week_start', 'month', 'via_sequence', 'opened', 'responded']);
  payload.rows.forEach((r) => assert.strictEqual(r.length, 8));
  deepEqual(Object.keys(payload).sort(),
    ['fields', 'generated_at', 'last_updated', 'row_count', 'rows', 'skipped_rows']);
});

test('payload never contains lead names, ids or template text', () => {
  const json = JSON.stringify(payload);
  SECRET_STRINGS.forEach((s) => assert.ok(!json.includes(s), 'leaked: ' + s));
  ['lead_name', 'lead_id', 'activity_id', 'template_name', 'user_id'].forEach((f) => assert.ok(!json.includes(f), 'leaked field: ' + f));
});

test('payload rows are normalized (booleans, Date cells, derived week/month, sent_at fallback)', () => {
  assert.strictEqual(payload.row_count, 4);
  assert.strictEqual(payload.skipped_rows, 1, 'unknown channel skipped, blank row ignored');
  deepEqual(payload.rows[0], ['email', 'Jasmine Bosley', '2026-10-05', '2026-10-05', '2026-10', true, true, false]);
  deepEqual(payload.rows[1], ['email', 'Myles Thompson', '2026-10-06', '2026-10-05', '2026-10', false, true, true]);
  // Date cell -> sheet-zone date; blank week_start -> Monday; Date month cell -> from date; SMS opened forced false.
  deepEqual(payload.rows[2], ['sms', 'Crystal Belmontes', '2026-10-04', '2026-09-28', '2026-10', true, false, false]);
  // No date: falls back to sent_at in America/Phoenix (23:30Z on Sep 30 = 16:30 MST Sep 30).
  deepEqual(payload.rows[3], ['sms', 'Jasmine Bosley', '2026-09-30', '2026-09-28', '2026-09', false, false, true]);
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

/* ---------- client: expand + bucketing ---------- */

const rows = M.expandRows(payload);

test('expandRows turns array rows into objects and keeps them all', () => {
  assert.strictEqual(rows.length, 4);
  deepEqual(plain(rows[1]), {
    channel: 'email', user_name: 'Myles Thompson', date: '2026-10-06', week_start: '2026-10-05',
    month: '2026-10', via_sequence: false, opened: true, responded: true
  });
  const fromObjects = M.expandRows({ fields: payload.fields, rows: [
    { channel: 'SMS', user_name: 'Myles Thompson', date: '2026-10-07', via_sequence: 'TRUE', opened: 'TRUE', responded: 'true' },
    { channel: 'email', user_name: 'X', date: 'not-a-date' }
  ] });
  assert.strictEqual(fromObjects.length, 1);
  deepEqual(plain(fromObjects[0]), {
    channel: 'sms', user_name: 'Myles Thompson', date: '2026-10-07', week_start: '2026-10-05',
    month: '2026-10', via_sequence: true, opened: false, responded: true
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
