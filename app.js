(() => {
"use strict";
const CFG = window.LEAGUE_CONFIG || {};
const SEASON = window.SEASON;
const SLOTS = SEASON.slots;
const COMMISH = SEASON.commishNames || "a commissioner";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const I = {
  cal:'<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  chev:'<svg class="ico chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  trophy:'<svg class="ico" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5"/></svg>',
  edit:'<svg class="ico" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  star:'<svg class="ico" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  check:'<svg class="ico" viewBox="0 0 24 24" style="width:16px;height:16px;stroke-width:3"><path d="m5 12 5 5 9-10"/></svg>',
  open:'<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  copy:'<svg class="ico" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
};

/* ---------- state ---------- */
let TEAMS = {}, MATCHES = [], DUES = {}, CHAMPS = [];
let sb = null, commish = false, source = "seed";
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
const dObj = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
function weekDate(n){ const [y,m,d] = SEASON.start.split("-").map(Number); return new Date(y, m-1, d + 7*(n-1)); }
const fmtShort = d => d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtLong  = d => d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
const fmtDay   = d => d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const today = () => ymd(new Date());
const WEEKS = [...Array(SEASON.weeks)].map((_,i) => i+1);
const WEEK_DATES = WEEKS.map(n => ymd(weekDate(n)));
const weekOf = d => WEEK_DATES.indexOf(d) + 1;   // 0 = not a regular league night

/* ---------- game logic ---------- */
const games = m => [[m.g1r,m.g1b],[m.g2r,m.g2b]];
const entered = g => g[0] != null || g[1] != null;
const done = g => g[0] != null && g[1] != null && g[0] !== g[1] && Math.max(g[0],g[1]) >= SEASON.to;
function mState(m){ const [a,b] = games(m); if (done(a) && done(b)) return "final"; if (entered(a) || entered(b)) return "partial"; return "open"; }
function wins(m){ let r=0,b=0; games(m).forEach(g => { if (done(g)) g[0] > g[1] ? r++ : b++; }); return [r,b]; }
const tn = c => (TEAMS[c] && TEAMS[c].name) || c;
const weekMatches = n => MATCHES.filter(m => m.week === n).sort((a,b) => a.slot - b.slot);
const isMine = m => MY && (m.red === MY || m.blue === MY);
function summary(m){
  const [r,b] = wins(m);
  if (r === b) return "Split 1–1";
  return `${esc(tn(r > b ? m.red : m.blue))} ${Math.max(r,b) === 2 ? "sweep 2–0" : "win"}`;
}

/* ---------- when each match is actually played (cancellations + moves) ---------- */
const isPost = m => m.status === "postponed";
const homeDate = m => WEEK_DATES[m.week - 1];
const effDate = m => isPost(m) ? null : (m.play_date || homeDate(m));
const effSlot = m => m.play_slot ?? m.slot;
const isMoved = m => !isPost(m) && (effDate(m) !== homeDate(m) || effSlot(m) !== m.slot);
const keyOf = m => `${m.week}-${m.slot}`;
const matchesOn = d => MATCHES.filter(m => effDate(m) === d).sort((a,b) => effSlot(a) - effSlot(b));
const nights = () => [...new Set([...WEEK_DATES, ...MATCHES.map(effDate).filter(Boolean)])].sort();
const isNight = d => !!weekOf(d) || matchesOn(d).length > 0;
const openSlots = d => (weekOf(d) && d >= today()) ? SLOTS.map((_,s) => s).filter(s => !matchesOn(d).some(m => effSlot(m) === s)) : [];
const isOwed = m => mState(m) !== "final" && (isPost(m) || effDate(m) < today());
const vsText = m => `${tn(m.red)} vs ${tn(m.blue)}`;
function nightItems(d){
  const items = [...matchesOn(d).map(m => ({s:effSlot(m), m})), ...openSlots(d).map(s => ({s, open:true}))];
  return items.sort((a,b) => a.s - b.s);
}
const nightTitle = d => (weekOf(d) ? `Week ${weekOf(d)}` : "Make-up night") + " · " + fmtLong(dObj(d));
function moveNote(m){
  if (isPost(m)) return "Canceled · needs a new date";
  if (effDate(m) !== homeDate(m)) return `Week ${m.week} make-up`;
  if (effSlot(m) !== m.slot) return `Moved from ${SLOTS[m.slot]}`;
  return "";
}

/* ---------- match card ---------- */
function statusPill(m, opts = {}){
  const st = mState(m), d = effDate(m), t = today();
  if (st === "final") return '<span class="pill">Final</span>';
  if (isPost(m)) return '<span class="pill owed">Needs a date</span>';
  if (st === "partial" && d === t) return '<span class="pill live">● Live</span>';
  if (d < t) return '<span class="pill owed">Make-up</span>';
  if (opts.upNext) return '<span class="pill next">Up next</span>';
  if (isMoved(m)) return '<span class="pill next">Moved</span>';
  return "";
}
function matchCard(m, opts = {}){
  const st = mState(m), [r,b] = wins(m), gs = games(m);
  const cell = (g,i) => g[i] != null ? `<span class="g ${done(g) && g[i] > g[1-i] ? "w" : ""}">${g[i]}</span>` : '<span class="g empty">–</span>';
  const row = (i,cls) => `<div class="cols trow ${st === "final" && ((i === 0 && r > b) || (i === 1 && b > r)) ? "won" : ""}"><span class="puck ${cls}"></span><span class="tname">${esc(tn(i ? m.blue : m.red))}</span>${cell(gs[0],i)}${cell(gs[1],i)}</div>`;
  const note = moveNote(m);
  let foot = "";
  if (st === "final") foot = `<div class="m-foot"><span>${summary(m)}</span>${isMine(m) ? '<span class="tag">Your team</span>' : note ? `<span>${esc(note)}</span>` : ""}</div>`;
  else if (note) foot = `<div class="m-foot"><span>${esc(note)}</span>${isMine(m) ? '<span class="tag">Your team</span>' : ""}</div>`;
  if (commish) foot += `<div class="btns"><button class="btn block" data-edit="${keyOf(m)}">${I.edit} ${st === "open" ? "Enter score / change time" : "Edit score / time"}</button></div>`;
  const label = opts.label || (isPost(m) ? `Week ${m.week} · was ${SLOTS[m.slot]}` : `${SLOTS[effSlot(m)]} PM`);
  return `<div class="card match ${isMine(m) ? "mine" : ""}">
    <div class="m-head"><span class="time">${label}</span>${statusPill(m, opts)}</div>
    <div class="cols hdr"><span></span><span></span><span>G1</span><span>G2</span></div>
    ${row(0,"red")}${row(1,"blue")}${foot}</div>`;
}
function openCard(d, s){
  let h = `<div class="card match openslot"><div class="m-head"><span class="time">${SLOTS[s]} PM</span><span class="pill openp">Open slot</span></div>
    <div class="note">${I.open}<span>This time is open. <b>Want to play earlier?</b> Text ${esc(COMMISH)} to grab it.</span></div>`;
  if (commish) h += `<div class="btns"><button class="btn sm" data-fill="${d}|${s}">Move a match here</button><button class="btn sm" data-copyopen="${d}|${s}">${I.copy} Copy group text</button></div>`;
  return h + "</div>";
}
function srow(m, opts = {}){
  const st = mState(m), [r,b] = wins(m), gs = games(m), t = today(), d = effDate(m);
  const here = opts.night || (!isPost(m) && d === homeDate(m));
  const gtxt = g => entered(g) ? `${g[0] ?? 0}-${g[1] ?? 0}` : "";
  let res = "";
  if (st === "final") res = `<b>${r}–${b}</b> · ${gtxt(gs[0])}, ${gtxt(gs[1])}`;
  else if (st === "partial") res = (d === t ? '<span class="live">LIVE</span> · ' : "make-up · ") + [gtxt(gs[0]), gtxt(gs[1])].filter(Boolean).join(", ");
  else if (isPost(m)) res = "canceled · needs a date";
  else if (!here) res = `→ ${fmtShort(dObj(d))} · ${SLOTS[effSlot(m)]}`;
  else if (d < t) res = "make-up";
  else if (d !== homeDate(m)) res = `Wk ${m.week} make-up`;
  else if (effSlot(m) !== m.slot) res = `moved from ${SLOTS[m.slot]}`;
  const time = here ? SLOTS[effSlot(m)] : SLOTS[m.slot];
  const inner = `<span class="t">${time}</span><span>${esc(tn(m.red))} <span class="vs">vs</span> ${esc(tn(m.blue))}</span><span class="res">${res}</span>`;
  return commish && !opts.view
    ? `<button class="srow ${isMine(m) ? "mine" : ""}" data-edit="${keyOf(m)}">${inner}</button>`
    : `<div class="srow ${isMine(m) ? "mine" : ""}">${inner}</div>`;
}
function srowOpen(d, s, opts = {}){
  const inner = `<span class="t">${SLOTS[s]}</span><span class="openlbl">Open slot</span><span class="res">${commish && !opts.view ? "tap to fill" : ""}</span>`;
  return commish && !opts.view ? `<button class="srow openrow" data-fill="${d}|${s}">${inner}</button>` : `<div class="srow openrow">${inner}</div>`;
}

/* ---------- views ---------- */
function renderTonight(){
  const t = today(), ns = nights();
  const nextD = ns.find(d => d > t && isNight(d));
  const lastD = [...WEEK_DATES].reverse().find(d => d < t);
  let h = "";
  if (isNight(t)){
    const items = nightItems(t), up = items.findIndex(x => x.m && mState(x.m) === "open");
    const n = items.filter(x => x.m).length;
    h += `<div class="eyebrow">Tonight</div><div class="h1">${nightTitle(t)}</div>
      <div class="h1-sub">${n} match${n === 1 ? "" : "es"} · 1 table · first puck ${SLOTS[items.length ? items[0].s : 0]}</div>`;
    h += items.map((x,i) => x.m ? matchCard(x.m, {upNext: i === up}) : openCard(t, x.s)).join("");
    if (nextD) h += `<div class="eyebrow gap">Next up · ${esc(nightTitle(nextD))}</div><div class="card" style="overflow:hidden">${nightItems(nextD).map(x => x.m ? srow(x.m, {view:true, night:true}) : srowOpen(nextD, x.s, {view:true})).join("")}</div>`;
  } else if (nextD){
    const items = nightItems(nextD), n = items.filter(x => x.m).length;
    h += `<div class="eyebrow">Next league night</div><div class="h1">${nightTitle(nextD)}</div>
      <div class="h1-sub">${n} match${n === 1 ? "" : "es"} · 1 table · first puck ${SLOTS[items.length ? items[0].s : 0]}</div>`;
    h += items.map(x => x.m ? matchCard(x.m) : openCard(nextD, x.s)).join("");
    if (lastD){
      const ms = matchesOn(lastD);
      if (ms.length) h += `<div class="eyebrow gap">Last week · Week ${weekOf(lastD)} results</div>` + ms.map(m => matchCard(m)).join("");
    }
  } else {
    h += `<div class="eyebrow">${esc(SEASON.label)}</div><div class="h1">Regular season is done</div>
      <div class="h1-sub">Make-ups ${esc(SEASON.makeup)} · Tournament ${esc(SEASON.tournament)}</div>`;
  }
  const board = MATCHES.filter(m => mState(m) !== "final" && effDate(m) !== t && effDate(m) !== nextD
      && (isPost(m) || effDate(m) < t || !weekOf(effDate(m))))
    .sort((a,b) => (effDate(a) || "9") < (effDate(b) || "9") ? -1 : 1);
  if (board.length){
    h += `<div class="eyebrow gap">Make-up board · ${board.length} owed</div>`;
    h += board.map(m => matchCard(m, {label: isPost(m) || effDate(m) < t ? `Week ${m.week} · ${SLOTS[m.slot]}` : `${fmtDay(dObj(effDate(m)))} · ${SLOTS[effSlot(m)]}`})).join("");
    h += `<div class="card pad note">${I.cal}<span>Make-up window: <b>${esc(SEASON.makeup)}</b>. When a team cancels, its time slot shows as <b>Open</b> so another team can move up.</span></div>`;
  }
  h += `<div class="card milestone">${I.trophy}<div><div class="wk">Season-Ending Tournament</div><div class="sub">${esc(SEASON.tournament)} · bracket after the make-up window</div></div></div>`;
  $("#v-tonight").innerHTML = h;
}

function standingsTable(){
  const S = {}; Object.keys(TEAMS).forEach(k => S[k] = {w:0,l:0,pf:0,pa:0});
  MATCHES.forEach(m => games(m).forEach(g => {
    if (!done(g) || !S[m.red] || !S[m.blue]) return;
    S[m.red].pf += g[0]; S[m.red].pa += g[1]; S[m.blue].pf += g[1]; S[m.blue].pa += g[0];
    if (g[0] > g[1]) { S[m.red].w++; S[m.blue].l++; } else { S[m.blue].w++; S[m.red].l++; }
  }));
  // Win % (not raw wins) so a team owed a make-up isn't pushed down; same thing once every game is in
  const pct = k => S[k].w + S[k].l ? S[k].w / (S[k].w + S[k].l) : 0;
  const order = Object.keys(S).sort((a,b) => pct(b) - pct(a) || (S[b].pf - S[b].pa) - (S[a].pf - S[a].pa) || tn(a).localeCompare(tn(b)));
  return {S, order};
}
function renderStandings(){
  const {S, order} = standingsTable();
  const t = today(), thru = [...WEEKS].reverse().find(n => WEEK_DATES[n-1] < t), tonight = weekOf(t);
  $("#stand-title").textContent = thru ? `Through Week ${thru}` : "Preseason";
  $("#stand-sub").textContent = "Ranked by win % · ties broken by point differential" + (tonight ? ` · Week ${tonight} games count as soon as they finish` : "");
  const owed = MATCHES.filter(isOwed).sort((a,b) => a.week - b.week || a.slot - b.slot);
  if (owed.length){
    const list = owed.map(m => `${esc(vsText(m))} (Week ${m.week})`);
    $("#pending-note").innerHTML = `<b>Not counted yet:</b> ${list.length > 1 ? list.slice(0,-1).join(", ") + " and " + list[list.length-1] : list[0]}.`;
    $("#pending-card").hidden = false;
  } else $("#pending-card").hidden = true;
  $("#stand-body").innerHTML = order.map((k,i) => { const s = S[k], d = s.pf - s.pa;
    return `<tr class="${k === MY ? "me" : ""}"><td>${i+1}</td><td>${esc(tn(k))}</td><td class="wl">${s.w}–${s.l}</td><td>${s.pf}</td><td>${s.pa}</td><td class="${d > 0 ? "pos" : d < 0 ? "neg" : ""}">${d > 0 ? "+" : ""}${d}</td></tr>`; }).join("");
}

function renderSchedule(){
  const t = today();
  $("#sched-title").textContent = `${SEASON.weeks} weeks · ${fmtShort(weekDate(1))} – ${fmtShort(weekDate(SEASON.weeks))}`;
  const openKeys = $$("#sched-list details[open]").map(d => d.dataset.w);
  const firstRender = !$("#sched-list").children.length;
  const tonight = weekOf(t), next = WEEKS.find(n => WEEK_DATES[n-1] > t);
  let h = "";
  for (const n of WEEKS){
    const d = WEEK_DATES[n-1];
    const here = nightItems(d).map(x => x.m ? srow(x.m, {night:true}) : srowOpen(d, x.s)).join("");
    const away = weekMatches(n).filter(m => effDate(m) !== d).map(m => srow(m)).join("");
    const owed = weekMatches(n).filter(m => mState(m) !== "final").length;
    const st = d < t ? (owed ? `<span class="pill owed">${owed} owed</span>` : '<span class="pill">Final</span>')
             : d === t ? '<span class="pill live">Tonight</span>' : '<span class="pill next">Upcoming</span>';
    const open = firstRender ? (n === tonight || n === next) : openKeys.includes(String(n));
    h += `<details class="card week" data-w="${n}" ${open ? "open" : ""}><summary><span class="wk">Week ${n}<small>Tue ${fmtShort(weekDate(n))}</small></span><span style="display:flex;gap:8px;align-items:center">${st}${I.chev}</span></summary>${here}${away}</details>`;
  }
  for (const d of nights().filter(d => !weekOf(d))){
    const open = firstRender ? true : openKeys.includes(d);
    h += `<details class="card week" data-w="${d}" ${open ? "open" : ""}><summary><span class="wk">Make-up night<small>${fmtDay(dObj(d))}</small></span><span style="display:flex;gap:8px;align-items:center">${d < t ? "" : d === t ? '<span class="pill live">Tonight</span>' : '<span class="pill next">Upcoming</span>'}${I.chev}</span></summary>${matchesOn(d).map(m => srow(m, {night:true})).join("")}</details>`;
  }
  const unsched = MATCHES.filter(m => isPost(m) && mState(m) !== "final");
  if (unsched.length) h += `<div class="card pad note">${I.cal}<span><b>Needs a make-up date:</b> ${unsched.map(m => esc(vsText(m)) + ` (Week ${m.week})`).join(", ")}.</span></div>`;
  h += `<div class="card milestone">${I.cal}<div><div class="wk">Make-up window</div><div class="sub">${esc(SEASON.makeup)}</div></div></div>
    <div class="card milestone">${I.trophy}<div><div class="wk">Season-Ending Tournament</div><div class="sub">${esc(SEASON.tournament)}</div></div></div>`;
  $("#sched-list").innerHTML = h;
}

const players = k => String((TEAMS[k] && TEAMS[k].players) || "").split(" & ").map(s => s.trim()).filter(Boolean);
const realPlayer = nm => !/TBD/i.test(nm);
function sortedTeams(){ return Object.keys(TEAMS).sort((a,b) => tn(a).localeCompare(tn(b))); }
function renderTeams(){
  const ks = sortedTeams();
  const count = ks.reduce((n,k) => n + players(k).filter(realPlayer).length, 0);
  $("#teams-title").textContent = `${ks.length} teams · ${count} players`;
  $("#team-list").innerHTML = ks.map(k => `<div class="card team ${k === MY ? "mine" : ""}"><div class="team-row">
    <div style="min-width:0"><h3>${esc(tn(k))}</h3><p>${esc(TEAMS[k].players)}</p></div>
    <div class="team-btns">
      <button class="btn sm" data-my="${esc(k)}" aria-pressed="${k === MY}">${I.star} ${k === MY ? "My team" : "My team?"}</button>
      ${commish ? `<button class="btn sm" data-teamedit="${esc(k)}">${I.edit} Edit</button>` : ""}
    </div>
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

/* ---------- trophy tab: tournament bracket + trophy case ---------- */
// Play-in bracket: seeds 7–10 play in, then a normal 8-team bracket. #1 and #2 are in opposite halves.
const BR = { p1:[8,9], p2:[7,10], q1:[1,"p1"], q2:[4,5], q3:[3,6], q4:[2,"p2"], s1:["q1","q2"], s2:["q3","q4"], f:["s1","s2"] };
const BR_COLS = [["Play-in",["p1",null,null,"p2"]], ["Quarterfinals",["q1","q2","q3","q4"]], ["Semifinals",["s1","s2"]], ["Final",["f"]], ["Champion",["champ"]]];
const BR_LINKS = [["p1","q1",1],["p2","q4",1],["q1","s1",0],["q2","s1",1],["q3","s2",0],["q4","s2",1],["s1","f",0],["s2","f",1],["f","champ",-1]];
const BR_TBD = {p1:"8/9 winner", p2:"7/10 winner", q1:"QF 1 winner", q2:"QF 2 winner", q3:"QF 3 winner", q4:"QF 4 winner", s1:"Semi 1 winner", s2:"Semi 2 winner"};
let PICKS = {};   // preview only, not saved
function brSide(x, seeds){
  if (typeof x === "number") return {code:seeds[x-1], seed:x};
  const w = PICKS[x]; return w ? {code:w, seed:seeds.indexOf(w) + 1} : {tbd:BR_TBD[x]};
}
function brBox(id, seeds){
  if (!id) return '<div class="bbox ghost"><div class="bl"></div><div class="bl"></div></div>';
  if (id === "champ"){
    const w = PICKS.f;
    return `<div class="bbox champbox" id="bx-champ">${I.trophy}<span>${w ? esc(tn(w)) : "Champion"}</span></div>`;
  }
  const w = PICKS[id];
  const line = s => s.tbd ? `<div class="bl tbd">${esc(s.tbd)}</div>`
    : `<button class="bl ${w === s.code ? "win" : w ? "lose" : ""}" data-pick="${id}|${esc(s.code)}"><span class="sd">${s.seed}</span><span class="bn">${esc(tn(s.code))}</span>${w === s.code ? I.check : ""}</button>`;
  return `<div class="bbox" id="bx-${id}">${BR[id].map(x => line(brSide(x, seeds))).join("")}</div>`;
}
function clearDown(id){ for (const [k, v] of Object.entries(BR)) if (v.includes(id) && PICKS[k]){ delete PICKS[k]; clearDown(k); } }
function drawLinks(){
  const br = $("#bracket"); if (!br || !br.offsetParent) return;
  const svg = br.querySelector("svg.links"), base = br.getBoundingClientRect();
  svg.setAttribute("width", br.scrollWidth); svg.setAttribute("height", br.scrollHeight);
  svg.innerHTML = BR_LINKS.map(([a, b, line]) => {
    const A = $("#bx-" + a), B = $("#bx-" + b); if (!A || !B) return "";
    const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    const x1 = ra.right - base.left, y1 = ra.top + ra.height/2 - base.top, x2 = rb.left - base.left;
    const y2 = line < 0 ? rb.top + rb.height/2 - base.top : rb.top - base.top + rb.height * (line ? .75 : .25);
    const mx = x1 + (x2 - x1) / 2;
    return `<path class="${PICKS[a] ? "on" : ""}" d="M${x1} ${y1}H${mx}V${y2}H${x2}"/>`;
  }).join("");
}
function renderTrophy(){
  if (!commish) return;
  const {order} = standingsTable(), seeds = order;
  const keepScroll = $(".bracket-wrap") ? $(".bracket-wrap").scrollLeft : 0;
  let h = `<div class="eyebrow">Commissioners only · preview</div>
    <div class="h1">Tournament · ${esc(SEASON.tournament)}</div>
    <div class="h1-sub">One game to ${SEASON.to} · winner advances · seeds 7–10 play in</div>
    <div class="card pad note" style="margin-bottom:10px">${I.trophy}<span><b>Only you and Rod can see this tab.</b> Seeds are today's standings. Tap a team to send them on and test it out. Nothing here is saved.</span></div>
    <div class="card bcard"><div class="bracket-wrap"><div class="bracket" id="bracket">`;
  h += BR_COLS.map(([name, ids]) => `<div class="round ${ids[0] === "champ" ? "champ-col" : ""}"><div class="rh">${name}</div><div class="rcol">${ids.map(id => brBox(id, seeds)).join("")}</div></div>`).join("");
  h += `<svg class="links" aria-hidden="true"></svg></div></div>
    <div class="bfoot"><span>Swipe sideways for the whole bracket →</span><button class="btn sm ghost" id="br-reset">Reset</button></div></div>`;
  // Trophy case
  const leader = order[0];
  h += `<div class="eyebrow gap">Trophy case</div>
    <div class="card pad champ-season"><div class="cs-head"><span class="wk">${esc(SEASON.label)}</span><span class="pill next">This season</span></div>
      <div class="cs-row"><span class="cs-title">League champion</span><span class="cs-team">${leader ? `${esc(tn(leader))} <span class="sub">(leading now)</span>` : "TBD"}</span></div>
      <div class="cs-row"><span class="cs-title">Tournament champion</span><span class="cs-team"><span class="sub">${esc(SEASON.tournament)}</span></span></div>
    </div>`;
  const groups = [];
  CHAMPS.forEach(c => { let g = groups.find(x => x.label === c.season_label); if (!g) groups.push(g = {label:c.season_label, rows:[]}); g.rows.push(c); });
  h += groups.map(g => `<div class="card pad champ-season"><div class="cs-head"><span class="wk">${esc(g.label)}</span></div>
    ${g.rows.map(c => `<button class="cs-row" data-champ="${c.id}"><span class="cs-title">${esc(c.title)}</span><span class="cs-team">${esc(c.team)}${c.players ? `<span class="sub">${esc(c.players)}</span>` : ""}</span></button>`).join("")}</div>`).join("");
  if (!groups.length) h += `<div class="card pad note">${I.star}<span>No past champions yet. Add Seasons 1 and 2 so they're remembered here.</span></div>`;
  h += `<button class="btn block" id="champ-add">${I.trophy} Add a champion</button>`;
  $("#v-trophy").innerHTML = h;
  $(".bracket-wrap").scrollLeft = keepScroll;
  $("#br-reset").onclick = () => { PICKS = {}; renderTrophy(); };
  $("#champ-add").onclick = () => openChampEd(null);
  requestAnimationFrame(drawLinks);
}

function render(){
  $("#hero-sub").textContent = `Tuesdays at The Parlour House · ${SEASON.label}`;
  renderTonight(); renderStandings(); renderSchedule(); renderTeams(); renderDues(); renderTrophy();
  $("#whoami").hidden = !commish;
  $("#signin-link").hidden = !sb || commish;
  $('.tab[data-v="dues"]').hidden = !commish;
  $('.tab[data-v="trophy"]').hidden = !commish;
  if (!commish && ($("#v-dues").classList.contains("on") || $("#v-trophy").classList.contains("on"))) showTab("tonight");
  const stale = $("#stale");
  if (sb && source === "seed"){ stale.hidden = false; stale.textContent = "Couldn't reach live scores. Showing saved results."; }
  else stale.hidden = true;
  if (editing) drawEditor();
}

/* ---------- tabs (also #standings etc. so a QR code can open a tab) ---------- */
function showTab(name){
  $$(".tab").forEach(x => x.classList.toggle("on", x.dataset.v === name));
  $$(".view").forEach(v => v.classList.toggle("on", v.id === "v-" + name));
  if (name === "trophy") requestAnimationFrame(drawLinks);
}
$$(".tab").forEach(t => t.onclick = () => { showTab(t.dataset.v); history.replaceState(null, "", "#" + t.dataset.v); window.scrollTo({top:0}); });
window.addEventListener("resize", () => requestAnimationFrame(drawLinks));
if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(drawLinks));

/* ---------- toasts + sheets ---------- */
let tt; function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2800); }
function openSheet(id){ $("#" + id).classList.add("on"); }
function closeSheet(el){ el.classList.remove("on"); if (el.id === "edit") closeEditor(); }
async function copyText(txt, okMsg){
  try { await navigator.clipboard.writeText(txt); toast(okMsg); } catch (e) { toast("Couldn't copy on this phone."); }
}

document.addEventListener("click", e => {
  const ed = e.target.closest("[data-edit]"); if (ed && commish){ openEditor(ed.dataset.edit); return; }
  const fl = e.target.closest("[data-fill]"); if (fl && commish){ const [d, s] = fl.dataset.fill.split("|"); openFill(d, +s); return; }
  const co = e.target.closest("[data-copyopen]"); if (co){ const [d, s] = co.dataset.copyopen.split("|");
    copyText(`Open slot at The Bend: ${fmtLong(dObj(d))} at ${SLOTS[+s]} PM. Want to play earlier? First team to text ${COMMISH} gets it.`, "Copied. Paste it into the group text."); return; }
  const mv = e.target.closest("[data-moveto]"); if (mv && commish){ fillWith(mv.dataset.moveto); return; }
  const te = e.target.closest("[data-teamedit]"); if (te && commish){ openTeamEd(te.dataset.teamedit); return; }
  const ch = e.target.closest("[data-champ]"); if (ch && commish){ openChampEd(+ch.dataset.champ); return; }
  const pk = e.target.closest("[data-pick]"); if (pk){ const [id, code] = pk.dataset.pick.split("|");
    if (PICKS[id] === code) delete PICKS[id]; else PICKS[id] = code;
    clearDown(id); renderTrophy(); return; }
  const my = e.target.closest("[data-my]"); if (my){
    MY = MY === my.dataset.my ? null : my.dataset.my;
    try { MY ? localStorage.setItem(MY_KEY, MY) : localStorage.removeItem(MY_KEY); } catch (err) {}
    render(); toast(MY ? `${tn(MY)} will be highlighted on this phone` : "Highlight removed"); return; }
  const p = e.target.closest("[data-pay]"); if (p && !p.disabled){ togglePaid(p.dataset.pay); return; }
  const c = e.target.closest("[data-close]"); if (c){ closeSheet(c.closest(".scrim")); return; }
  if (e.target.classList.contains("scrim")){ closeSheet(e.target); return; }
});

/* ---------- saving a match's time/status ---------- */
async function saveFields(m, f){
  if (!sb){ toast("Not connected. Try again."); return false; }
  const before = {}; Object.keys(f).forEach(k => before[k] = m[k]);
  Object.assign(m, f); render();
  const {data, error} = await sb.from("matches").update({...f, updated_at:new Date().toISOString()})
    .eq("season", SEASON.id).eq("week", m.week).eq("slot", m.slot).select("week");
  // An update the database refuses can come back with no error and zero rows, so check both
  if (error || !data || data.length !== 1){
    Object.assign(m, before); render(); toast("Didn't save. Try again."); console.warn("save failed", error, data); return false;
  }
  return true;
}
const takenBy = (m, d, s) => MATCHES.find(x => x !== m && effDate(x) === d && effSlot(x) === s);

/* ---------- score + time editor ---------- */
let editing = null, edGame = 0, saveTimer = null, saving = false, dirty = false, lastEdited = null, cancelArm = 0;
const findMatch = key => { const [w,s] = key.split("-").map(Number); return MATCHES.find(m => m.week === w && m.slot === s); };
function openEditor(key){
  const m = findMatch(key); if (!m) return;
  if (dirty) flushSave();
  editing = key; cancelArm = 0;
  const gs = games(m);
  edGame = done(gs[0]) && !done(gs[1]) ? 1 : 0;
  $("#ed-sub").textContent = `${vsText(m)} · first to ${SEASON.to}. Changes save automatically.`;
  $("#ed-n0").textContent = tn(m.red); $("#ed-n1").textContent = tn(m.blue);
  $("#ed-movebox").hidden = true;
  setSave("");
  drawEditor(); openSheet("edit");
}
function closeEditor(){ if (dirty) flushSave(); editing = null; }
function curGame(){ return edGame ? ["g2r","g2b"] : ["g1r","g1b"]; }
function drawEditor(){
  const m = findMatch(editing); if (!m) return;
  $("#ed-title").textContent = isPost(m) ? `Week ${m.week} · canceled` : `${fmtDay(dObj(effDate(m)))} · ${SLOTS[effSlot(m)]} PM`;
  const [kr,kb] = curGame(), s = [m[kr], m[kb]];
  [0,1].forEach(i => { const inp = $("#s" + i); if (document.activeElement !== inp) inp.value = s[i] ?? ""; });
  $("#side-0").classList.toggle("lead", (s[0] ?? 0) > (s[1] ?? 0));
  $("#side-1").classList.toggle("lead", (s[1] ?? 0) > (s[0] ?? 0));
  $$("#edit .seg button").forEach(b => b.classList.toggle("on", +b.dataset.g === edGame));
  const bn = $("#ed-banner"), gs = games(m);
  if (done(gs[0]) && done(gs[1])){ bn.hidden = false; bn.textContent = `Match final: ${summary(m).replace(/&amp;/g,"&")}. Standings are updated.`; }
  else if (done(s)){ bn.hidden = false; bn.textContent = `Game ${edGame+1} final: ${tn(s[0] > s[1] ? m.red : m.blue)} win ${Math.max(...s)}–${Math.min(...s)}.` + (edGame === 0 ? " Tap Game 2 when it starts." : ""); }
  else bn.hidden = true;
  // time slot section
  const note = moveNote(m);
  $("#ed-when").innerHTML = isPost(m) ? "<b>Canceled</b> · needs a new date"
    : `<b>${esc(fmtDay(dObj(effDate(m))))} · ${SLOTS[effSlot(m)]} PM</b>${note ? ` · ${esc(note)}` : ""}`;
  $("#ed-cancel").hidden = isPost(m) || mState(m) === "final";
  $("#ed-restore").hidden = !(isPost(m) || isMoved(m));
  if (Date.now() - cancelArm > 4000) $("#ed-cancel").textContent = "Cancel & open this slot";
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
  if (error || !data || data.length !== 1){
    dirty = true;
    setSave("Not saved. Check your signal, then tap a score again.", true);
    toast("Score NOT saved. Try again.");
    console.warn("save failed", error, data);
  } else if (!dirty) setSave("Saved ✓ · everyone sees it within 20 seconds");
}
// cancel / move / restore
$("#mv-slot").innerHTML = SLOTS.map((t,i) => `<option value="${i}">${t} PM</option>`).join("");
$("#ed-cancel").onclick = async () => {
  const m = findMatch(editing); if (!m) return;
  const b = $("#ed-cancel");
  if (Date.now() - cancelArm > 4000){ cancelArm = Date.now(); b.textContent = "Tap again to confirm"; setTimeout(drawEditor, 4100); return; }
  cancelArm = 0;
  const was = `${SLOTS[effSlot(m)]} PM`;
  if (await saveFields(m, {status:"postponed", play_date:null, play_slot:null})) toast(`Canceled. The ${was} slot now shows as Open.`);
};
$("#ed-move").onclick = () => {
  const m = findMatch(editing); if (!m) return;
  const box = $("#ed-movebox"); box.hidden = !box.hidden;
  $("#mv-date").value = effDate(m) || (today() > homeDate(m) ? today() : homeDate(m));
  $("#mv-slot").value = String(effSlot(m));
};
$("#mv-save").onclick = async () => {
  const m = findMatch(editing); if (!m) return;
  const d = $("#mv-date").value, s = +$("#mv-slot").value;
  if (!/^\d{4}-\d\d-\d\d$/.test(d)){ toast("Pick a date first."); return; }
  const x = takenBy(m, d, s);
  if (x){ toast(`${SLOTS[s]} on ${fmtShort(dObj(d))} is taken by ${vsText(x)}.`); return; }
  if (await saveFields(m, {status:null, play_date:d, play_slot:s})){ $("#ed-movebox").hidden = true; toast(`Moved to ${fmtDay(dObj(d))} at ${SLOTS[s]} PM`); }
};
$("#ed-restore").onclick = async () => {
  const m = findMatch(editing); if (!m) return;
  const x = takenBy(m, homeDate(m), m.slot);
  if (x){ toast(`Its original time is now taken by ${vsText(x)}. Use “Move to another time.”`); return; }
  if (await saveFields(m, {status:null, play_date:null, play_slot:null})) toast("Back at its original time");
};

/* ---------- fill an open slot ---------- */
let FILL = null;
function openFill(d, s){
  FILL = {d, s};
  const later = matchesOn(d).filter(m => effSlot(m) > s && mState(m) !== "final");
  const owed = MATCHES.filter(m => isOwed(m) && !later.includes(m));
  const btn = (m, where) => `<button class="pickrow" data-moveto="${keyOf(m)}"><span class="pr-when">${esc(where)}</span><span>${esc(vsText(m))}</span></button>`;
  $("#fill-title").textContent = `Fill ${SLOTS[s]} PM · ${fmtDay(dObj(d))}`;
  $("#fill-list").innerHTML =
    (later.length ? `<div class="eyebrow light">${d === today() ? "Later tonight" : "Later that night"}: move up</div>` + later.map(m => btn(m, `${SLOTS[effSlot(m)]} PM`)).join("") : "")
    + (owed.length ? `<div class="eyebrow light">Owed make-ups</div>` + owed.map(m => btn(m, `Week ${m.week}`)).join("") : "")
    || '<div class="sub">No matches are waiting to move in.</div>';
  openSheet("fill");
}
async function fillWith(key){
  const m = findMatch(key); if (!m || !FILL) return;
  const {d, s} = FILL, from = effDate(m) === d ? `${SLOTS[effSlot(m)]}` : "";
  if (await saveFields(m, {status:null, play_date:d, play_slot:s})){
    closeSheet($("#fill"));
    toast(`${vsText(m)} moved to ${SLOTS[s]} PM.` + (from ? ` ${from} is open now.` : ""));
  }
}

/* ---------- edit team + player names ---------- */
let TEAM_ED = null;
function openTeamEd(code){
  TEAM_ED = code; const ps = players(code);
  $("#te-name").value = tn(code); $("#te-p1").value = ps[0] || ""; $("#te-p2").value = ps[1] || "";
  $("#te-err").hidden = true; openSheet("team-ed");
}
$("#team-form").onsubmit = async e => {
  e.preventDefault();
  const code = TEAM_ED, old = players(code), err = $("#te-err");
  const name = $("#te-name").value.trim(), np = [$("#te-p1").value.trim(), $("#te-p2").value.trim()];
  if (!name){ err.hidden = false; err.textContent = "Team name can't be blank."; return; }
  if (np.some(p => p.includes("&"))){ err.hidden = false; err.textContent = "Use “and” instead of “&” inside a player's name."; return; }
  const go = $("#te-save"); go.disabled = true;
  const {data, error} = await sb.from("teams").update({name, players: np.filter(Boolean).join(" & ")}).eq("season", SEASON.id).eq("code", code).select("code");
  go.disabled = false;
  if (error || !data || data.length !== 1){ err.hidden = false; err.textContent = "Didn't save. Try again."; console.warn(error, data); return; }
  // keep dues check-marks attached to a renamed player
  for (let i = 0; i < 2; i++){
    if (old[i] && np[i] && old[i] !== np[i] && DUES[code + "|" + old[i]])
      await sb.from("dues").update({player:np[i]}).eq("season", SEASON.id).eq("team", code).eq("player", old[i]);
  }
  closeSheet($("#team-ed")); toast("Saved. The new names show everywhere.");
  await loadAll(); render();
};

/* ---------- trophy case editor ---------- */
let CH_ED = null, delArm = 0;
function openChampEd(id){
  CH_ED = id ? CHAMPS.find(c => c.id === id) : null; delArm = 0;
  $("#ce-head").textContent = CH_ED ? "Edit champion" : "Add a champion";
  $("#ce-season").value = CH_ED ? CH_ED.season_label : "";
  $("#ce-title").value = CH_ED ? CH_ED.title : "League Champion";
  $("#ce-team").value = CH_ED ? CH_ED.team : "";
  $("#ce-players").value = CH_ED ? CH_ED.players : "";
  $("#ce-del").hidden = !CH_ED; $("#ce-del").textContent = "Delete";
  $("#ce-err").hidden = true;
  $("#ce-teams").innerHTML = sortedTeams().map(k => `<option value="${esc(tn(k))}">`).join("");
  openSheet("champ-ed");
}
$("#ce-team").addEventListener("change", () => {   // picking a current team fills in its players
  const k = Object.keys(TEAMS).find(k => tn(k) === $("#ce-team").value);
  if (k && !$("#ce-players").value) $("#ce-players").value = TEAMS[k].players;
});
$("#champ-form").onsubmit = async e => {
  e.preventDefault();
  const err = $("#ce-err");
  const row = {season_label:$("#ce-season").value.trim(), title:$("#ce-title").value, team:$("#ce-team").value.trim(), players:$("#ce-players").value.trim()};
  if (!row.season_label || !row.team){ err.hidden = false; err.textContent = "Season and team are both needed."; return; }
  const q = CH_ED ? sb.from("champions").update(row).eq("id", CH_ED.id).select("id") : sb.from("champions").insert(row).select("id");
  const {data, error} = await q;
  if (error || !data || data.length !== 1){ err.hidden = false; err.textContent = "Didn't save. Try again."; console.warn(error, data); return; }
  closeSheet($("#champ-ed")); toast("Added to the trophy case"); await loadAll(); render();
};
$("#ce-del").onclick = async () => {
  if (!CH_ED) return;
  if (Date.now() - delArm > 4000){ delArm = Date.now(); $("#ce-del").textContent = "Tap again to delete"; return; }
  const {data, error} = await sb.from("champions").delete().eq("id", CH_ED.id).select("id");
  if (error || !data || data.length !== 1){ toast("Didn't delete. Try again."); return; }
  closeSheet($("#champ-ed")); toast("Removed"); await loadAll(); render();
};

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
$("#copy-unpaid").onclick = () => {
  const names = sortedTeams().flatMap(k => players(k).filter(nm => realPlayer(nm) && !DUES[k + "|" + nm]).map(nm => `${nm} (${tn(k)})`));
  copyText(names.length ? `Still owe league dues ($${SEASON.dues}, pay at the bar):\n` + names.join("\n") : "Everyone has paid.", `Copied ${names.length} names. Paste into a text.`);
};

/* ---------- sign in / out ---------- */
$("#signin-link").onclick = () => { $("#si-err").hidden = true; openSheet("signin"); setTimeout(() => $("#si-email").focus(), 50); };
$("#signin-form").onsubmit = async e => {
  e.preventDefault();
  const go = $("#si-go"); go.disabled = true; go.textContent = "Signing in…";
  const {error} = await sb.auth.signInWithPassword({email: $("#si-email").value.trim(), password: $("#si-pass").value});
  go.disabled = false; go.textContent = "Sign in";
  if (error){
    const er = $("#si-err"), code = error.code || "", msg = String(error.message || "");
    er.hidden = false;
    if (code === "email_not_confirmed" || /not confirmed/i.test(msg)) er.textContent = "This login exists but was never confirmed. A commissioner needs to fix it in Supabase.";
    else if (code === "invalid_credentials" || /invalid login/i.test(msg)) er.textContent = "Wrong email or password. Check the spelling (no spaces) and try again.";
    else if (/rate|too many/i.test(code + msg)) er.textContent = "Too many tries. Wait a few minutes, then try again.";
    else er.textContent = "Couldn't sign in: " + msg;
    console.warn("sign-in failed", error);
    return;
  }
  $("#si-pass").value = ""; closeSheet($("#signin")); toast("Signed in. Tap any match to enter scores.");
};
$("#whoami").onclick = async () => { await sb.auth.signOut(); toast("Signed out"); };

/* ---------- loading ---------- */
async function loadAll(){
  if (!sb){ useSeed(); return; }
  try {
    const [t, m, c] = await Promise.all([
      sb.from("teams").select("*").eq("season", SEASON.id).order("sort"),
      sb.from("matches").select("*").eq("season", SEASON.id),
      sb.from("champions").select("*").order("id", {ascending:false}),
    ]);
    if (t.error || m.error) throw (t.error || m.error);
    if (!t.data.length) throw new Error("no teams in database");
    TEAMS = Object.fromEntries(t.data.map(x => [x.code, x]));
    MATCHES = m.data; source = "live";
    CHAMPS = c.error ? [] : c.data;
    if (commish){
      const d = await sb.from("dues").select("*").eq("season", SEASON.id);
      if (!d.error) DUES = Object.fromEntries(d.data.map(x => [x.team + "|" + x.player, x.paid_on]));
    }
  } catch (e){
    console.warn("live load failed", e);
    if (source !== "live") useSeed();   // keep the last good live data if we had it
  }
}
const sheetOpen = () => !!$(".scrim.on");
async function refresh(){
  if (editing || saving || sheetOpen()) return;   // don't overwrite anything mid-entry
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
    if ($(`.tab[data-v="${h}"]`) && !$(`.tab[data-v="${h}"]`).hidden) showTab(h);
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
