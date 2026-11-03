(() => {
"use strict";
const CFG = window.LEAGUE_CONFIG || {};
const SEASON = window.SEASON;
const SLOTS = SEASON.slots;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const I = {
  cal:'<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  chev:'<svg class="ico chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  trophy:'<svg class="ico" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5"/></svg>',
  edit:'<svg class="ico" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  star:'<svg class="ico" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  check:'<svg class="ico" viewBox="0 0 24 24" style="width:16px;height:16px;stroke-width:3"><path d="m5 12 5 5 9-10"/></svg>',
};

/* ---------- state ---------- */
let TEAMS = {}, MATCHES = [], DUES = {};
let sb = null, commish = false, source = "seed", lastLoad = null;
const MY_KEY = "phs-my-team";
let MY = null; try { MY = localStorage.getItem(MY_KEY); } catch (e) {}

function useSeed(){
  TEAMS = Object.fromEntries(window.SEED.teams.map(t => [t.code, t]));
  MATCHES = window.SEED.matches.map(r => ({season:SEASON.id, week:r[0], slot:r[1], red:r[2], blue:r[3], g1r:r[4], g1b:r[5], g2r:r[6], g2b:r[7]}));
  source = "seed";
}

/* ---------- dates (viewer's own clock; the league is all in Wilmington) ---------- */
const pad = n => String(n).padStart(2,"0");
const ymd = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
function weekDate(n){ const [y,m,d] = SEASON.start.split("-").map(Number); return new Date(y, m-1, d + 7*(n-1)); }
const fmtShort = d => d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtLong  = d => d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
const today = () => ymd(new Date());
const WEEKS = [...Array(SEASON.weeks)].map((_,i) => i+1);

/* ---------- game logic ---------- */
const games = m => [[m.g1r,m.g1b],[m.g2r,m.g2b]];
const entered = g => g[0] != null || g[1] != null;
const done = g => g[0] != null && g[1] != null && g[0] !== g[1] && Math.max(g[0],g[1]) >= SEASON.to;
function mState(m){ const [a,b] = games(m); if (done(a) && done(b)) return "final"; if (entered(a) || entered(b)) return "partial"; return "open"; }
function wins(m){ let r=0,b=0; games(m).forEach(g => { if (done(g)) g[0] > g[1] ? r++ : b++; }); return [r,b]; }
const tn = c => (TEAMS[c] && TEAMS[c].name) || c;
const mDate = m => ymd(weekDate(m.week));
const weekMatches = n => MATCHES.filter(m => m.week === n).sort((a,b) => a.slot - b.slot);
const isMine = m => MY && (m.red === MY || m.blue === MY);
function summary(m){
  const [r,b] = wins(m);
  if (r === b) return "Split 1–1";
  return `${esc(tn(r > b ? m.red : m.blue))} ${Math.max(r,b) === 2 ? "sweep 2–0" : "win"}`;
}

/* ---------- match card ---------- */
function statusPill(m, opts = {}){
  const st = mState(m), d = mDate(m), t = today();
  if (st === "final") return '<span class="pill">Final</span>';
  if (st === "partial" && d === t) return '<span class="pill live">● Live</span>';
  if (d < t) return '<span class="pill owed">Make-up</span>';
  if (opts.upNext) return '<span class="pill next">Up next</span>';
  return "";
}
function matchCard(m, opts = {}){
  const st = mState(m), [r,b] = wins(m), gs = games(m);
  const cell = (g,i) => g[i] != null ? `<span class="g ${done(g) && g[i] > g[1-i] ? "w" : ""}">${g[i]}</span>` : '<span class="g empty">–</span>';
  const row = (i,cls) => `<div class="cols trow ${st === "final" && ((i === 0 && r > b) || (i === 1 && b > r)) ? "won" : ""}"><span class="puck ${cls}"></span><span class="tname">${esc(tn(i ? m.blue : m.red))}</span>${cell(gs[0],i)}${cell(gs[1],i)}</div>`;
  let foot = "";
  if (st === "final") foot = `<div class="m-foot"><span>${summary(m)}</span>${isMine(m) ? '<span class="tag">Your team</span>' : ""}</div>`;
  if (commish) foot += `<div class="btns"><button class="btn block" data-edit="${m.week}-${m.slot}">${I.edit} ${st === "open" ? "Enter score" : "Edit score"}</button></div>`;
  const label = opts.label || `${SLOTS[m.slot]} PM`;
  return `<div class="card match ${isMine(m) ? "mine" : ""}">
    <div class="m-head"><span class="time">${label}</span>${statusPill(m, opts)}</div>
    <div class="cols hdr"><span></span><span></span><span>G1</span><span>G2</span></div>
    ${row(0,"red")}${row(1,"blue")}${foot}</div>`;
}
function srow(m, opts = {}){
  const st = mState(m), [r,b] = wins(m), gs = games(m), t = today(), d = mDate(m);
  const gtxt = g => entered(g) ? `${g[0] ?? 0}-${g[1] ?? 0}` : "";
  let res = "";
  if (st === "final") res = `<b>${r}–${b}</b> · ${gtxt(gs[0])}, ${gtxt(gs[1])}`;
  else if (st === "partial") res = (d === t ? '<span class="live">LIVE</span> · ' : "make-up · ") + [gtxt(gs[0]), gtxt(gs[1])].filter(Boolean).join(", ");
  else if (d < t) res = "make-up";
  const inner = `<span class="t">${SLOTS[m.slot]}</span><span>${esc(tn(m.red))} <span class="vs">vs</span> ${esc(tn(m.blue))}</span><span class="res">${res}</span>`;
  return commish && !opts.view
    ? `<button class="srow ${isMine(m) ? "mine" : ""}" data-edit="${m.week}-${m.slot}">${inner}</button>`
    : `<div class="srow ${isMine(m) ? "mine" : ""}">${inner}</div>`;
}
const owedMatches = () => MATCHES.filter(m => mDate(m) < today() && mState(m) !== "final").sort((a,b) => a.week - b.week || a.slot - b.slot);

/* ---------- views ---------- */
function renderTonight(){
  const t = today();
  const tonight = WEEKS.find(n => ymd(weekDate(n)) === t);
  const next = WEEKS.find(n => ymd(weekDate(n)) > t);
  const last = [...WEEKS].reverse().find(n => ymd(weekDate(n)) < t);
  let h = "";
  if (tonight){
    const ms = weekMatches(tonight);
    const up = ms.findIndex(m => mState(m) === "open");
    h += `<div class="eyebrow">Tonight</div><div class="h1">Week ${tonight} · ${fmtLong(weekDate(tonight))}</div>
      <div class="h1-sub">${ms.length} matches · 1 table · first puck ${SLOTS[0]}</div>`;
    h += ms.map((m,i) => matchCard(m, {upNext: i === up})).join("");
    if (next){
      h += `<div class="eyebrow gap">Next Tuesday · Week ${next}</div><div class="card" style="overflow:hidden">${weekMatches(next).map(m => srow(m, {view:true})).join("")}</div>`;
    }
  } else if (next){
    const ms = weekMatches(next);
    h += `<div class="eyebrow">Next league night</div><div class="h1">Week ${next} · ${fmtLong(weekDate(next))}</div>
      <div class="h1-sub">${ms.length} matches · 1 table · first puck ${SLOTS[0]}</div>`;
    h += ms.map(m => matchCard(m)).join("");
    if (last) h += `<div class="eyebrow gap">Last week · Week ${last} results</div>` + weekMatches(last).map(m => matchCard(m)).join("");
  } else {
    h += `<div class="eyebrow">${SEASON.label}</div><div class="h1">Regular season is done</div>
      <div class="h1-sub">Make-ups ${esc(SEASON.makeup)} · Tournament ${esc(SEASON.tournament)}</div>`;
  }
  const owed = owedMatches();
  if (owed.length){
    h += `<div class="eyebrow gap">Make-up board · ${owed.length} owed</div>`;
    h += owed.map(m => matchCard(m, {label:`Week ${m.week} · ${SLOTS[m.slot]}`})).join("");
    h += `<div class="card pad note">${I.cal}<span>Make-up window: <b>${esc(SEASON.makeup)}</b>. The commissioners post make-up results here.</span></div>`;
  }
  h += `<div class="card milestone">${I.trophy}<div><div class="wk">Season-Ending Tournament</div><div class="sub">${esc(SEASON.tournament)} · bracket after the make-up window</div></div></div>`;
  $("#v-tonight").innerHTML = h;
}

function renderStandings(){
  const S = {}; Object.keys(TEAMS).forEach(k => S[k] = {w:0,l:0,pf:0,pa:0});
  MATCHES.forEach(m => games(m).forEach(g => {
    if (!done(g) || !S[m.red] || !S[m.blue]) return;
    S[m.red].pf += g[0]; S[m.red].pa += g[1]; S[m.blue].pf += g[1]; S[m.blue].pa += g[0];
    if (g[0] > g[1]) { S[m.red].w++; S[m.blue].l++; } else { S[m.blue].w++; S[m.red].l++; }
  }));
  // Win % (not raw wins) so a team owed a make-up isn't pushed down; same thing once every game is in
  const pct = k => S[k].w + S[k].l ? S[k].w / (S[k].w + S[k].l) : 0;
  const order = Object.keys(S).sort((a,b) => pct(b) - pct(a) || (S[b].pf - S[b].pa) - (S[a].pf - S[a].pa) || tn(a).localeCompare(tn(b)));
  const t = today(), thru = [...WEEKS].reverse().find(n => ymd(weekDate(n)) < t), tonight = WEEKS.find(n => ymd(weekDate(n)) === t);
  $("#stand-title").textContent = thru ? `Through Week ${thru}` : "Preseason";
  $("#stand-sub").textContent = "Ranked by win % · ties broken by point differential" + (tonight ? ` · Week ${tonight} games count as soon as they finish` : "");
  const owed = owedMatches();
  if (owed.length){
    const list = owed.map(m => `${esc(tn(m.red))} vs ${esc(tn(m.blue))} (Week ${m.week})`);
    $("#pending-note").innerHTML = `<b>Not counted yet:</b> ${list.length > 1 ? list.slice(0,-1).join(", ") + " and " + list[list.length-1] : list[0]}.`;
    $("#pending-card").hidden = false;
  } else $("#pending-card").hidden = true;
  $("#stand-body").innerHTML = order.map((k,i) => { const s = S[k], d = s.pf - s.pa;
    return `<tr class="${k === MY ? "me" : ""}"><td>${i+1}</td><td>${esc(tn(k))}</td><td class="wl">${s.w}–${s.l}</td><td>${s.pf}</td><td>${s.pa}</td><td class="${d > 0 ? "pos" : d < 0 ? "neg" : ""}">${d > 0 ? "+" : ""}${d}</td></tr>`; }).join("");
}

function renderSchedule(){
  const t = today();
  $("#sched-title").textContent = `${SEASON.weeks} weeks · ${fmtShort(weekDate(1))} – ${fmtShort(weekDate(SEASON.weeks))}`;
  const openWeeks = $$("#sched-list details[open]").map(d => +d.dataset.w);
  const firstRender = !$("#sched-list").children.length;
  const tonight = WEEKS.find(n => ymd(weekDate(n)) === t), next = WEEKS.find(n => ymd(weekDate(n)) > t);
  let h = "";
  for (const n of WEEKS){
    const d = ymd(weekDate(n)), ms = weekMatches(n);
    const owed = ms.filter(m => mState(m) !== "final").length;
    const st = d < t ? (owed ? `<span class="pill owed">${owed} owed</span>` : '<span class="pill">Final</span>')
             : d === t ? '<span class="pill live">Tonight</span>' : '<span class="pill next">Upcoming</span>';
    const open = firstRender ? (n === tonight || n === next) : openWeeks.includes(n);
    h += `<details class="card week" data-w="${n}" ${open ? "open" : ""}><summary><span class="wk">Week ${n}<small>Tue ${fmtShort(weekDate(n))}</small></span><span style="display:flex;gap:8px;align-items:center">${st}${I.chev}</span></summary>${ms.map(srow).join("")}</details>`;
  }
  h += `<div class="card milestone">${I.cal}<div><div class="wk">Make-up window</div><div class="sub">${esc(SEASON.makeup)}</div></div></div>
    <div class="card milestone">${I.trophy}<div><div class="wk">Season-Ending Tournament</div><div class="sub">${esc(SEASON.tournament)}</div></div></div>`;
  $("#sched-list").innerHTML = h;
}

const players = k => String(TEAMS[k].players || "").split(" & ").map(s => s.trim()).filter(Boolean);
const realPlayer = nm => !/TBD/i.test(nm);
function sortedTeams(){ return Object.keys(TEAMS).sort((a,b) => tn(a).localeCompare(tn(b))); }
function renderTeams(){
  const ks = sortedTeams();
  const count = ks.reduce((n,k) => n + players(k).filter(realPlayer).length, 0);
  $("#teams-title").textContent = `${ks.length} teams · ${count} players`;
  $("#team-list").innerHTML = ks.map(k => `<div class="card team ${k === MY ? "mine" : ""}"><div class="team-row">
    <div><h3>${esc(tn(k))}</h3><p>${esc(TEAMS[k].players)}</p></div>
    <button class="btn sm" data-my="${esc(k)}" aria-pressed="${k === MY}">${I.star} ${k === MY ? "My team" : "My team?"}</button>
  </div></div>`).join("");
}

function renderDues(){
  if (!commish) return;
  const only = $("#unpaid-only").getAttribute("aria-pressed") === "true";
  let total = 0, paid = 0;
  const html = sortedTeams().map(k => {
    const rows = players(k).map(nm => {
      const real = realPlayer(nm), id = k + "|" + nm, on = !!DUES[id];
      if (real) total++; if (real && on) paid++;
      if (only && (on || !real)) return "";
      const when = on ? new Date(DUES[id] + "T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "";
      return `<button class="payrow ${on ? "paid" : ""}" data-pay="${esc(id)}" ${real ? "" : "disabled"}><span class="box">${on ? I.check : ""}</span><span class="who">${esc(nm)}</span><span class="st">${!real ? "not named yet" : on ? "Paid · " + when : "Unpaid"}</span></button>`;
    }).join("");
    return rows ? `<div class="card team"><h3>${esc(tn(k))}</h3>${rows}</div>` : "";
  }).join("");
  $("#dues-list").innerHTML = html || '<div class="card pad" style="text-align:center;color:var(--muted)">Everyone has paid.</div>';
  $("#dues-title").textContent = `League dues · ${SEASON.label}`;
  $("#dues-amt").textContent = `$${SEASON.dues} / player`;
  $("#dues-count").textContent = `${paid} of ${total} paid · $${(paid*SEASON.dues).toLocaleString()} of $${(total*SEASON.dues).toLocaleString()}`;
  $("#dues-bar").style.width = (total ? paid/total*100 : 0) + "%";
}

function render(){
  $("#hero-sub").textContent = `Tuesdays at The Parlour House · ${SEASON.label}`;
  renderTonight(); renderStandings(); renderSchedule(); renderTeams(); renderDues();
  $("#whoami").hidden = !commish;
  $("#signin-link").hidden = !sb || commish;
  $('.tab[data-v="dues"]').hidden = !commish;
  if (!commish && $("#v-dues").classList.contains("on")) showTab("tonight");
  const stale = $("#stale");
  if (sb && source === "seed"){ stale.hidden = false; stale.textContent = "Couldn't reach live scores. Showing saved results."; }
  else stale.hidden = true;
  if (editing) drawEditor();
}

/* ---------- tabs (also #standings etc. so a QR code can open a tab) ---------- */
function showTab(name){
  $$(".tab").forEach(x => x.classList.toggle("on", x.dataset.v === name));
  $$(".view").forEach(v => v.classList.toggle("on", v.id === "v-" + name));
}
$$(".tab").forEach(t => t.onclick = () => { showTab(t.dataset.v); history.replaceState(null, "", "#" + t.dataset.v); window.scrollTo({top:0}); });

/* ---------- toasts + sheets ---------- */
let tt; function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2800); }
function openSheet(id){ $("#" + id).classList.add("on"); }
function closeSheet(el){ el.classList.remove("on"); if (el.id === "edit") closeEditor(); }

document.addEventListener("click", e => {
  const ed = e.target.closest("[data-edit]"); if (ed && commish){ openEditor(ed.dataset.edit); return; }
  const my = e.target.closest("[data-my]"); if (my){
    MY = MY === my.dataset.my ? null : my.dataset.my;
    try { MY ? localStorage.setItem(MY_KEY, MY) : localStorage.removeItem(MY_KEY); } catch (err) {}
    render(); toast(MY ? `${tn(MY)} will be highlighted on this phone` : "Highlight removed"); return; }
  const p = e.target.closest("[data-pay]"); if (p && !p.disabled){ togglePaid(p.dataset.pay); return; }
  const c = e.target.closest("[data-close]"); if (c){ closeSheet(c.closest(".scrim")); return; }
  if (e.target.classList.contains("scrim")){ closeSheet(e.target); return; }
});

/* ---------- score editor ---------- */
let editing = null, edGame = 0, saveTimer = null, saving = false, dirty = false, lastEdited = null;
const findMatch = key => { const [w,s] = key.split("-").map(Number); return MATCHES.find(m => m.week === w && m.slot === s); };
function openEditor(key){
  const m = findMatch(key); if (!m) return;
  if (dirty) flushSave();
  editing = key;
  const gs = games(m);
  edGame = done(gs[0]) && !done(gs[1]) ? 1 : 0;
  $("#ed-title").textContent = `Week ${m.week} · ${SLOTS[m.slot]} PM`;
  $("#ed-sub").textContent = `${tn(m.red)} vs ${tn(m.blue)} · first to ${SEASON.to}. Changes save automatically.`;
  $("#ed-n0").textContent = tn(m.red); $("#ed-n1").textContent = tn(m.blue);
  setSave("");
  drawEditor(); openSheet("edit");
}
function closeEditor(){ if (dirty) flushSave(); editing = null; }
function curGame(){ return edGame ? ["g2r","g2b"] : ["g1r","g1b"]; }
function drawEditor(){
  const m = findMatch(editing); if (!m) return;
  const [kr,kb] = curGame(), s = [m[kr], m[kb]];
  [0,1].forEach(i => { const inp = $("#s" + i); if (document.activeElement !== inp) inp.value = s[i] ?? ""; });
  $("#side-0").classList.toggle("lead", (s[0] ?? 0) > (s[1] ?? 0));
  $("#side-1").classList.toggle("lead", (s[1] ?? 0) > (s[0] ?? 0));
  $$("#edit .seg button").forEach(b => b.classList.toggle("on", +b.dataset.g === edGame));
  const bn = $("#ed-banner"), gs = games(m);
  if (done(gs[0]) && done(gs[1])){ bn.hidden = false; bn.textContent = `Match final: ${summary(m).replace(/&amp;/g,"&")}. Standings are updated.`; }
  else if (done(s)){ bn.hidden = false; bn.textContent = `Game ${edGame+1} final: ${tn(s[0] > s[1] ? m.red : m.blue)} win ${Math.max(...s)}–${Math.min(...s)}.` + (edGame === 0 ? " Tap Game 2 when it starts." : ""); }
  else bn.hidden = true;
}
function setScore(side, val){
  const m = findMatch(editing); if (!m) return;
  const [kr,kb] = curGame(), keys = [kr,kb];
  m[keys[side]] = val; lastEdited = editing;
  if (val != null && m[keys[1-side]] == null) m[keys[1-side]] = 0;  // starting a game sets the other side to 0
  dirty = true; render(); queueSave();
}
$$("#edit .seg button").forEach(b => b.onclick = () => { edGame = +b.dataset.g; drawEditor(); });
$$("#edit [data-t]").forEach(b => b.onclick = () => {
  const m = findMatch(editing); if (!m) return;
  const [kr,kb] = curGame(), s = [m[kr], m[kb]], t = +b.dataset.t, n = +b.dataset.n;
  if (n > 0 && Math.max(s[0] ?? 0, s[1] ?? 0) >= SEASON.to) { toast(`Game is over at ${SEASON.to}. Fix it by typing the score.`); return; }
  setScore(t, Math.max(0, (s[t] ?? 0) + n));
});
[0,1].forEach(i => $("#s" + i).addEventListener("input", e => {
  const v = e.target.value.trim(); const n = v === "" ? null : Math.max(0, Math.min(40, parseInt(v, 10)));
  if (v !== "" && isNaN(n)) return;
  setScore(i, n);
}));
$("#ed-clear").onclick = () => {
  const m = findMatch(editing); if (!m) return;
  const [kr,kb] = curGame(); m[kr] = null; m[kb] = null; dirty = true; lastEdited = editing;
  $("#s0").value = ""; $("#s1").value = ""; render(); queueSave(); toast(`Game ${edGame+1} cleared`);
};
function setSave(txt, err){ const el = $("#ed-save"); el.textContent = txt; el.classList.toggle("err", !!err); }
function queueSave(){ setSave("Saving…"); clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 600); }
async function flushSave(){
  clearTimeout(saveTimer);
  const key = lastEdited; if (!key) return;
  const m = findMatch(key); if (!m || !sb) return;
  saving = true; dirty = false;
  const row = {g1r:m.g1r, g1b:m.g1b, g2r:m.g2r, g2b:m.g2b, updated_at:new Date().toISOString()};
  const {data, error} = await sb.from("matches").update(row).eq("season", SEASON.id).eq("week", m.week).eq("slot", m.slot).select("week");
  saving = false;
  // An update the database refuses can come back with no error and zero rows, so check both
  if (error || !data || data.length !== 1){
    dirty = true;
    setSave("Not saved. Check your signal, then tap a score again.", true);
    toast("Score NOT saved. Try again.");
    console.warn("save failed", error, data);
  } else if (!dirty) setSave("Saved ✓ · everyone sees it within 20 seconds");
}

/* ---------- dues ---------- */
async function togglePaid(id){
  if (!sb || !commish) return;
  const [team, player] = id.split("|"), was = DUES[id];
  if (was) delete DUES[id]; else DUES[id] = today();
  renderDues();
  const q = was
    ? sb.from("dues").delete().eq("season", SEASON.id).eq("team", team).eq("player", player).select("player")
    : sb.from("dues").insert({season:SEASON.id, team, player, paid_on:DUES[id]}).select("player");
  const {data, error} = await q;
  if (error || !data || data.length !== 1){
    if (was) DUES[id] = was; else delete DUES[id];
    renderDues(); toast("Didn't save. Try again."); console.warn(error, data);
  }
}
$("#unpaid-only").onclick = e => { const b = e.currentTarget, on = b.getAttribute("aria-pressed") !== "true";
  b.setAttribute("aria-pressed", on); b.textContent = on ? "Showing unpaid only" : "Show unpaid only"; renderDues(); };
$("#copy-unpaid").onclick = async () => {
  const names = sortedTeams().flatMap(k => players(k).filter(nm => realPlayer(nm) && !DUES[k + "|" + nm]).map(nm => `${nm} (${tn(k)})`));
  const txt = names.length ? `Still owe league dues ($${SEASON.dues}, pay at the bar):\n` + names.join("\n") : "Everyone has paid.";
  try { await navigator.clipboard.writeText(txt); toast(`Copied ${names.length} names. Paste into a text.`); }
  catch (e) { toast("Couldn't copy on this phone."); }
};

/* ---------- sign in / out ---------- */
$("#signin-link").onclick = () => { $("#si-err").hidden = true; openSheet("signin"); setTimeout(() => $("#si-email").focus(), 50); };
$("#signin-form").onsubmit = async e => {
  e.preventDefault();
  const go = $("#si-go"); go.disabled = true; go.textContent = "Signing in…";
  const {error} = await sb.auth.signInWithPassword({email: $("#si-email").value.trim(), password: $("#si-pass").value});
  go.disabled = false; go.textContent = "Sign in";
  if (error){ const er = $("#si-err"); er.hidden = false; er.textContent = "That email and password didn't match. Try again."; return; }
  $("#si-pass").value = ""; closeSheet($("#signin")); toast("Signed in. Tap any match to enter scores.");
};
$("#whoami").onclick = async () => { await sb.auth.signOut(); toast("Signed out"); };

/* ---------- loading ---------- */
async function loadAll(){
  if (!sb){ useSeed(); return; }
  try {
    const [t, m] = await Promise.all([
      sb.from("teams").select("*").eq("season", SEASON.id).order("sort"),
      sb.from("matches").select("*").eq("season", SEASON.id),
    ]);
    if (t.error || m.error) throw (t.error || m.error);
    if (!t.data.length) throw new Error("no teams in database");
    TEAMS = Object.fromEntries(t.data.map(x => [x.code, x]));
    MATCHES = m.data; source = "live"; lastLoad = Date.now();
    if (commish){
      const d = await sb.from("dues").select("*").eq("season", SEASON.id);
      if (!d.error) DUES = Object.fromEntries(d.data.map(x => [x.team + "|" + x.player, x.paid_on]));
    }
  } catch (e){
    console.warn("live load failed", e);
    if (source !== "live") useSeed();   // keep the last good live data if we had it
  }
}
async function refresh(){
  if (editing || saving) return;   // don't overwrite a score mid-entry
  if (dirty){ await flushSave(); if (dirty) return; }   // retry a save that failed earlier
  await loadAll(); render();
}

async function start(){
  useSeed();
  if (CFG.supabaseUrl && CFG.supabaseKey && window.supabase){
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {auth:{persistSession:true, autoRefreshToken:true}});
    const {data:{session}} = await sb.auth.getSession();
    commish = !!session;
    sb.auth.onAuthStateChange((_ev, s) => { const was = commish; commish = !!s; if (was !== commish){ DUES = {}; loadAll().then(render); } });
  }
  render();
  const h = location.hash.slice(1);
  if ($(`.tab[data-v="${h}"]`) && !$(`.tab[data-v="${h}"]`).hidden) showTab(h);
  if (sb){
    await loadAll(); render();
    setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 20000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
  }
}
start();

/* ---------- now and then a Bend weight slides up the board (decoration only) ---------- */
(function slider(){
  const zone = $(".zones");
  if (!zone || !zone.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const p = document.createElement("span");
  p.className = "bpuck slider"; p.setAttribute("aria-hidden", "true");
  p.innerHTML = '<i><img src="logo.png" alt=""></i>';
  zone.appendChild(p);
  // Lanes that miss the four resting weights: [left, resting top in px]
  const lanes = [["84%", 2], ["40%", 74], ["84%", 38]];
  let n = 0;
  async function shot(){
    if (document.visibilityState !== "visible"){ setTimeout(shot, 4000); return; }
    const [left, top] = lanes[n % lanes.length], red = n % 2 === 0;
    p.classList.toggle("red", red); p.classList.toggle("blue", !red);
    p.style.left = left; p.style.top = top + "px";
    const dist = zone.offsetHeight - top + 8, spin = (red ? 1 : -1) * (18 + Math.random() * 30);
    n++;
    p.getAnimations().forEach(a => a.cancel());
    try {
      await p.animate([
        {transform:`translateY(${dist}px) rotate(0deg)`, opacity:1},
        {transform:`translateY(0) rotate(${spin}deg)`, opacity:1}
      ], {duration:1800, easing:"cubic-bezier(.12,.8,.25,1)", fill:"forwards"}).finished;
      await p.animate([
        {transform:`rotate(${spin}deg)`, opacity:1},
        {transform:`rotate(${spin}deg)`, opacity:1, offset:.8},
        {transform:`rotate(${spin}deg)`, opacity:0}
      ], {duration:3400, fill:"forwards"}).finished;
    } catch (e) {}
    setTimeout(shot, 5000 + Math.random() * 4000);
  }
  setTimeout(shot, 2500);
})();
})();
