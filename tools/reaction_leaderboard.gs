/**
 * Reaction test leaderboard — Google Apps Script web app bound to a Google Sheet.
 * Deploy: Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone.
 * The web app URL goes into config.js as `reactionApi`.
 *
 * GET  ?name=Alex&pid=abc    → { week:[...], all:[...], weekRank, allRank, weekTotal, allTotal, taken }
 * POST {"name":"Alex","ms":213,"pid":"abc"} (Content-Type: text/plain) → same payload after saving
 *
 * A name belongs to the first player id (pid, random per browser) that posted it;
 * other players get error 'taken' and must pick another name.
 *
 * To moderate: open the sheet and delete rows (bad names, impossible times).
 */
var SHEET_NAME = 'Results';
var MIN_MS = 100;
var MAX_MS = 1500;
var TOP_N = 20;

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
    sh.appendRow(['time', 'name', 'ms', 'key', 'pid']);
    sh.setFrozenRows(1);
  }
  if (sh.getRange(1, 5).getValue() !== 'pid') sh.getRange(1, 5).setValue('pid');
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function key_(name) { return String(name).trim().toLowerCase(); }

function pid_(pid) {
  var p = String(pid || '').toLowerCase();
  return /^[a-z0-9]{8,40}$/.test(p) ? p : '';
}

function rows_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  return last > 1 ? sh.getRange(2, 1, last - 1, 5).getValues() : [];
}

// pid of whoever first posted this name ('' if nobody / legacy rows without pid)
function owner_(rows, k) {
  for (var i = 0; i < rows.length; i++) {
    var rk = String(rows[i][3] || key_(rows[i][1]));
    if (rk === k && rows[i][4]) return String(rows[i][4]);
  }
  return '';
}

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

function board_(rows, since) {
  var best = {};
  rows.forEach(function (r) {
    var t = new Date(r[0]).getTime(), name = String(r[1]), ms = Number(r[2]), k = String(r[3] || key_(name));
    if (!(t >= since) || !(ms >= MIN_MS && ms <= MAX_MS) || !name || badName(name)) return;
    if (!best[k] || ms < best[k].ms) best[k] = { name: name, ms: ms };
  });
  return Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return a.ms - b.ms; });
}

function payload_(name, pid, rows) {
  rows = rows || rows_();
  var ws = weekStart_(Date.now());
  var week = board_(rows, ws), all = board_(rows, 0);
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
    weekStart: ws,
    taken: !!(k && pid && owner_(rows, k) && owner_(rows, k) !== pid)
  };
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  return json_(payload_(clean_(p.name), pid_(p.pid)));
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  var name = clean_(d.name), ms = Math.round(Number(d.ms)), pid = pid_(d.pid);
  if (name.length < 2 || badName(name)) return json_({ ok: false, error: 'name' });
  if (!pid) return json_({ ok: false, error: 'pid' });
  if (!(ms >= MIN_MS && ms <= MAX_MS)) return json_({ ok: false, error: 'time' });

  var cache = CacheService.getScriptCache(), ck = 'rl_' + key_(name).slice(0, 200);
  if (cache.get(ck)) { var p = payload_(name, pid); p.ok = false; p.error = 'rate'; return json_(p); }
  cache.put(ck, '1', 3);

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var owner = owner_(rows_(), key_(name));
    if (owner && owner !== pid) { var t = payload_(name, pid); t.ok = false; t.error = 'taken'; return json_(t); }
    sheet_().appendRow([new Date(), name, ms, key_(name), pid]);
  } finally { lock.releaseLock(); }
  return json_(payload_(name, pid));
}

// Run once from the editor to create the Results sheet and grant access.
function setup() { sheet_(); }
