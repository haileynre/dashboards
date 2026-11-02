(function () {
  var LOG = Array.isArray(window.CHANGE_LOG) ? window.CHANGE_LOG : [];
  var PLATFORM_ORDER = [
    "Close", "n8n", "ActiveCampaign", "Zapier", "Zoom", "Eventpack",
    "Pulse", "monday", "GitHub Pages", "Dashboards"
  ];
  var STATUS_LABEL = {
    live: "Live",
    draft: "Draft",
    reviewed: "Reviewed",
    repo: "In the repo"
  };

  var STORAGE_KEY = "nre-change-decisions";
  var pendingUndo = null;

  var selected = latestDate();
  var visible = monthOf(selected);
  var platform = "all";

  var grid = document.getElementById("grid");
  var detail = document.getElementById("day-detail");
  var monthLabel = document.getElementById("month-label");
  var summary = document.getElementById("summary");
  var filters = document.getElementById("filters");
  var themeBtn = document.getElementById("theme-btn");

  document.getElementById("prev-month").addEventListener("click", function () {
    visible = addMonths(visible, -1);
    paint();
  });
  document.getElementById("next-month").addEventListener("click", function () {
    visible = addMonths(visible, 1);
    paint();
  });
  themeBtn.addEventListener("click", function () {
    var root = document.documentElement;
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("nre-change-theme", next); } catch (e) {}
    labelTheme();
  });
  document.addEventListener("keydown", onKey);
  detail.addEventListener("click", onDetailClick);
  detail.addEventListener("input", onDetailInput);

  labelTheme();
  buildFilters();
  paint();

  function latestDate() {
    var dates = LOG.map(function (row) { return row.date; }).sort();
    return dates.length ? dates[dates.length - 1] : iso(new Date());
  }

  function monthOf(isoDate) {
    var p = isoDate.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, 1);
  }

  function addMonths(date, n) {
    return new Date(date.getFullYear(), date.getMonth() + n, 1);
  }

  function iso(date) {
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + m + "-" + d;
  }

  function parseIso(value) {
    var p = value.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function sameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch (e) { return {}; }
  }

  function writeStore(store) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch (e) {}
  }

  function decisionFor(row) {
    if (row.decision === "approved" || row.decision === "rejected") return row.decision;
    var saved = readStore()[row.id];
    return saved && saved.decision ? saved.decision : "";
  }

  function actualFor(row) {
    var saved = readStore()[row.id];
    if (saved && Object.prototype.hasOwnProperty.call(saved, "actualImpact")) return saved.actualImpact;
    return row.actualImpact || "";
  }

  function patchStore(id, patch) {
    var store = readStore();
    var current = store[id] || {};
    Object.keys(patch).forEach(function (key) {
      if (patch[key] === null) delete current[key];
      else current[key] = patch[key];
    });
    if (!Object.keys(current).length) delete store[id];
    else store[id] = current;
    writeStore(store);
  }

  function polishNote(text) {
    var contractions = {
      dont: "don't", doesnt: "doesn't", cant: "can't", wont: "won't",
      didnt: "didn't", isnt: "isn't", wasnt: "wasn't", werent: "weren't",
      arent: "aren't", hasnt: "hasn't", havent: "haven't", hadnt: "hadn't",
      couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't",
      theyre: "they're", youre: "you're", thats: "that's", whats: "what's",
      im: "I'm", ive: "I've", ill: "I'll"
    };
    var words = {
      teh: "the", recieve: "receive", seperate: "separate", occured: "occurred",
      untill: "until", wich: "which", becuase: "because", definately: "definitely",
      alot: "a lot", wierd: "weird", tommorow: "tomorrow", sucess: "success"
    };
    var cleaned = String(text || "").replace(/\r\n/g, "\n").trim();
    cleaned = cleaned.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
    cleaned = cleaned.replace(/[ \t]{2,}/g, " ");
    cleaned = cleaned.replace(/\s+([,.;:!?])/g, "$1");
    cleaned = cleaned.replace(/([,.;:!?])(?=[A-Za-z])/g, "$1 ");
    cleaned = cleaned.replace(/([.!?]){2,}/g, "$1");
    cleaned = cleaned.replace(/\b[a-z']+\b/gi, function (word) {
      var lower = word.toLowerCase();
      if (contractions[lower]) return contractions[lower];
      if (words[lower]) return words[lower];
      if (lower === "i") return "I";
      return word;
    });
    cleaned = cleaned.replace(/(^|[.!?]\s+|\n+)([a-z])(?![0-9])/g, function (_, lead, letter) {
      return lead + letter.toUpperCase();
    });
    if (cleaned && /[A-Za-z]/.test(cleaned) && !/[.!?…"']$/.test(cleaned)) cleaned += ".";
    return cleaned;
  }

  function isRejected(row) {
    return decisionFor(row) === "rejected";
  }

  function visibleRow(row) {
    if (isRejected(row)) return false;
    if (platform === "all") return true;
    return (row.platforms || []).indexOf(platform) !== -1;
  }

  function entriesOn(date) {
    return LOG.filter(function (row) {
      return row.date === date && visibleRow(row);
    });
  }

  function allPlatforms() {
    var found = {};
    LOG.forEach(function (row) {
      (row.platforms || []).forEach(function (name) { found[name] = true; });
    });
    return PLATFORM_ORDER.filter(function (name) { return found[name]; });
  }

  function buildFilters() {
    var names = ["all"].concat(allPlatforms());
    filters.innerHTML = "";
    names.forEach(function (name) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = name === "all" ? "All platforms" : name;
      btn.setAttribute("aria-pressed", name === platform ? "true" : "false");
      btn.addEventListener("click", function () {
        platform = name;
        paint();
      });
      filters.appendChild(btn);
    });
  }

  function paintFilters() {
    var buttons = filters.querySelectorAll("button");
    buttons.forEach(function (btn) {
      var name = btn.textContent === "All platforms" ? "all" : btn.textContent;
      btn.setAttribute("aria-pressed", name === platform ? "true" : "false");
    });
  }

  function paintSummary() {
    var shown = LOG.filter(visibleRow);
    var days = {};
    var counts = { live: 0, draft: 0, reviewed: 0 };
    shown.forEach(function (row) {
      days[row.date] = true;
      if (counts[row.status] !== undefined) counts[row.status] += 1;
    });
    var review = shown.filter(function (row) {
      return row.needsReview && decisionFor(row) !== "approved";
    }).length;
    var cards = [
      [Object.keys(days).length, "Days with a log"],
      [counts.live, "Live changes"],
      [counts.draft, "Drafts"],
      [review, "Impacts to confirm"]
    ];
    summary.innerHTML = cards.map(function (card) {
      return "<div class=\"stat\"><b>" + card[0] + "</b><span>" + card[1] + "</span></div>";
    }).join("");
  }

  function paint() {
    paintFilters();
    paintSummary();
    paintMonth();
    paintDetail();
  }

  function paintMonth() {
    var monthName = visible.toLocaleString("en-US", { month: "long", year: "numeric" });
    monthLabel.textContent = monthName;
    grid.innerHTML = "";

    var first = new Date(visible.getFullYear(), visible.getMonth(), 1);
    var start = new Date(first);
    start.setDate(1 - first.getDay());
    var today = iso(new Date());

    for (var i = 0; i < 42; i += 1) {
      var day = new Date(start);
      day.setDate(start.getDate() + i);
      var key = iso(day);
      var inMonth = sameMonth(day, visible);
      var rows = entriesOn(key);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day" +
        (inMonth ? "" : " out") +
        (key === selected ? " selected" : "") +
        (key === today ? " today" : "");
      btn.setAttribute("data-date", key);
      if (key === selected) btn.setAttribute("aria-current", "date");
      btn.setAttribute("aria-label", labelFor(day, rows));
      btn.tabIndex = key === selected ? 0 : -1;

      var num = document.createElement("span");
      num.className = "num";
      num.textContent = String(day.getDate());
      var dots = document.createElement("span");
      dots.className = "dots";
      rows.forEach(function (row) {
        var dot = document.createElement("span");
        dot.className = "dot " + (row.status || "reviewed");
        dots.appendChild(dot);
      });
      btn.appendChild(num);
      btn.appendChild(dots);
      btn.addEventListener("click", function (event) {
        select(event.currentTarget.getAttribute("data-date"), true);
      });
      grid.appendChild(btn);
    }
  }

  function labelFor(day, rows) {
    var spoken = day.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (!rows.length) return spoken + ", nothing logged";
    return spoken + ", " + rows.length + (rows.length === 1 ? " change" : " changes");
  }

  function select(date, focus) {
    selected = date;
    var parsed = parseIso(date);
    if (!sameMonth(parsed, visible)) visible = monthOf(date);
    paint();
    if (focus) {
      var current = grid.querySelector('[data-date="' + date + '"]');
      if (current) current.focus();
    }
  }

  function paintDetail() {
    var day = parseIso(selected);
    var heading = day.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric" });
    var rows = entriesOn(selected);
    var count = rows.length
      ? rows.length + (rows.length === 1 ? " entry" : " entries")
      : "Nothing logged";

    var html = "<div class=\"day-head\"><h2>" + heading + "</h2><p>" + count + "</p></div>";
    html += undoBanner();
    if (!rows.length) {
      html += "<div class=\"empty\"><strong>Quiet day</strong>Nothing from Cursor was logged. Work that stopped before it landed is left off the calendar.</div>";
    } else {
      html += rows.map(cardHtml).join("");
    }
    detail.innerHTML = html;
    detail.querySelectorAll("textarea[data-note]").forEach(function (box) {
      var id = box.getAttribute("data-note");
      var row = null;
      LOG.forEach(function (item) { if (item.id === id) row = item; });
      if (row) box.value = actualFor(row);
    });
  }

  function cardHtml(row) {
    var status = row.status || "reviewed";
    var pills = (row.platforms || []).map(function (name) {
      return "<span class=\"pill\">" + escapeHtml(name) + "</span>";
    }).join("");
    pills += "<span class=\"pill " + status + "\">" + STATUS_LABEL[status] + "</span>";
    if (row.brand) pills += "<span class=\"pill brand\">" + escapeHtml(row.brand) + "</span>";

    var fromBrowser = !(row.decision === "approved" || row.decision === "rejected") &&
      !!(readStore()[row.id] && readStore()[row.id].decision === "approved");
    var approved = decisionFor(row) === "approved" || !row.needsReview;
    var impactClass = approved ? "impact ok" : "impact";
    var flag = approved ? "Impact confirmed" : "Needs review";
    var links = (row.links || []).map(function (link) {
      return "<a href=\"" + escapeAttr(link.href) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
        escapeHtml(link.label) + "</a>";
    }).join("");

    return "<article class=\"card\">" +
      "<div class=\"meta\">" + pills + "</div>" +
      "<h3>" + escapeHtml(row.title) + "</h3>" +
      "<div class=\"label\">What changed</div>" +
      "<p>" + escapeHtml(row.change) + "</p>" +
      "<div class=\"label\">Inferred impact</div>" +
      "<div class=\"" + impactClass + "\"><span class=\"flag\">" + flag + "</span><p>" +
      escapeHtml(row.impacts) + "</p></div>" +
      "<label class=\"label\" for=\"actual-" + escapeAttr(row.id) + "\">What actually happened</label>" +
      "<textarea id=\"actual-" + escapeAttr(row.id) + "\" class=\"actual\" data-note=\"" + escapeAttr(row.id) + "\" rows=\"3\" placeholder=\"The part you finished by hand, and what it affected.\"></textarea>" +
      (wordingChanged(row) ? "<p class=\"action-note\">Cleaned the wording. <button type=\"button\" class=\"restore\" data-restore-wording=\"" + escapeAttr(row.id) + "\">Restore my wording</button></p>" : "") +
      (links ? "<div class=\"links\">" + links + "</div>" : "") +
      "<div class=\"actions\">" +
      "<button type=\"button\" class=\"approve\" data-act=\"approved\" data-id=\"" + escapeAttr(row.id) + "\"" +
      (approved ? " aria-pressed=\"true\"" : "") + ">" + (approved ? "Approved" : "Approve") + "</button>" +
      "<button type=\"button\" class=\"reject\" data-act=\"rejected\" data-id=\"" + escapeAttr(row.id) + "\">Reject</button>" +
      "</div>" +
      (fromBrowser ? "<p class=\"action-note\">Saved in this browser. Ask me to update the calendar when you want the team copy to match.</p>" : "") +
      "</article>";
  }

  function wordingChanged(row) {
    var saved = readStore()[row.id];
    return !!(saved && typeof saved.actualImpactRaw === "string" && saved.actualImpact !== saved.actualImpactRaw);
  }

  function undoBanner() {
    if (!pendingUndo) return "";
    var row = null;
    LOG.forEach(function (item) { if (item.id === pendingUndo) row = item; });
    if (!row || row.date !== selected) return "";
    return "<div class=\"undo\"><span>Removed from this calendar.</span>" +
      "<button type=\"button\" data-undo=\"" + escapeAttr(pendingUndo) + "\">Undo</button></div>";
  }

  function onDetailClick(event) {
    var restore = event.target.closest("[data-restore-wording]");
    if (restore) {
      var restoreId = restore.getAttribute("data-restore-wording");
      var savedNote = readStore()[restoreId];
      if (savedNote && typeof savedNote.actualImpactRaw === "string") {
        patchStore(restoreId, { actualImpact: savedNote.actualImpactRaw, actualImpactRaw: null });
      }
      paint();
      return;
    }
    var undo = event.target.closest("[data-undo]");
    if (undo) {
      var undoId = undo.getAttribute("data-undo");
      var cleared = readStore();
      if (cleared[undoId]) {
        delete cleared[undoId].decision;
        if (!cleared[undoId].actualImpact) delete cleared[undoId];
      }
      writeStore(cleared);
      pendingUndo = null;
      paint();
      return;
    }
    var btn = event.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act");
    if (act === "rejected" && btn.getAttribute("data-armed") !== "yes") {
      btn.textContent = "Remove it";
      btn.setAttribute("data-armed", "yes");
      return;
    }
    var id = btn.getAttribute("data-id");
    var patch = { decision: act, at: new Date().toISOString() };
    if (act === "approved") {
      var box = detail.querySelector("textarea[data-note=\"" + id + "\"]");
      var raw = box ? box.value : "";
      var polished = polishNote(raw);
      patch.actualImpact = polished;
      patch.actualImpactRaw = polished === raw ? null : raw;
    }
    patchStore(id, patch);
    pendingUndo = act === "rejected" ? id : null;
    paint();
  }

  function onDetailInput(event) {
    var box = event.target;
    if (!box || !box.getAttribute || !box.getAttribute("data-note")) return;
    patchStore(box.getAttribute("data-note"), { actualImpact: box.value });
  }

  function onKey(event) {
    var keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (keys.indexOf(event.key) === -1) return;
    var focused = document.activeElement;
    if (focused && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA" || (focused.tagName === "BUTTON" && !focused.classList.contains("day")))) return;
    var step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : 7;
    var next = parseIso(selected);
    next.setDate(next.getDate() + step);
    event.preventDefault();
    select(iso(next), true);
  }

  function labelTheme() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    themeBtn.textContent = dark ? "Light mode" : "Dark mode";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }
})();
