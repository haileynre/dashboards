/*
 * Local-preview stand-in for google.script.run.getDashboardData().
 * Returns SYNTHETIC rows in the same shape the server sends; nothing here is real data.
 *
 * Query params:  ?state=error | empty | slow | noseq    ?delay=<ms>    ?days=120    ?seed=7
 *   noseq = the sheet has no sequence columns yet (old 8-field payload + missing_columns).
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var mode = params.get('state') || 'ok';
  var days = Math.max(1, Math.min(730, parseInt(params.get('days'), 10) || 120));
  var seed = parseInt(params.get('seed'), 10) || 7;

  var BASE_FIELDS = ['channel', 'user_name', 'date', 'week_start', 'month', 'via_sequence', 'opened', 'responded'];
  var SEQ_FIELDS = ['sequence_name', 'template_label', 'step_label', 'manual_label', 'lead_key'];
  var FIELDS = BASE_FIELDS.concat(SEQ_FIELDS);

  // [sequence_name, steps by channel: [step_label, template_label]]
  var AR_REMINDERS = 'AR - Upcoming Payment Reminders';
  var SEQUENCES = {
    ar: [AR_REMINDERS, {
      email: [['Step 1 - email', 'Payment reminder - 7 days out'], ['Step 3 - email', 'Payment reminder - day of']],
      sms: [['Step 2 - sms', 'Payment reminder text - 3 days out'], ['Step 4 - sms', 'Payment reminder text - day of']]
    }],
    pastDue: ['AR - Past Due Follow-up', {
      email: [['Step 1 - email', 'Past due notice'], ['Step 3 - email', 'Final past due notice']],
      sms: [['Step 2 - sms', 'Past due text']]
    }],
    reinstate: ['Reinstatement Offer', {
      email: [['Step 1 - email', 'Reinstatement offer'], ['', 'Reinstatement reminder']],
      sms: [['Step 2 - sms', 'Reinstatement offer text']]
    }]
  };
  var MANUAL_LABELS = [
    'Template: Payment link resend', 'Template: Card update request', 'Template: Payment plan options',
    'following up on your payment', 'checking in on your account', 'your payment did not go through',
    'quick question about your membership', 'confirming your new payment date', ''
  ];
  var ONE_OFF_WORDS = ['thanks', 'call', 'update', 'invoice', 'receipt', 'card', 'schedule', 'question',
    'reply', 'today', 'portal', 'login', 'refund', 'bank'];
  var REPS = [
    { name: 'Jasmine Bosley', email: 3.2, sms: 2.1, seq: 0.75, open: 0.52, reply: 0.16 },
    { name: 'Myles Thompson', email: 2.4, sms: 2.8, seq: 0.6, open: 0.44, reply: 0.12 },
    { name: 'Crystal Belmontes', email: 2.8, sms: 1.6, seq: 0.85, open: 0.48, reply: 0.2 }
  ];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(seed);
  // Separate stream for the sequence columns so the Overview numbers match older screenshots.
  var rand2 = mulberry32(seed + 1000);

  function pick(list) { return list[Math.floor(rand2() * list.length)]; }

  function hex6() { return ('00000' + Math.floor(rand2() * 0x1000000).toString(16)).slice(-6); }
  var LEADS = [];
  for (var l = 0; l < 180; l++) LEADS.push(hex6() + hex6());

  /** Synthetic sequence columns; via_sequence is TRUE only for the AR reminder sequence. */
  function sequenceCols(channel, viaSequence) {
    var lead = pick(LEADS);
    var seq = viaSequence ? SEQUENCES.ar
      : (function (r) { return r < 0.22 ? SEQUENCES.pastDue : r < 0.36 ? SEQUENCES.reinstate : null; })(rand2());
    if (seq) {
      var step = pick(seq[1][channel]);
      return [seq[0], step[1], step[0], '', lead];
    }
    var label = rand2() < 0.3
      ? 're: ' + pick(ONE_OFF_WORDS) + ' ' + pick(ONE_OFF_WORDS) + ' ' + pick(ONE_OFF_WORDS)
      : pick(MANUAL_LABELS);
    var template = label.indexOf('Template: ') === 0 ? label.slice(10) : '';
    return ['', template, '', label, lead];
  }

  function poisson(mean) {
    var l = Math.exp(-mean), k = 0, p = 1;
    do { k++; p *= rand(); } while (p > l);
    return k - 1;
  }

  function phoenixToday() {
    var p = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Phoenix', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    var get = function (t) { return p.filter(function (x) { return x.type === t; })[0].value; };
    return Date.UTC(+get('year'), +get('month') - 1, +get('day'));
  }

  function key(ms) { return new Date(ms).toISOString().slice(0, 10); }

  function buildPayload() {
    var rows = [];
    var today = phoenixToday();
    for (var d = days - 1; d >= 0; d--) {
      var ms = today - d * 86400000;
      var date = new Date(ms);
      var dow = date.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      var monday = key(ms - ((dow + 6) % 7) * 86400000);
      var recent = d < 7;
      REPS.forEach(function (rep) {
        [['email', rep.email], ['sms', rep.sms]].forEach(function (pair) {
          var n = poisson(pair[1]);
          for (var i = 0; i < n; i++) {
            var isEmail = pair[0] === 'email';
            var replyChance = (isEmail ? rep.reply : rep.reply * 1.4) * (recent ? 0.6 : 1);
            var base = [
              pair[0],
              rep.name,
              key(ms),
              monday,
              key(ms).slice(0, 7),
              rand() < rep.seq,
              isEmail && rand() < rep.open,
              rand() < replyChance
            ];
            rows.push(mode === 'noseq' ? base : base.concat(sequenceCols(pair[0], base[5])));
          }
        });
      });
    }
    var updated = new Date(today + 13 * 3600000);
    return {
      fields: mode === 'noseq' ? BASE_FIELDS.slice() : FIELDS.slice(),
      rows: mode === 'empty' ? [] : rows,
      row_count: mode === 'empty' ? 0 : rows.length,
      skipped_rows: 0,
      missing_columns: mode === 'noseq' ? SEQ_FIELDS.slice() : [],
      last_updated: mode === 'empty' ? null : updated.toISOString(),
      generated_at: new Date().toISOString(),
      from_cache: false
    };
  }

  var cached = buildPayload();

  function Runner(success, failure) {
    this._success = success;
    this._failure = failure;
  }
  Runner.prototype.withSuccessHandler = function (fn) { return new Runner(fn, this._failure); };
  Runner.prototype.withFailureHandler = function (fn) { return new Runner(this._success, fn); };
  Runner.prototype.getDashboardData = function (forceRefresh) {
    var self = this;
    var delay = parseInt(params.get('delay'), 10) || (mode === 'slow' ? 2500 : 450);
    setTimeout(function () {
      if (mode === 'error') {
        if (self._failure) self._failure(new Error('Simulated server error (preview ?state=error).'));
        return;
      }
      var payload = JSON.parse(JSON.stringify(cached));
      payload.from_cache = !forceRefresh;
      payload.generated_at = new Date().toISOString();
      if (self._success) self._success(payload);
    }, delay);
  };

  window.google = window.google || {};
  window.google.script = { run: new Runner(null, null) };
  window.__PREVIEW__ = { mode: mode, rowCount: cached.rows.length };
})();
