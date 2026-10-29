/** @OnlyCurrentDoc */
/**
 * PitCRM — private sales CRM backend. Google Apps Script web app bound to a
 * private Google Sheet ("PitCRM"). The page is goliunov.github.io/crm/.
 *
 * Setup: paste this file into Extensions → Apps Script of the sheet, run
 * setup() once (creates the tabs, the access key in Settings!B2 and the
 * default message templates), then Deploy → New deployment → Web app,
 * Execute as: Me, Who has access: Anyone. The page asks for the key once
 * per device; without it the API answers nothing.
 *
 * Every call is a POST (Content-Type: text/plain, no CORS preflight):
 *   {key, action:'load'}                              → {contacts, touches, templates}
 *   {key, action:'save', contact:{id?, ...fields}}    → {contact}
 *   {key, action:'log', contact:{id, ...}, touch:{}}  → {contact}
 *   {key, action:'import', contacts:[...]}            → {added, skipped}
 */

var CONTACT_COLS = ['id', 'first', 'last', 'series', 'class', 'team', 'car', 'nationality',
  'instagram', 'whatsapp', 'email', 'linkedin', 'segment', 'source', 'warm', 'stage',
  'last_touch', 'next_step', 'fu', 'template', 'pain', 'notes', 'created', 'updated'];
var TOUCH_COLS = ['at', 'contact_id', 'name', 'kind', 'template', 'channel', 'stage_from', 'stage_to', 'note'];
var TEMPLATE_COLS = ['key', 'title', 'subject', 'text'];

function sheet_(name, cols) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@'); // plain text: dates and +phone numbers stay as typed
  }
  return sh;
}

function rows_(name, cols) {
  var sh = sheet_(name, cols), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, cols.length).getDisplayValues().map(function (r) {
    var o = {};
    cols.forEach(function (c, i) { o[c] = r[i]; });
    return o;
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function today_() { return Utilities.formatDate(new Date(), 'Asia/Tbilisi', 'yyyy-MM-dd'); }
function now_() { return Utilities.formatDate(new Date(), 'Asia/Tbilisi', 'yyyy-MM-dd HH:mm'); }

// keep cell text plain: no formulas, no control characters
function cell_(v) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 5000);
  return s.charAt(0) === '=' ? "'" + s : s;
}

function nextId_(sh) {
  var last = sh.getLastRow(), max = 0;
  if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) {
    var n = Number(String(r[0]).replace(/\D/g, ''));
    if (n > max) max = n;
  });
  return max;
}

function igKey_(s) {
  var m = String(s || '').toLowerCase().match(/(?:instagram\.com\/|@)?([a-z0-9._]{2,30})\/?$/);
  return m ? m[1] : '';
}

function upsert_(c) {
  var sh = sheet_('Contacts', CONTACT_COLS), last = sh.getLastRow(), row = -1;
  if (c.id && last > 1) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(c.id)) { row = i + 2; break; }
  }
  var cur = {};
  if (row > 0) {
    var v = sh.getRange(row, 1, 1, CONTACT_COLS.length).getDisplayValues()[0];
    CONTACT_COLS.forEach(function (k, i) { cur[k] = v[i]; });
  } else {
    cur = { id: 'c' + (nextId_(sh) + 1), stage: 'New', fu: '0', warm: '', created: today_() };
  }
  CONTACT_COLS.forEach(function (k) { if (k !== 'id' && k !== 'created' && c[k] !== undefined) cur[k] = String(c[k]); });
  cur.updated = now_();
  var out = CONTACT_COLS.map(function (k) { return cell_(cur[k]); });
  if (row > 0) sh.getRange(row, 1, 1, out.length).setValues([out]);
  else sh.appendRow(out);
  return cur;
}

function touch_(t, c) {
  var sh = sheet_('Touches', TOUCH_COLS);
  sh.appendRow(TOUCH_COLS.map(function (k) {
    if (k === 'at') return now_();
    if (k === 'contact_id') return c.id;
    if (k === 'name') return cell_((c.first + ' ' + c.last).trim());
    return cell_(t[k]);
  }));
}

function doGet() { return json_({ ok: true, app: 'PitCRM' }); }

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  if (d.action === 'lead') return lead_(d);
  var key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key || d.key !== key) { Utilities.sleep(800); return json_({ ok: false, error: 'key' }); }

  if (d.action === 'load') {
    var since = Utilities.formatDate(new Date(Date.now() - 400 * 864e5), 'Asia/Tbilisi', 'yyyy-MM-dd');
    return json_({
      ok: true, today: today_(),
      contacts: rows_('Contacts', CONTACT_COLS),
      touches: rows_('Touches', TOUCH_COLS).filter(function (t) { return t.at >= since; }),
      templates: rows_('Templates', TEMPLATE_COLS)
    });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (d.action === 'save' || d.action === 'log') {
      var c = upsert_(d.contact || {});
      if (d.action === 'log' && d.touch) touch_(d.touch, c);
      return json_({ ok: true, contact: c });
    }
    if (d.action === 'import') {
      var have = {}, added = 0, skipped = 0;
      rows_('Contacts', CONTACT_COLS).forEach(function (r) {
        if (igKey_(r.instagram)) have['ig:' + igKey_(r.instagram)] = 1;
        have['n:' + (r.first + ' ' + r.last).toLowerCase().trim() + '|' + r.series.toLowerCase()] = 1;
      });
      var sh = sheet_('Contacts', CONTACT_COLS), id = nextId_(sh), out = [];
      (d.contacts || []).forEach(function (c) {
        var ig = igKey_(c.instagram), nk = 'n:' + ((c.first || '') + ' ' + (c.last || '')).toLowerCase().trim() + '|' + String(c.series || '').toLowerCase();
        if ((ig && have['ig:' + ig]) || (!ig && have[nk])) { skipped++; return; }
        if (ig) have['ig:' + ig] = 1;
        have[nk] = 1;
        c.id = 'c' + (++id);
        c.created = c.created || today_();
        c.updated = now_();
        c.stage = c.stage || 'New';
        c.fu = c.fu || '0';
        out.push(CONTACT_COLS.map(function (k) { return cell_(c[k]); }));
        added++;
      });
      if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, CONTACT_COLS.length).setValues(out);
      return json_({ ok: true, added: added, skipped: skipped });
    }
  } finally { lock.releaseLock(); }
  return json_({ ok: false, error: 'action' });
}

// Public: the audit form on goliunov.github.io/book/ (no key). A known contact
// (same Instagram, WhatsApp or email) is updated instead of duplicated.
function lead_(d) {
  var f = d.lead || {};
  if (f.website) return json_({ ok: true }); // honeypot field, bots fill it
  function v(k, n) { return String(f[k] || '').replace(/\s+/g, ' ').trim().slice(0, n || 120); }
  var first = v('first', 60), email = v('email', 120), wa = v('whatsapp', 40);
  if (!first || (!email && !wa)) return json_({ ok: false, error: 'fields' });
  if (!/^1$|^true$/.test(String(f.consent))) return json_({ ok: false, error: 'consent' });
  var cache = CacheService.getScriptCache(), ck = 'lead_' + (email || wa).toLowerCase().slice(0, 200);
  if (cache.get(ck)) return json_({ ok: true, repeat: true });
  cache.put(ck, '1', 60);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ig = igKey_(v('instagram', 80)), digits = wa.replace(/\D/g, ''), found = null;
    rows_('Contacts', CONTACT_COLS).forEach(function (r) {
      if (found) return;
      if ((ig && igKey_(r.instagram) === ig) || (digits.length > 6 && r.whatsapp.replace(/\D/g, '') === digits) ||
          (email && r.email.toLowerCase() === email.toLowerCase())) found = r;
    });
    var note = 'Заявка на аудит ' + today_() + (v('videos', 600) ? ' · видео: ' + v('videos', 600) : '');
    var c = {
      first: first, last: v('last', 60), email: email, whatsapp: wa, instagram: v('instagram', 80),
      series: v('series', 60), team: v('team', 80), segment: v('segment', 20), pain: v('pain', 500),
      stage: 'Audit booked', next_step: today_(), warm: '1'
    };
    if (found) {
      c.id = found.id;
      c.notes = (found.notes ? found.notes + '; ' : '') + note;
      Object.keys(c).forEach(function (k) { if (c[k] === '' && found[k]) delete c[k]; });
    } else {
      c.source = 'website';
      c.notes = note;
    }
    var saved = upsert_(c);
    touch_({ kind: 'stage', template: '', channel: 'website', stage_from: found ? found.stage : '', stage_to: 'Audit booked', note: 'заявка с сайта' }, saved);
  } finally { lock.releaseLock(); }
  return json_({ ok: true });
}

// Run once from the editor.
function setup() {
  sheet_('Contacts', CONTACT_COLS);
  sheet_('Touches', TOUCH_COLS);
  var st = sheet_('Settings', ['setting', 'value']);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('KEY')) props.setProperty('KEY', Utilities.getUuid().replace(/-/g, ''));
  st.getRange(2, 1, 1, 2).setValues([['access key (enter once on goliunov.github.io/crm/)', props.getProperty('KEY')]]);
  st.autoResizeColumns(1, 2);
  var tp = sheet_('Templates', TEMPLATE_COLS);
  if (tp.getLastRow() < 2) {
    var T = DEFAULT_TEMPLATES;
    tp.getRange(2, 1, T.length, TEMPLATE_COLS.length).setValues(T);
    tp.setColumnWidth(4, 600);
    tp.getRange(2, 4, T.length, 1).setWrap(true);
  }
  var ss = SpreadsheetApp.getActive();
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Лист1');
  if (def && def.getLastRow() === 0) ss.deleteSheet(def);
}

// {first} {series} {team} are filled by the CRM page; [square brackets] are for you to fill by hand.
var DEFAULT_TEMPLATES = [
  ['A', 'First DM · reaction test', '',
    "Hey {first}, saw your race at [track] — that last stint looked brutal. I'm a physical coach working with drivers on neck and endurance for long stints. Built a quick race-start reaction test, a few GT and LMP3 guys are already on the board: https://goliunov.github.io/reaction/ Curious where you'd land."],
  ['B', 'First DM · value', '',
    "Hey {first}, quick one — how's your neck holding up by the end of a race? I work with GT and LMP3 drivers on exactly that. Not pitching anything: I've got a 10-min hotel routine I give my drivers for race week. Want me to send it over?"],
  ['C', 'LinkedIn · connect', '',
    "Hi {first}, I coach racing drivers on physical prep for long stints — neck, core, endurance. Been following {team}'s {series} season. Would be good to connect."],
  ['D', 'Email · team manager', 'Physical prep for your drivers next season',
    "Hi {first},\n\nI'm Aleksander, a physical performance coach for racing drivers. I work online with drivers in {series} on neck strength, core and endurance for long stints, plus travel-week routines so they don't lose shape between rounds.\n\nEvery driver gets a monthly re-test report, so you can see the progress in numbers, not just hear about it.\n\nWould it make sense to have a 15-min call before [season/next round]? Happy to work around your schedule.\n\nCheers, Aleksander"],
  ['F1', 'Follow-up · day 3', '',
    "Hey {first}, no worries if you're busy. Here's that 30-sec drill I mentioned — works great before qualifying: [video]"],
  ['F2', 'Follow-up · day 7', '',
    "Quick update: one of my drivers improved [metric] in 4 weeks, mostly from fixing [thing]. Thought of you because of [their series/track]."],
  ['F3', 'Follow-up · day 14', '',
    "Hey {first}, I'll stop bugging you after this one. If physical prep for next season is on your radar, just reply \"yes\" and I'll send a few slots. If not, all good — good luck at [next race]!"],
  ['N', 'Reactivation · new season', '',
    "Hey {first}, new season coming up — how's the body feeling going into it? I'm taking on a few drivers for off-season prep (neck, core, endurance for long stints) so they're at 100% for round 1. Happy to send you a free 10-min race-week routine either way."],
  ['R', 'Reply → audit', '',
    "Makes sense — that's super common with [problem]. Here's what I do: you send me 3 short videos (I'll tell you which), then we jump on a short video call and I tell you exactly what's limiting you and how I'd fix it. Free, no strings. Want a slot this week? https://goliunov.github.io/book/"],
  ['T', 'Testimonial + referral', '',
    "Hey {first}, stoked about [result]! Two quick asks: could you record a 30-sec video on what changed for you? And is there a driver in your paddock who'd benefit from this? An intro would mean a lot."]
];
