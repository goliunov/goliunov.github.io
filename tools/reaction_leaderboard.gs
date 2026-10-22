/**
 * Reaction test leaderboard — Google Apps Script web app bound to a Google Sheet.
 * Deploy: Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone.
 * The web app URL goes into config.js as `reactionApi`.
 *
 * GET  ?name=Alex            → { week:[...], all:[...], weekRank, allRank, weekTotal, allTotal }
 * POST {"name":"Alex","ms":213} (Content-Type: text/plain) → same payload after saving
 *
 * One row per player (key = lower-case name): all-time best in column C,
 * this week's best in E with its week start (ms) in F. A new time only
 * updates the row when it is faster.
 *
 * To moderate: open the sheet and delete the player's row.
 */
var SHEET_NAME = 'Results';
var MIN_MS = 100;
var MAX_MS = 1500;
var TOP_N = 20;
var HEADER = ['updated', 'name', 'ms', 'key', 'week_ms', 'week_start'];

// ---------- bad-name filter (same copy in tools/reaction_leaderboard.gs) ----------
var BAD_ANY = ['fuck','fuk','fck','phuck','cunt','nigg','fagg','faggot','shit','bitch','biatch','whore','slut','pussy','bastard',
  'asshole','arsehole','dickhead','bollock','twat','wanker','retard','hitler','porn','penis','vagina','jizz','cocksuck','motherf',
  'dildo','blowjob','handjob','rapist','paedo','pedophil','pedofil','paedophil','nazis'];
var BAD_WORD = ['ass','arse','cock','dick','cum','tit','tits','boob','boobs','anal','sex','rape','nazi','kike','spic','chink','coon',
  'tranny','dyke','fag','homo','wank','piss','crap','hoe','hoes','nonce','prick','knob','scum','negro','pedo','nigga','jew','kkk'];
function badName(name) {
  var leet = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '*': '' };
  var n = String(name || '').toLowerCase().replace(/[01!|34@5$7+89*]/g, function (c) { return leet[c]; });
  var col = function (s) { return s.replace(/(.)\1+/g, '$1'); };
  var joined = n.replace(/[^a-z]/g, ''), joinedC = col(joined);
  var words = n.replace(/[^a-z]+/g, ' ').trim().split(' ');
  for (var i = 0; i < BAD_ANY.length; i++) {
    var b = BAD_ANY[i];
    if (joined.indexOf(b) >= 0 || (col(b) === b && joinedC.indexOf(b) >= 0)) return true;
  }
  var tokens = words.concat([joined]);
  for (var j = 0; j < BAD_WORD.length; j++) {
    var w = BAD_WORD[j], wc = col(w);
    for (var k = 0; k < tokens.length; k++) {
      var t = tokens[k];
      if (t === w || (t.length >= w.length && col(t) === wc)) return true;
    }
  }
  return false;
}

function sheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function key_(name) { return String(name).trim().toLowerCase(); }

function clean_(name) {
  var n = String(name || '').replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return n.replace(/^[=+\-@]+/, ''); // no spreadsheet formulas
}

function weekStart_(now) {
  var d = new Date(now);
  var day = (d.getUTCDay() + 6) % 7;
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - day);
  return d.getTime();
}

function rows_(sh) {
  var last = sh.getLastRow();
  return last > 1 ? sh.getRange(2, 1, last - 1, 6).getValues() : [];
}

function board_(rows, week) {
  var ws = weekStart_(Date.now()), list = [];
  rows.forEach(function (r) {
    var name = String(r[1]);
    var ms = week ? (Number(r[5]) === ws ? Number(r[4]) : 0) : Number(r[2]);
    if (!name || badName(name) || !(ms >= MIN_MS && ms <= MAX_MS)) return;
    list.push({ name: name, ms: ms });
  });
  return list.sort(function (a, b) { return a.ms - b.ms; });
}

function payload_(name, rows) {
  rows = rows || rows_(sheet_());
  var week = board_(rows, true), all = board_(rows, false);
  var k = name ? key_(name) : null;
  function rank(list) {
    if (!k) return null;
    for (var i = 0; i < list.length; i++) if (key_(list[i].name) === k) return i + 1;
    return null;
  }
  return {
    ok: true,
    week: week.slice(0, TOP_N), all: all.slice(0, TOP_N),
    weekRank: rank(week), allRank: rank(all),
    weekTotal: week.length, allTotal: all.length,
    weekStart: weekStart_(Date.now())
  };
}

function doGet(e) {
  return json_(payload_(clean_(e && e.parameter && e.parameter.name)));
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  var name = clean_(d.name), ms = Math.round(Number(d.ms));
  if (name.length < 2 || badName(name)) return json_({ ok: false, error: 'name' });
  if (!(ms >= MIN_MS && ms <= MAX_MS)) return json_({ ok: false, error: 'time' });

  var cache = CacheService.getScriptCache(), ck = 'rl_' + key_(name).slice(0, 200);
  if (cache.get(ck)) { var p = payload_(name); p.ok = false; p.error = 'rate'; return json_(p); }
  cache.put(ck, '1', 3);

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  var rows;
  try {
    var sh = sheet_(), k = key_(name), ws = weekStart_(Date.now());
    rows = rows_(sh);
    var i = -1;
    for (var j = 0; j < rows.length; j++) if (String(rows[j][3] || key_(rows[j][1])) === k) { i = j; break; }
    if (i < 0) {
      var row = [new Date(), name, ms, k, ms, ws];
      sh.appendRow(row);
      rows.push(row);
    } else {
      var r = rows[i];
      var best = Number(r[2]) >= MIN_MS ? Math.min(Number(r[2]), ms) : ms;
      var weekMs = Number(r[5]) === ws && Number(r[4]) >= MIN_MS ? Math.min(Number(r[4]), ms) : ms;
      if (best !== Number(r[2]) || weekMs !== Number(r[4]) || Number(r[5]) !== ws) {
        var upd = [new Date(), name, best, k, weekMs, ws];
        sh.getRange(i + 2, 1, 1, 6).setValues([upd]);
        rows[i] = upd;
      }
    }
  } finally { lock.releaseLock(); }
  return json_(payload_(name, rows));
}

// Run once from the editor to create the Results sheet and grant access.
function setup() { sheet_(); }

// Run once from the editor: turns the old one-row-per-attempt sheet
// (time, name, ms, key) into one row per player with the best times.
function compact() {
  var sh = sheet_(), last = sh.getLastRow(), ws = weekStart_(Date.now());
  var rows = last > 1 ? sh.getRange(2, 1, last - 1, 4).getValues() : [];
  var by = {}, order = [];
  rows.forEach(function (r) {
    var name = String(r[1]), ms = Number(r[2]), k = String(r[3] || key_(name)), t = new Date(r[0]);
    if (!name || !(ms >= MIN_MS && ms <= MAX_MS)) return;
    if (!by[k]) { by[k] = { name: name, best: ms, updated: t, week: 0 }; order.push(k); }
    var p = by[k];
    if (ms < p.best) { p.best = ms; p.updated = t; }
    if (t.getTime() >= ws && (!p.week || ms < p.week)) p.week = ms;
  });
  var out = order.map(function (k) {
    var p = by[k];
    return [p.updated, p.name, p.best, k, p.week || '', p.week ? ws : ''];
  });
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(6, sh.getLastColumn())).clearContent();
  sh.getRange(1, 1, 1, 6).setValues([HEADER]);
  if (out.length) sh.getRange(2, 1, out.length, 6).setValues(out);
  if (last - 1 > out.length) sh.deleteRows(out.length + 2, last - 1 - out.length);
}
