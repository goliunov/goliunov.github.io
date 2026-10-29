/* PitCRM — private sales CRM. Data lives in a private Google Sheet behind an
   Apps Script API (tools/crm_api.gs); this page keeps a local copy so it opens
   instantly and queues every change until the sheet confirms it. */
(function () {
  "use strict";

  var API = "https://script.google.com/macros/s/AKfycbyZI0IWD9-nbiMME6PE5mJDlkyCOETISCDTr_UNhLzBrl_Ns447TVqONhO74XRdWdZR/exec";
  var SHEET_URL = "https://docs.google.com/spreadsheets/d/1UPmnJMvorIAXLWhDMhOkSOTzM4SL57Nf30AoneKyXT0/edit";
  var DAILY_FIRST = 30;          // new first messages per day
  var PRICE = 1500;              // $ per client per month
  // a first message = any message to someone who wasn't in a conversation yet
  function isFirst(t) { return t.kind === "sent" && (t.stage_from === "New" || t.stage_from === "Nurture" || t.stage_from === "Lost"); }
  var STAGES = ["New", "Contacted", "Replied", "Audit booked", "Call done", "Won", "Nurture", "Lost"];
  var STAGE_RU = { "New": "Новый", "Contacted": "Написал", "Replied": "Ответил", "Audit booked": "Аудит записан",
    "Call done": "Созвон прошёл", "Won": "Клиент", "Nurture": "Позже", "Lost": "Отказ" };
  var CLASS_RANK = { "LMP3": 1, "GT4": 1, "LMGT3": 2, "GT3": 2, "GTD": 2, "GTD Pro": 2, "LMP2": 3, "": 4, "Cup": 5, "GTP": 6, "Hypercar": 7 };

  var S = { contacts: [], touches: [], templates: [], today: "" };
  var drafts = {}, picked = {}, doneToday = {};
  var queue = [];
  var key = load("crm_key");
  var tab = load("crm_tab") || "today";
  var stageFilter = "";

  function $(id) { return document.getElementById(id); }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ---------- dates (Tbilisi) ----------
  function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date()); }
  function addDays(d, n) {
    var t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n);
    return t.toISOString().slice(0, 10);
  }
  function weekStart(d) {
    var t = new Date(d + "T12:00:00Z"), day = (t.getUTCDay() + 6) % 7;
    return addDays(d, -day);
  }
  function fmtDate(d) {
    if (!d) return "";
    var p = d.split("-"); return p[2] + "." + p[1];
  }

  // ---------- contact helpers ----------
  function fullName(c) { return ((c.first || "") + " " + (c.last || "")).trim() || handle(c) || c.id; }
  function handle(c) {
    var m = String(c.instagram || "").trim().match(/(?:instagram\.com\/|^@?)([A-Za-z0-9._]{2,30})\/?(?:\?.*)?$/);
    return m ? m[1] : "";
  }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function byId(id) { for (var i = 0; i < S.contacts.length; i++) if (S.contacts[i].id === id) return S.contacts[i]; return null; }
  function tplByKey(k) { for (var i = 0; i < S.templates.length; i++) if (S.templates[i].key === k) return S.templates[i]; return null; }

  function defaultTpl(c) {
    var fu = Number(c.fu) || 0;
    if (c.stage === "Replied") return "R";
    if (c.stage === "Contacted") return ["F1", "F2", "F3"][Math.min(fu, 2)];
    if (c.stage === "Nurture") return "N";
    if (c.stage === "Won" || (c.stage === "New" && c.source === "past_client")) return "T";
    if (!handle(c) && !digits(c.whatsapp) && c.linkedin) return "C";
    if (!handle(c) && !digits(c.whatsapp) && c.email) return "D";
    return Number(digits(c.id)) % 2 ? "B" : "A"; // half get A, half B: the stats show which one gets answers
  }
  function fill(text, c) {
    var first = c.first || handle(c) || "there";
    return String(text || "")
      .replace(/\{first\}/g, first)
      .replace(/\{series\}/g, c.series || "[series]")
      .replace(/\{team\}/g, c.team || "[team]");
  }
  function draftFor(c) {
    if (drafts[c.id] != null) return drafts[c.id];
    var t = tplByKey(picked[c.id] || defaultTpl(c));
    return t ? fill(t.text, c) : "";
  }
  function priority(c) {
    var p = c.warm ? 0 : 10;
    p += CLASS_RANK[c.class] != null ? CLASS_RANK[c.class] : 4;
    if (c.source === "ig_following") p += 2;
    if (!handle(c) && !digits(c.whatsapp) && !c.linkedin && !c.email) p += 3;
    return p;
  }

  // ---------- server ----------
  function call(body, timeout) {
    body.key = key;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout || 45000);
    return fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .finally(function () { clearTimeout(timer); });
  }

  function setSync() {
    var el = $("sync");
    if (!navigator.onLine) { el.textContent = "нет сети · в очереди " + queue.length; el.className = "sync bad"; return; }
    if (queue.length) { el.textContent = "сохраняю " + queue.length + "… не закрывайте"; el.className = "sync warn"; return; }
    el.textContent = "сохранено ✓"; el.className = "sync";
  }

  function persist() {
    save("crm_q", JSON.stringify(queue));
    save("crm_cache", JSON.stringify(S));
  }

  var flushing = false, retry = 0;
  // everything waiting goes in one request: the sheet answers slowly, one wait beats ten
  function flush() {
    setSync();
    if (flushing || !queue.length || !navigator.onLine) return;
    flushing = true;
    var batch = queue.slice(0, 50);
    var ops = batch.map(function (op) { return { action: op.action, contact: op.contact, touch: op.touch, tmp: op.tmp }; });
    call(JSON.parse(JSON.stringify({ action: "batch", ops: ops })), 90000).then(function (d) {
      flushing = false;
      if (d && d.error === "key") return logout();
      if (!d || !d.ok || !d.contacts) throw new Error(d && d.error);
      queue.splice(0, batch.length); retry = 0;
      batch.forEach(function (op, i) {
        var saved = d.contacts[i]; if (!saved) return;
        var c = byId(op.tmp || saved.id);
        if (c) { var from = c.id; Object.assign(c, saved); retarget(from, c.id); }
      });
      persist(); flush();
    }).catch(function () {
      flushing = false; retry++;
      setSync();
      setTimeout(flush, Math.min(60000, 3000 * retry));
    });
  }
  // a contact added offline gets its real id from the sheet; later queued ops follow it
  function retarget(from, to) {
    if (from === to) return;
    queue.forEach(function (op) { if (op.contact && op.contact.id === from) op.contact.id = to; });
    S.touches.forEach(function (t) { if (t.contact_id === from) t.contact_id = to; });
  }
  function push(op) { queue.push(op); persist(); flush(); }

  function refresh(first) {
    return call({ action: "load" }, 60000).then(function (d) {
      if (d && d.error === "key") { if (first) $("login-err").textContent = "Неверный ключ"; return logout(); }
      if (!d || !d.ok) throw new Error("load");
      // changes still in the queue are newer than what the sheet sent
      var pending = {};
      queue.forEach(function (op) { if (op.contact && op.contact.id) pending[op.contact.id] = Object.assign(pending[op.contact.id] || {}, op.contact); });
      d.contacts.forEach(function (c) { if (pending[c.id]) Object.assign(c, pending[c.id]); });
      queue.forEach(function (op) {
        if (op.tmp) d.contacts.push(Object.assign({}, op.contact, { id: op.tmp }));
        if (op.touch) d.touches.push(op.touchCopy);
      });
      S = { contacts: d.contacts, touches: d.touches.filter(Boolean), templates: d.templates, today: d.today };
      persist(); showApp(); render();
    });
  }

  // ---------- actions ----------
  function update(c, fields, touch) {
    var from = c.stage;
    Object.assign(c, fields);
    var op = { action: touch ? "log" : "save", contact: Object.assign({ id: c.id }, fields) };
    if (touch) {
      touch.stage_from = from; touch.stage_to = c.stage;
      var hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      var copy = Object.assign({ at: today() + " " + hm, contact_id: c.id, name: fullName(c) }, touch);
      S.touches.push(copy);
      op.touch = touch; op.touchCopy = copy;
    }
    push(op);
  }

  function markSent(c) {
    var t = today(), k = picked[c.id] || defaultTpl(c), fu = Number(c.fu) || 0, f = { last_touch: t, template: k };
    if (c.stage === "New" || c.stage === "Nurture" || c.stage === "Lost") { f.stage = "Contacted"; f.fu = "0"; f.next_step = addDays(t, 3); }
    else if (c.stage === "Contacted") {
      fu += 1; f.fu = String(fu);
      if (fu >= 3) { f.stage = "Nurture"; f.next_step = addDays(t, 75); }
      else f.next_step = addDays(t, fu === 1 ? 4 : 7);
    } else f.next_step = addDays(t, 2);
    if (c._intent) k = c._intent.key;
    f.template = k;
    update(c, f, { kind: "sent", template: k, channel: c._ch || "", note: c._in ? "он: " + c._in.slice(0, 1500) : "" });
    delete c._in; delete c._intent;
    doneToday[c.id] = "sent"; delete drafts[c.id]; delete picked[c.id];
    toast(f.stage === "Nurture" ? "Три фоллоу-апа без ответа → «Позже», вернётся через 75 дней" : "Отмечено. Следующий шаг " + fmtDate(f.next_step));
    render();
  }
  function markReplied(c) {
    update(c, { stage: "Replied", next_step: today(), last_touch: today() }, { kind: "replied", template: c.template || "" });
    delete doneToday[c.id]; delete drafts[c.id]; delete picked[c.id];
    toast("Ответил → в блоке «Ответить», шаблон R");
    render();
  }
  function markSkip(c) {
    update(c, { next_step: addDays(today(), 1) });
    doneToday[c.id] = "skip"; render();
  }
  function markNo(c) {
    update(c, { stage: "Lost", next_step: "" }, { kind: "stage", template: "", note: "не писать" });
    doneToday[c.id] = "no"; render();
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    fallbackCopy(text); return Promise.resolve();
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove();
  }

  function channelButtons(c) {
    var b = [], h = handle(c), wa = digits(c.whatsapp);
    if (wa) b.push('<a class="btn wa" data-ch="wa" href="#">WhatsApp</a>');
    if (h) b.push('<a class="btn" data-ch="ig" href="#">Instagram</a>');
    if (c.linkedin) b.push('<a class="btn" data-ch="li" href="#">LinkedIn</a>');
    if (c.email) b.push('<a class="btn" data-ch="em" href="#">Email</a>');
    if (!b.length) b.push('<a class="btn" data-ch="find" href="#">Найти Instagram</a>');
    b.push('<button class="btn ghost" data-ch="copy">Копировать</button>');
    return b.join("");
  }

  function openChannel(c, ch, text) {
    var h = handle(c), url = "";
    c._ch = ch;
    if (ch === "wa") url = "https://wa.me/" + digits(c.whatsapp) + "?text=" + encodeURIComponent(text);
    else if (ch === "ig") { copy(text); url = "https://ig.me/m/" + h; toast("Текст скопирован — вставьте в чат Instagram"); }
    else if (ch === "li") { copy(text); url = c.linkedin; toast("Текст скопирован — вставьте в LinkedIn"); }
    else if (ch === "em") {
      var t = tplByKey(picked[c.id] || defaultTpl(c));
      url = "mailto:" + c.email + "?subject=" + encodeURIComponent((t && t.subject) || "Physical prep for long stints") + "&body=" + encodeURIComponent(text);
    }
    else if (ch === "find") url = "https://www.google.com/search?q=" + encodeURIComponent(fullName(c) + " " + (c.series || "racing driver") + " instagram");
    else if (ch === "copy") { copy(text); toast("Скопировано"); return; }
    if (url) window.open(url, "_blank", "noopener");
  }

  // ---------- today ----------
  function cardHtml(c, kind) {
    var d = doneToday[c.id], k = picked[c.id] || defaultTpl(c);
    var tags = (c.series ? '<span class="tag">' + esc(c.series) + (c.class ? " " + esc(c.class) : "") + "</span>" : "") +
      (c.warm ? '<span class="tag y">тёплый</span>' : "") +
      (kind === "fu" ? '<span class="tag">фоллоу-ап ' + ((Number(c.fu) || 0) + 1) + "/3</span>" : "") +
      (c.source === "ig_following" ? '<span class="tag">подписка IG</span>' : "");
    var meta = [c.team, c.nationality, c.last_touch ? "касание " + fmtDate(c.last_touch) : "", c.pain ? "боль: " + c.pain : ""].filter(Boolean).map(esc).join(" · ");
    var picks = ["A", "B", "C", "D", "N", "F1", "F2", "F3", "R", "T"].filter(tplByKey).map(function (t) {
      return '<button data-tpl="' + t + '" class="' + (t === k ? "on" : "") + '">' + t + "</button>";
    }).join("");
    if (d) {
      var label = { sent: "отправлено ✓", skip: "пропущен до завтра", no: "больше не писать", audit: "аудит записан ✓", later: "вернётся через 75 дней" }[d];
      return '<div class="card done" data-id="' + c.id + '"><div class="card-head"><span class="name">' + esc(fullName(c)) + '</span><span class="meta">' + label + "</span></div></div>";
    }
    return '<div class="card' + (c.warm ? " warm" : "") + '" data-id="' + c.id + '">' +
      '<div class="card-head"><div><span class="name" data-open="1">' + esc(fullName(c)) + "</span> " + tags + '<div class="meta">' + meta + "</div></div></div>" +
      '<div class="todo">' + esc(PitAssist.todo(c, kind, k)) + "</div>" +
      (kind === "reply" ? assistHtml(c) : "") +
      '<div class="tpl-pick">' + picks + "</div>" +
      '<textarea data-draft="1" rows="5">' + esc(draftFor(c)) + "</textarea>" +
      '<div class="row">' + channelButtons(c) + "</div>" +
      '<div class="row acts"><button class="btn primary" data-act="sent">Отправил</button>' +
      (kind === "reply" ? '<button class="btn" data-act="audit">Записался на аудит</button>' : '<button class="btn" data-act="replied">Ответил</button>') +
      '<button class="btn ghost" data-act="skip">Завтра</button>' +
      '<button class="btn ghost danger" data-act="no">Не писать</button></div></div>';
  }

  function assistHtml(c) {
    var r = c._intent, out = "";
    if (r) {
      out = '<div class="intent"><b>' + esc(r.label) + "</b> " + esc(r.why) +
        (r.stage === "Nurture" ? '<div class="row" style="margin-top:8px"><button class="btn" data-act="later">Не согласен → «Позже» на 75 дней</button></div>' : "") +
        (r.stage === "Lost" ? '<div class="row" style="margin-top:8px"><button class="btn danger" data-act="no">Отправил → больше не писать</button></div>' : "") +
        '<div class="muted small" style="margin-top:6px">Ответ ниже уже подставлен. Допишите [скобки] и отправьте.</div></div>';
    }
    return '<div class="assist"><textarea data-in="1" rows="2" placeholder="Вставьте, что он написал">' + esc(c._in || "") + "</textarea>" +
      '<button class="btn" data-act="assist">Подсказать ответ</button>' + out + "</div>";
  }

  function runAssist(c, text) {
    c._in = text;
    var r = PitAssist.classify(text, c);
    c._intent = r;
    drafts[c.id] = fill(r.text, c);
    picked[c.id] = "";
    render();
  }

  function todayLists() {
    var t = today(), active = function (c) { return c.next_step && c.next_step <= t; };
    var firstSent = S.touches.filter(function (x) { return x.at.slice(0, 10) === t && isFirst(x); }).length;
    var keep = function (c) { return doneToday[c.id]; };
    var reply = S.contacts.filter(function (c) { return (c.stage === "Replied" && active(c)) || (keep(c) && c._list === "reply"); });
    var meet = S.contacts.filter(function (c) { return (c.stage === "Audit booked" || c.stage === "Call done") && active(c); });
    var fu = S.contacts.filter(function (c) { return (c.stage === "Contacted" && active(c)) || (keep(c) && c._list === "fu"); });
    var room = Math.max(0, DAILY_FIRST - firstSent);
    var fresh = S.contacts.filter(function (c) { return c.stage === "New" && (!c.next_step || c.next_step <= t) && !doneToday[c.id]; })
      .sort(function (a, b) { return priority(a) - priority(b) || Number(digits(a.id)) - Number(digits(b.id)); });
    var react = S.contacts.filter(function (c) { return c.stage === "Nurture" && active(c) && !doneToday[c.id]; })
      .sort(function (a, b) { return priority(a) - priority(b) || (a.next_step < b.next_step ? -1 : 1); });
    var newOnes = fresh.slice(0, room), reactOnes = react.slice(0, Math.max(0, room - newOnes.length));
    var doneFirst = S.contacts.filter(function (c) { return keep(c) && (c._list === "new" || c._list === "react"); });
    return { reply: reply, meet: meet, fu: fu, first: doneFirst.concat(newOnes, reactOnes), firstSent: firstSent, freshLeft: fresh.length, reactLeft: react.length };
  }

  function renderToday() {
    var L = todayLists(), h = "";
    L.reply.forEach(function (c) { c._list = "reply"; });
    L.fu.forEach(function (c) { c._list = "fu"; });
    L.first.forEach(function (c) { if (!c._list || !doneToday[c.id]) c._list = c.stage === "Nurture" ? "react" : "new"; });
    var sent = L.firstSent, goal = DAILY_FIRST;
    h += '<p class="muted small">Первых сообщений сегодня: <b>' + sent + " / " + goal + "</b> · новых в базе " + L.freshLeft + " · ждут реактивации " + L.reactLeft + "</p>";
    if (L.meet.length) {
      h += '<h2>Аудиты и созвоны <span class="n">' + L.meet.length + "</span></h2>";
      L.meet.forEach(function (c) {
        h += '<div class="line-item" data-open-id="' + c.id + '"><div><span class="name">' + esc(fullName(c)) + '</span><div class="meta">' + esc(STAGE_RU[c.stage]) + " · " + fmtDate(c.next_step) + "</div></div><span class=\"tag y\">открыть</span></div>";
      });
    }
    h += '<h2>Ответить <span class="n">' + L.reply.length + "</span></h2>";
    h += L.reply.length ? L.reply.map(function (c) { return cardHtml(c, "reply"); }).join("") : '<p class="empty">Никто не ждёт ответа.</p>';
    h += '<h2>Фоллоу-апы <span class="n">' + L.fu.length + "</span></h2>";
    h += L.fu.length ? L.fu.map(function (c) { return cardHtml(c, "fu"); }).join("") : '<p class="empty">Сегодня фоллоу-апов нет.</p>';
    h += '<h2>Новые и реактивация <span class="n">' + L.first.length + "</span></h2>";
    h += L.first.length ? L.first.map(function (c) { return cardHtml(c, "new"); }).join("") : '<p class="empty">Норма на сегодня выполнена 👏</p>';
    $("today").innerHTML = h;
  }

  // ---------- base ----------
  function renderBase() {
    var counts = {};
    S.contacts.forEach(function (c) { counts[c.stage] = (counts[c.stage] || 0) + 1; });
    $("stage-filter").innerHTML = '<button data-stage="" class="' + (stageFilter ? "" : "on") + '">Все ' + S.contacts.length + "</button>" +
      STAGES.map(function (s) { return '<button data-stage="' + s + '" class="' + (stageFilter === s ? "on" : "") + '">' + STAGE_RU[s] + " " + (counts[s] || 0) + "</button>"; }).join("");
    var q = $("q").value.trim().toLowerCase();
    var list = S.contacts.filter(function (c) {
      if (stageFilter && c.stage !== stageFilter) return false;
      if (!q) return true;
      return [c.first, c.last, c.team, c.series, c.class, c.instagram, c.email, c.whatsapp, c.notes, c.nationality].join(" ").toLowerCase().indexOf(q.replace(/^@/, "")) >= 0;
    });
    var shown = list.slice(0, 80);
    $("base-list").innerHTML = (shown.length ? shown.map(function (c) {
      return '<div class="line-item" data-open-id="' + c.id + '"><div><span class="name">' + esc(fullName(c)) + "</span>" + (c.warm ? '<span class="tag y">тёплый</span>' : "") +
        '<div class="meta">' + esc([c.series, c.class, c.team].filter(Boolean).join(" · ")) + "</div></div>" +
        '<div class="meta" style="text-align:right">' + esc(STAGE_RU[c.stage] || c.stage) + (c.next_step ? "<br>" + fmtDate(c.next_step) : "") + "</div></div>";
    }).join("") : '<p class="empty">Ничего не найдено.</p>') + (list.length > 80 ? '<p class="muted small">Показаны 80 из ' + list.length + ". Уточните поиск.</p>" : "");
  }

  // ---------- contact sheet ----------
  var FIELDS = [["first", "Имя"], ["last", "Фамилия"], ["series", "Серия"], ["class", "Класс"], ["team", "Команда"], ["nationality", "Страна"],
    ["whatsapp", "WhatsApp (+код страны)"], ["instagram", "Instagram"], ["email", "Email"], ["linkedin", "LinkedIn (ссылка)"]];
  function formHtml(c) {
    var seg = ["", "pro", "junior", "gentleman", "team_manager", "parent"];
    return '<div class="grid2">' + FIELDS.map(function (f) {
      return '<label>' + f[1] + '<input name="' + f[0] + '" value="' + esc(c[f[0]] || "") + '"' + (f[0] === "whatsapp" ? ' inputmode="tel"' : "") + "></label>";
    }).join("") +
      '<label>Сегмент<select name="segment">' + seg.map(function (s) { return '<option value="' + s + '"' + (c.segment === s ? " selected" : "") + ">" + ({ "": "—", pro: "Профи / полупрофи", junior: "Юниор (платят родители)", gentleman: "Gentleman driver", team_manager: "Тим-менеджер / академия", parent: "Родитель" }[s]) + "</option>"; }).join("") + "</select></label>" +
      '<label class="check" style="align-self:end"><input type="checkbox" name="warm"' + (c.warm ? " checked" : "") + "> Тёплый контакт</label></div>" +
      '<label style="margin-top:10px">Главная боль (словами клиента)<input name="pain" value="' + esc(c.pain || "") + '"></label>' +
      '<label style="margin-top:10px">Заметки<textarea name="notes" rows="3">' + esc(c.notes || "") + "</textarea></label>";
  }
  function readForm(root) {
    var f = {};
    root.querySelectorAll("input[name], select[name], textarea[name]").forEach(function (el) {
      f[el.name] = el.type === "checkbox" ? (el.checked ? "1" : "") : el.value.trim();
    });
    return f;
  }

  function openContact(id) {
    var c = byId(id); if (!c) return;
    var hist = S.touches.filter(function (t) { return t.contact_id === c.id; }).slice(-30).reverse();
    var stageOpts = STAGES.map(function (s) { return '<option value="' + s + '"' + (c.stage === s ? " selected" : "") + ">" + STAGE_RU[s] + "</option>"; }).join("");
    $("sheet-body").innerHTML =
      "<h1>" + esc(fullName(c)) + "</h1>" +
      '<div class="grid2"><label>Этап<select id="c-stage">' + stageOpts + "</select></label>" +
      '<label>Следующий шаг (дата)<input id="c-next" type="date" value="' + esc(c.next_step || "") + '"></label></div>' +
      '<div class="row" style="margin:10px 0 4px">' + channelButtons(c) + "</div>" +
      '<div id="c-form" style="margin-top:12px">' + formHtml(c) + "</div>" +
      '<div class="row" style="margin-top:14px"><button class="btn primary" id="c-save">Сохранить</button></div>' +
      "<h2>История</h2>" +
      '<div class="hist">' + (hist.length ? hist.map(function (t) {
        var what = t.kind === "sent" ? "отправил " + t.template + (t.channel ? " · " + t.channel : "") : t.kind === "replied" ? "ответил" : (STAGE_RU[t.stage_to] || t.stage_to) + (t.note ? " · " + t.note : "");
        return "<div><time>" + esc(t.at.slice(5, 16).replace("-", ".")) + "</time>" + esc(what) + "</div>";
      }).join("") : '<p class="empty">Касаний пока нет.' + (c.last_touch ? " Последнее до CRM: " + esc(c.last_touch) : "") + "</p>") + "</div>" +
      '<p class="muted small">id ' + esc(c.id) + " · создан " + esc(c.created || "—") + " · источник " + esc(c.source || "—") + "</p>";
    $("sheet").hidden = false;
    $("sheet-body").querySelectorAll("[data-ch]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); openChannel(c, b.getAttribute("data-ch"), draftFor(c)); });
    });
    $("c-stage").addEventListener("change", function () {
      var s = this.value, n = $("c-next");
      if (s === "Audit booked" && !n.value) n.focus();
      if (s === "Call done") n.value = addDays(today(), 2);
      if (s === "Nurture") n.value = addDays(today(), 75);
      if (s === "Won" || s === "Lost") n.value = "";
    });
    $("c-save").addEventListener("click", function () {
      var f = readForm($("c-form")), s = $("c-stage").value;
      f.next_step = $("c-next").value;
      if (s !== c.stage) { f.stage = s; update(c, f, { kind: "stage", template: "", note: "" }); }
      else update(c, f);
      $("sheet").hidden = true; toast("Сохранено"); render();
    });
  }

  // ---------- add ----------
  function renderAdd() {
    $("add").innerHTML = "<h1>Новый контакт</h1>" +
      '<p class="muted small">Обязательно только имя. Тёплые контакты первыми попадают в список «Сегодня».</p>' +
      '<form id="add-form">' + formHtml({ warm: "" }) +
      '<div class="row" style="margin-top:14px"><button class="btn primary" type="submit">Добавить</button></div><p class="err" id="add-err"></p></form>';
    $("add-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = readForm(this);
      if (!f.first && !f.instagram) { $("add-err").textContent = "Нужно имя или Instagram"; return; }
      var ig = handle(f).toLowerCase(), wa = digits(f.whatsapp);
      var dup = S.contacts.filter(function (c) {
        return (ig && handle(c).toLowerCase() === ig) || (wa && digits(c.whatsapp) === wa) ||
          (f.first && f.last && (c.first + " " + c.last).toLowerCase() === (f.first + " " + f.last).toLowerCase());
      })[0];
      if (dup) { $("add-err").innerHTML = 'Такой контакт уже есть: <a href="#" data-open-id="' + dup.id + '">' + esc(fullName(dup)) + "</a>"; return; }
      var tmp = "tmp" + Date.now();
      var c = Object.assign(f, { id: tmp, stage: "New", fu: "0", source: "manual", created: today() });
      S.contacts.push(c);
      var body = Object.assign({}, c); delete body.id;
      push({ action: "save", contact: body, tmp: tmp });
      toast("Добавлено: " + fullName(c));
      renderAdd();
    });
  }

  // ---------- stats ----------
  function renderStats() {
    var t = today(), ws = weekStart(t), weeks = [];
    for (var i = 0; i < 5; i++) weeks.push(addDays(ws, -7 * i));
    function wk(x) { return weekStart(x.at.slice(0, 10)); }
    function rowFor(w) {
      var r = { first: 0, fu: 0, replies: 0, audits: 0, calls: 0, won: 0 };
      S.touches.forEach(function (x) {
        if (wk(x) !== w) return;
        if (x.kind === "sent") { if (isFirst(x)) r.first++; else r.fu++; }
        if (x.kind === "replied") r.replies++;
        if (x.stage_to !== x.stage_from) {
          if (x.stage_to === "Audit booked") r.audits++;
          if (x.stage_to === "Call done") r.calls++;
          if (x.stage_to === "Won") r.won++;
        }
      });
      return r;
    }
    var cur = rowFor(ws), counts = {};
    S.contacts.forEach(function (c) { counts[c.stage] = (counts[c.stage] || 0) + 1; });
    var clients = counts.Won || 0;
    var h = "<h1>Цифры</h1>" +
      '<div class="kpis">' +
      kpi(clients, "активных клиентов", "цель 14") +
      kpi("$" + (clients * PRICE).toLocaleString("en-US"), "выручка в месяц", "цель $21 000") +
      kpi(cur.calls, "созвонов на этой неделе", "нужно 4–5") +
      kpi(cur.first, "первых сообщений", "ориентир 150 в неделю") +
      kpi(cur.replies, "ответов", "ориентир 20+") +
      kpi(cur.audits, "аудитов записано", "ориентир 5") + "</div>";
    h += '<div class="note">' + bottleneck() + "</div>";
    h += '<h2>По неделям</h2><div class="tbl-wrap"><table><tr><th>Неделя</th><th>Первые</th><th>Фоллоу</th><th>Ответы</th><th>Аудиты</th><th>Созвоны</th><th>Клиенты</th></tr>' +
      weeks.map(function (w) {
        var r = rowFor(w);
        return "<tr><td>" + fmtDate(w) + "–" + fmtDate(addDays(w, 6)) + "</td><td>" + r.first + "</td><td>" + r.fu + "</td><td>" + r.replies + "</td><td>" + r.audits + "</td><td>" + r.calls + "</td><td>" + r.won + "</td></tr>";
      }).join("") + "</table></div>";
    h += "<h2>Воронка сейчас</h2>";
    var max = Math.max.apply(null, STAGES.map(function (s) { return counts[s] || 0; }).concat(1));
    h += STAGES.map(function (s) {
      return '<div style="margin-bottom:8px"><div class="meta">' + STAGE_RU[s] + " · <b>" + (counts[s] || 0) + '</b></div><div class="funnel-bar" style="width:' + Math.max(1, Math.round(100 * (counts[s] || 0) / max)) + '%"></div></div>';
    }).join("");
    h += '<h2>Какой шаблон отвечают чаще</h2><div class="tbl-wrap"><table><tr><th>Шаблон</th><th>Отправлено</th><th>Ответов</th><th>%</th></tr>';
    var by = {};
    S.touches.forEach(function (x) {
      if (!x.template) return;
      by[x.template] = by[x.template] || { s: 0, r: 0 };
      if (x.kind === "sent") by[x.template].s++;
      if (x.kind === "replied") by[x.template].r++;
    });
    var keys = Object.keys(by).sort();
    h += keys.length ? keys.map(function (k) {
      var t = tplByKey(k);
      return "<tr><td>" + esc(k + (t ? " · " + t.title : "")) + "</td><td>" + by[k].s + "</td><td>" + by[k].r + "</td><td>" + (by[k].s ? Math.round(100 * by[k].r / by[k].s) : 0) + "%</td></tr>";
    }).join("") : '<tr><td colspan="4" class="muted">Появится после первых отправок</td></tr>';
    h += "</table></div>";
    $("stats").innerHTML = h;

    function kpi(v, label, sub) { return '<div class="kpi"><b>' + v + "</b><span>" + label + "</span><br><small>" + sub + "</small></div>"; }
    function bottleneck() {
      var p = rowFor(weeks[1]), r = { first: cur.first + p.first, replies: cur.replies + p.replies, audits: cur.audits + p.audits, calls: cur.calls + p.calls, won: cur.won + p.won };
      if (r.first + r.replies === 0) return "Начните со списка «Сегодня»: 30 первых сообщений в день. Цифры и узкое место появятся здесь через несколько дней.";
      if (r.first >= 60 && r.replies / r.first < 0.1) return "Узкое место — ответы (" + Math.round(100 * r.replies / r.first) + "% за 2 недели). Перепишите первое сообщение: больше личной детали про гонку.";
      if (r.replies >= 5 && r.audits / r.replies < 0.15) return "Отвечают, но не записываются на аудит. Усильте переход: шаблон R и конкретный слот на этой неделе.";
      if (r.calls >= 3 && r.won === 0) return "Созвоны есть, а оплат нет. Проверьте шаги 3–4 скрипта: цена проблемы и молчание после цены.";
      if (cur.calls < 4) return "Главная цифра — диагностические созвоны: на этой неделе " + cur.calls + ", нужно 4–5.";
      return "Темп в норме. Держите 30 первых сообщений в день и все фоллоу-апы.";
    }
  }

  // ---------- call script ----------
  function renderCall() {
    var soon = S.contacts.filter(function (c) { return c.stage === "Audit booked"; })
      .sort(function (a, b) { return (a.next_step || "9") < (b.next_step || "9") ? -1 : 1; }).slice(0, 5);
    var h = "<h1>Созвон</h1>" +
      '<p class="muted small">Диагностический созвон 30–45 минут. Он говорит 70% времени. Вы задаёте вопросы и слушаете, цену называете только в шаге «Оффер».</p>';
    if (soon.length) h += '<p class="small">Записаны на аудит: ' + soon.map(function (c) {
      return '<a href="#" data-open-id="' + c.id + '">' + esc(fullName(c)) + "</a>" + (c.next_step ? " " + fmtDate(c.next_step) : "");
    }).join(", ") + "</p>";
    h += PitAssist.CALL.map(function (s, i) {
      return '<div class="step"><div class="step-h"><span class="tag y">' + (i + 1) + "</span> <b>" + esc(s.t) + '</b> <span class="muted small">' + s.min + " мин</span></div>" +
        '<div class="small">' + esc(s.ru) + "</div>" + (s.en ? '<div class="en">' + esc(s.en) + "</div>" : "") + "</div>";
    }).join("");
    h += "<h2>Если сомневается</h2>" + PitAssist.OBJECTIONS.map(function (r) {
      return '<details class="obj"><summary>' + esc(r.label) + '</summary><div class="small muted">' + esc(r.why) + '</div><div class="en">' + esc(r.text.replace(/\{first\}/g, "")) + "</div></details>";
    }).join("");
    h += '<div class="note">После созвона откройте карточку гонщика: этап «Созвон прошёл» или «Клиент», впишите его боль и следующий шаг.</div>';
    $("call").innerHTML = h;
  }

  // ---------- templates ----------
  function renderTpl() {
    $("tpl").innerHTML = "<h1>Шаблоны</h1>" +
      '<p class="muted small">{first}, {series}, {team} подставляются сами. [Квадратные скобки] — ваша личная деталь, допишите перед отправкой. Редактировать тексты — в таблице, вкладка Templates' +
      (SHEET_URL.indexOf("http") === 0 ? ' (<a href="' + esc(SHEET_URL) + '" target="_blank" rel="noopener">открыть</a>)' : "") + ".</p>" +
      S.templates.map(function (t) { return '<div class="tpl-item"><b>' + esc(t.key) + "</b>" + esc(t.title) + "\n\n" + esc(t.text) + "</div>"; }).join("");
  }

  // ---------- shell ----------
  function render() {
    document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === tab); });
    document.querySelectorAll(".tab").forEach(function (s) { s.hidden = s.id !== tab; });
    if (tab === "today") renderToday();
    if (tab === "base") renderBase();
    if (tab === "add" && !$("add-form")) renderAdd();
    if (tab === "stats") renderStats();
    if (tab === "call") renderCall();
    if (tab === "tpl") renderTpl();
    setSync();
  }
  function showApp() { $("login").hidden = true; $("tabs").hidden = false; }
  function logout() {
    key = null; try { localStorage.removeItem("crm_key"); localStorage.removeItem("crm_cache"); } catch (e) {}
    $("tabs").hidden = true; document.querySelectorAll(".tab").forEach(function (s) { s.hidden = true; });
    $("login").hidden = false; $("sync").textContent = "";
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var tb = t.closest("#tabs button");
    if (tb) { tab = tb.getAttribute("data-tab"); save("crm_tab", tab); if (tab === "add") $("add").innerHTML = ""; render(); window.scrollTo(0, 0); return; }
    var oid = t.closest("[data-open-id]");
    if (oid) { e.preventDefault(); openContact(oid.getAttribute("data-open-id")); return; }
    var card = t.closest(".card[data-id]");
    if (!card) return;
    var c = byId(card.getAttribute("data-id")); if (!c) return;
    if (t.closest("[data-open]")) return openContact(c.id);
    var tp = t.closest("[data-tpl]");
    if (tp) { picked[c.id] = tp.getAttribute("data-tpl"); delete drafts[c.id]; render(); return; }
    var ch = t.closest("[data-ch]");
    if (ch) { e.preventDefault(); openChannel(c, ch.getAttribute("data-ch"), card.querySelector("[data-draft]").value); return; }
    var a = t.closest("[data-act]");
    if (a) {
      var act = a.getAttribute("data-act");
      if (act === "sent") markSent(c);
      if (act === "replied") markReplied(c);
      if (act === "skip") markSkip(c);
      if (act === "no") markNo(c);
      if (act === "assist") {
        var txt = card.querySelector("[data-in]").value.trim();
        if (!txt) { toast("Сначала вставьте его сообщение"); return; }
        runAssist(c, txt);
      }
      if (act === "later") {
        update(c, { stage: "Nurture", next_step: addDays(today(), 75), last_touch: today() }, { kind: "stage", template: "", note: c._in ? "он: " + c._in.slice(0, 1500) : "не сейчас" });
        delete c._in; delete c._intent; doneToday[c.id] = "later"; render(); toast("Вернётся в список через 75 дней");
      }
      if (act === "audit") {
        update(c, { stage: "Audit booked", next_step: addDays(today(), 2) }, { kind: "stage", template: "", note: "" });
        doneToday[c.id] = "audit"; render(); openContact(c.id); toast("Поставьте дату созвона и сохраните");
      }
    }
  });
  document.addEventListener("input", function (e) {
    if (e.target.matches("[data-draft]")) { var card = e.target.closest(".card"); drafts[card.getAttribute("data-id")] = e.target.value; }
    if (e.target.matches("[data-in]")) { var cc = byId(e.target.closest(".card").getAttribute("data-id")); if (cc) cc._in = e.target.value; }
    if (e.target.id === "q") renderBase();
  });
  document.addEventListener("click", function (e) {
    var sb = e.target.closest("#stage-filter [data-stage]");
    if (sb) { stageFilter = sb.getAttribute("data-stage"); renderBase(); }
  });
  $("sheet-x").addEventListener("click", function () { $("sheet").hidden = true; });
  $("sheet").addEventListener("click", function (e) { if (e.target === this) this.hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") $("sheet").hidden = true; });
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) flush(); });
  window.addEventListener("pageshow", flush);
  // closing the tab with changes still on their way to the sheet: the browser asks first
  window.addEventListener("beforeunload", function (e) { if (queue.length) { e.preventDefault(); e.returnValue = ""; } });
  window.addEventListener("offline", setSync);

  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    key = $("login-key").value.trim();
    $("login-err").textContent = "Проверяю… (таблица иногда отвечает до 20 секунд)";
    refresh(true).then(function () {
      if (key) { save("crm_key", key); $("login-err").textContent = ""; }
    }).catch(function () { $("login-err").textContent = "Нет связи с таблицей. Попробуйте ещё раз."; });
  });

  // ---------- start ----------
  try { queue = JSON.parse(load("crm_q") || "[]"); } catch (e) { queue = []; }
  if (!key) { $("login").hidden = false; return; }
  try {
    var cached = JSON.parse(load("crm_cache") || "null");
    if (cached && cached.contacts) { S = cached; showApp(); render(); }
  } catch (e) {}
  $("sync").textContent = "обновляю…";
  refresh(false).then(flush).catch(function () {
    if (!S.contacts.length) { $("login").hidden = false; $("login-err").textContent = "Нет связи с таблицей. Обновите страницу."; }
    else { $("sync").textContent = "офлайн-копия"; $("sync").className = "sync warn"; }
  });
})();
