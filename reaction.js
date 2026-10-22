/* Reaction test: five red lights one by one, random hold, then all green.
   Leaderboard is a Google Apps Script web app (CONFIG.reactionApi). */
(function () {
  "use strict";

  var MIN_MS = 100;          // faster than this is anticipation, not reaction
  var MAX_MS = 1500;         // slower than this isn't worth posting
  var LIGHT_STEP = 1000;     // ms between red lights, like a real start
  var HOLD_MIN = 200, HOLD_MAX = 3000;
  var SITE = "https://goliunov.github.io/reaction/";

  var stage = document.getElementById("rx-stage");
  if (!stage) return;
  var lights = stage.querySelectorAll(".rx-light");
  var big = document.getElementById("rx-big");
  var small = document.getElementById("rx-small");
  var statusEl = document.getElementById("rx-status");
  var nameInput = document.getElementById("rx-name");
  var actions = document.getElementById("rx-actions");
  var boardEl = document.getElementById("rx-board");
  var boardNote = document.getElementById("rx-board-note");
  var tabWeek = document.getElementById("rx-tab-week");
  var tabAll = document.getElementById("rx-tab-all");
  var challengeEl = document.getElementById("rx-challenge");
  var offer = document.getElementById("rx-offer");
  function showOffer(on) { if (offer) offer.hidden = !on; }

  var api = (typeof CONFIG !== "undefined" && CONFIG.reactionApi && !/^\[.*\]$/.test(CONFIG.reactionApi)) ? CONFIG.reactionApi : null;

  var state = "idle", timers = [], t0 = 0, lastMs = null, lastRank = null;
  var board = null, period = "week";

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

  // ---------- storage (per-viewer conveniences only) ----------
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function weekStart(now) {
    var d = new Date(now);
    var day = (d.getUTCDay() + 6) % 7;
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - day);
    return d.getTime();
  }
  function cleanName(n) { return String(n || "").replace(/[<>\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 20); }
  function fmt(ms) { return (ms / 1000).toFixed(3) + " s"; }
  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  // ---------- step 1: name (required before the lights) ----------
  var nameForm = document.getElementById("rx-name-form");
  var nameError = document.getElementById("rx-name-error");
  var driverLine = document.getElementById("rx-driver");
  var driverName = document.getElementById("rx-driver-name");
  var playerName = "";

  function nameProblem(n) {
    if (n.length < 2) return "Enter at least 2 characters.";
    if (badName(n)) return "That name isn't allowed on the leaderboard. Please choose another one.";
    return "";
  }
  function setPlayer(n) {
    playerName = n;
    save("rx_name", n);
    driverName.textContent = n;
    nameForm.hidden = true;
    driverLine.hidden = false;
    clearTimers();
    setLights(0);
    setState("idle", "Tap to start", "Wait for green. Don't anticipate.");
    statusEl.textContent = "";
    actions.hidden = true;
    fetchBoard();
  }
  function askName(focus) {
    playerName = "";
    clearTimers();
    setLights(0);
    setState("locked", "Enter your name", "Then the lights are yours");
    nameForm.hidden = false;
    driverLine.hidden = true;
    actions.hidden = true;
    showOffer(false);
    if (focus === true) nameInput.focus();
  }
  nameForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var n = cleanName(nameInput.value);
    nameInput.value = n;
    var problem = nameProblem(n);
    nameError.textContent = problem;
    if (problem) { nameInput.focus(); return; }
    setPlayer(n);
    // close the phone keyboard and bring the lights back into view
    nameInput.blur();
    setTimeout(function () {
      var r = stage.getBoundingClientRect();
      var top = window.pageYOffset + r.top - Math.max(0, (window.innerHeight - r.height) / 2);
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }, 350);
  });
  nameInput.addEventListener("input", function () { nameError.textContent = ""; });
  document.getElementById("rx-change-name").addEventListener("click", function () { askName(true); });

  // personal bests are kept per name, so a new name starts fresh
  function bestKey(k) { return "rx_" + k + "_" + playerName.toLowerCase(); }

  // ---------- challenge link: ?beat=213&from=Alex ----------
  var params = new URLSearchParams(location.search);
  var beat = parseInt(params.get("beat"), 10);
  var from = cleanName(params.get("from"));
  if (!(beat >= MIN_MS && beat <= MAX_MS)) beat = null;
  if (beat && challengeEl) {
    challengeEl.innerHTML = "<b>" + esc(from || "A friend") + "</b> started in <b>" + fmt(beat) + "</b>. Can you beat it?";
    challengeEl.hidden = false;
  }

  // ---------- game ----------
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function setLights(n, cls) {
    for (var i = 0; i < lights.length; i++) {
      lights[i].className = "rx-light" + (i < n ? " " + cls : "");
    }
  }
  function setState(s, bigText, smallText) {
    state = s;
    stage.setAttribute("data-state", s);
    big.textContent = bigText;
    small.textContent = smallText || "";
  }

  function start() {
    clearTimers();
    actions.hidden = true;
    showOffer(false);
    statusEl.textContent = "";
    setLights(0);
    setState("countdown", "Wait…", "Don't move until green");
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        timers.push(setTimeout(function () { setLights(n, "red"); }, n * LIGHT_STEP));
      })(i);
    }
    var hold = HOLD_MIN + Math.random() * (HOLD_MAX - HOLD_MIN);
    timers.push(setTimeout(go, 5 * LIGHT_STEP + hold));
  }

  function go() {
    setLights(5, "green");
    setState("go", "GO!", "");
    var tSet = performance.now();
    t0 = tSet;
    // refine: count from the frame after green was actually painted (skip if frames are throttled)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var now = performance.now();
        if (state === "go" && now - tSet < 100) t0 = now;
      });
    });
  }

  function jumpStart() {
    clearTimers();
    setLights(5, "red");
    setState("jump", "Jump start", "Tap to try again");
    statusEl.textContent = "You moved before green. In a race that's a penalty.";
  }

  function finish(ev) {
    var now = (ev && ev.timeStamp && ev.timeStamp > 1e3 && ev.timeStamp < performance.now() + 1e3) ? ev.timeStamp : performance.now();
    var ms = Math.round(now - t0);
    if (ms < MIN_MS) { jumpStart(); statusEl.textContent = "Under 0.100 s — that's anticipation, not reaction. Counts as a jump start."; return; }
    lastMs = ms;
    setState("result", fmt(ms), "Tap to go again");
    var best = parseInt(load(bestKey("best")) || "0", 10);
    var weekBest = parseInt(load(bestKey("week_best")) || "0", 10);
    var ws = weekStart(Date.now());
    if (parseInt(load(bestKey("week")) || "0", 10) !== ws) { weekBest = 0; save(bestKey("week"), String(ws)); }
    var msg = [];
    if (!best || ms < best) { save(bestKey("best"), String(ms)); msg.push("New personal best!"); }
    else msg.push("Personal best: " + fmt(best) + ".");
    if (beat) msg.push(ms < beat ? "You beat " + (from || "your friend") + " by " + fmt(beat - ms) + "." : (from || "Your friend") + " is still faster by " + fmt(ms - beat) + ".");
    statusEl.textContent = msg.join(" ");
    actions.hidden = false;
    showOffer(true);
    if (ms <= MAX_MS && (!weekBest || ms < weekBest)) {
      save(bestKey("week_best"), String(ms));
      submit(ms);
    }
  }

  function onPress(ev) {
    if (ev.target.closest && ev.target.closest("button, input, a, label")) return;
    if (ev.type === "pointerdown" && ev.button > 0) return;
    if (state === "locked") { nameError.textContent = "First enter your name, then tap the lights."; nameInput.focus({ preventScroll: true }); return; }
    if (state === "idle" || state === "result" || state === "jump") start();
    else if (state === "countdown") jumpStart();
    else if (state === "go") finish(ev);
  }

  stage.addEventListener("pointerdown", function (e) {
    if (e.target.closest && e.target.closest("form, button, input, a, label")) return; // let the name form work
    e.preventDefault();
    onPress(e);
  });
  document.addEventListener("keydown", function (e) {
    if (e.target === nameInput || (e.target.closest && e.target.closest("form, button"))) return;
    if (e.code === "Space" || e.key === " " || e.key === "Enter") {
      if (e.repeat) return;
      e.preventDefault();
      onPress(e);
    }
  });

  // ---------- leaderboard ----------
  function render() {
    if (!api) { boardEl.innerHTML = '<li class="rx-empty">Leaderboard is coming soon.</li>'; return; }
    if (!board) { boardEl.innerHTML = '<li class="rx-empty">Loading…</li>'; return; }
    var list = board[period] || [];
    var me = playerName.toLowerCase();
    if (!list.length) { boardEl.innerHTML = '<li class="rx-empty">No times yet' + (period === "week" ? " this week" : "") + ". Be the first.</li>"; return; }
    boardEl.innerHTML = list.map(function (r, i) {
      var mine = me && r.name.toLowerCase() === me;
      return '<li class="' + (mine ? "me" : "") + '"><span class="rx-pos">' + (i + 1) + '</span><span class="rx-who">' + esc(r.name) + '</span><span class="rx-time">' + fmt(r.ms) + "</span></li>";
    }).join("");
    var rank = period === "week" ? board.weekRank : board.allRank;
    var total = period === "week" ? board.weekTotal : board.allTotal;
    boardNote.textContent = (period === "week" ? "Weekly board resets every Monday 00:00 UTC. " : "") +
      "Best time per name. " + (rank ? "You're #" + rank + " of " + total + "." : total + " drivers so far.");
  }

  function selectTab(p) {
    period = p;
    tabWeek.setAttribute("aria-selected", p === "week" ? "true" : "false");
    tabAll.setAttribute("aria-selected", p === "all" ? "true" : "false");
    render();
  }
  tabWeek.addEventListener("click", function () { selectTab("week"); });
  tabAll.addEventListener("click", function () { selectTab("all"); });

  function fetchBoard() {
    if (!api) { render(); return; }
    fetch(api + (api.indexOf("?") < 0 ? "?" : "&") + "name=" + encodeURIComponent(playerName))
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.week) { board = d; render(); } })
      .catch(function () { boardEl.innerHTML = '<li class="rx-empty">Leaderboard unavailable right now.</li>'; });
  }

  function submit(ms) {
    if (!api || !playerName) return;
    fetch(api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ name: playerName, ms: ms }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.week) { board = d; lastRank = d.weekRank; render(); }
        if (d && d.ok && d.weekRank) statusEl.textContent += " You're #" + d.weekRank + " this week.";
      })
      .catch(function () {});
  }

  // ---------- sharing ----------
  function challengeUrl() {
    var n = playerName;
    return SITE + "?beat=" + lastMs + (n ? "&from=" + encodeURIComponent(n) : "");
  }

  function drawCard() {
    var c = document.createElement("canvas");
    c.width = 1080; c.height = 1920;
    var g = c.getContext("2d");
    var bg = g.createLinearGradient(0, 0, 1080, 1920);
    bg.addColorStop(0, "#0B4F33"); bg.addColorStop(1, "#08110D");
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
    g.strokeStyle = "rgba(242,238,227,0.05)"; g.lineWidth = 3;
    for (var x = -1920; x < 1080; x += 46) { g.beginPath(); g.moveTo(x, 1920); g.lineTo(x + 900, 0); g.stroke(); }
    // lights
    for (var i = 0; i < 5; i++) {
      var cx = 180 + i * 180;
      g.fillStyle = "#111"; g.beginPath(); g.arc(cx, 470, 70, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2BD46B"; g.beginPath(); g.arc(cx, 470, 54, 0, Math.PI * 2); g.fill();
    }
    g.textAlign = "center";
    g.fillStyle = "#F5C518"; g.font = "500 40px 'JetBrains Mono', monospace";
    g.fillText("REACTION TEST", 540, 300);
    g.fillStyle = "#F2EEE3"; g.font = "900 230px Archivo, 'Arial Black', sans-serif";
    g.fillText((lastMs / 1000).toFixed(3), 540, 900);
    g.font = "800 70px Archivo, 'Arial Black', sans-serif";
    g.fillText("SECONDS", 540, 1000);
    var n = playerName;
    g.fillStyle = "#A9B8AF"; g.font = "500 52px Inter, sans-serif";
    if (n) g.fillText(n, 540, 1130);
    if (lastRank) { g.fillStyle = "#F5C518"; g.font = "800 64px Archivo, 'Arial Black', sans-serif"; g.fillText("#" + lastRank + " THIS WEEK", 540, 1230); }
    g.fillStyle = "#F2EEE3"; g.font = "900 96px Archivo, 'Arial Black', sans-serif";
    g.fillText("BEAT MY START", 540, 1470);
    g.fillStyle = "#F5C518"; g.font = "500 44px 'JetBrains Mono', monospace";
    g.fillText("goliunov.github.io/reaction", 540, 1570);
    g.fillStyle = "#F5C518"; g.fillRect(0, 1890, 1080, 30);
    return new Promise(function (res) { c.toBlob(res, "image/png"); });
  }

  function flash(t) { statusEl.textContent = t; }

  document.getElementById("rx-share-story").addEventListener("click", function () {
    if (lastMs == null) return;
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(drawCard).then(function (blob) {
      var file = new File([blob], "reaction-" + lastMs + "ms.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: "My start: " + fmt(lastMs), text: "Beat my start: " + challengeUrl() })
          .catch(function () {});
      }
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      flash("Image saved — post it to your Stories and add a link sticker to goliunov.github.io/reaction.");
    });
  });

  document.getElementById("rx-challenge-btn").addEventListener("click", function () {
    if (lastMs == null) return;
    var url = challengeUrl();
    var text = "My start: " + fmt(lastMs) + ". Beat it 👉";
    if (navigator.share) {
      navigator.share({ title: "Reaction test", text: text, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + " " + url).then(function () { flash("Link copied — send it to a friend."); });
    } else {
      prompt("Copy this link:", url);
    }
  });

  var saved = cleanName(load("rx_name"));
  nameInput.value = saved;
  if (saved && !nameProblem(saved)) setPlayer(saved); else { askName(false); fetchBoard(); }
  render();
})();
