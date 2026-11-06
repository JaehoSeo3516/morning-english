"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $("#app");
const pad = n => String(n).padStart(2, "0");
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
let today = dkey(); // view()가 열릴 때마다 다시 계산 → 자정을 넘겨도 날짜가 갱신됨

// 기준일(2020-01-01)로부터 며칠째인지. 순환 출제의 기준이 됩니다.
function dayNum(k = today) {
  const [y, m, d] = k.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2020, 0, 1)) / 864e5);
}

// 시드 난수: 같은 시드 → 같은 결과
function rng(s) {
  let a = 0;
  for (const c of s) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, r) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// 문제 고유 ID (문제 문장 기반 → 문제 은행 순서를 바꿔도 오답 기록이 유지됨)
function hid(s) {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// ---------- 문제 은행 정리 ----------
const BYID = new Map();
const reg = x => { BYID.set(x.id, x); return x; };
const BANK = {
  L: TOEIC.L.map(x => reg({ ...x, k: "L", id: hid("L" + x.q + x.o.join("|")) })),
  G: TOEIC.G.map(x => reg({ ...x, k: "G", id: hid("G" + x.q + x.o.join("|")) })),
  P: TOEIC.P.map(p => ({ text: p.text, qs: p.qs.map(x => reg({ ...x, k: "P", p: p.text, id: hid("P" + p.text + x.q) })) }))
};

// 순환 출제: 문제 은행 전체를 한 바퀴 다 돈 뒤에야 같은 문제가 다시 나옵니다.
// (바퀴마다 순서는 새로 섞임)
const permCache = {};
function perm(tag, c, N) {
  const k = tag + c + ":" + N;
  if (permCache[k]) return permCache[k];
  let p = shuffle([...Array(N).keys()], rng(k));
  if (c > 0 && N > 3) {
    // 바퀴가 바뀌는 경계에서 방금 나온 문제가 곧바로 다시 나오지 않도록,
    // 직전 바퀴의 마지막 1/3 문제는 새 바퀴의 앞 1/3에 오지 않게 배치
    const K = Math.floor(N / 3);
    const tail = new Set(perm(tag, c - 1, N).slice(N - K));
    const rest = p.filter(i => !tail.has(i));
    p = [...rest.slice(0, K), ...shuffle([...rest.slice(K), ...tail], rng(k + "t"))];
  }
  return (permCache[k] = p);
}
function cyc(arr, per, tag, day) {
  const N = arr.length, out = [], seen = new Set();
  if (!N) return out;
  for (let j = 0; out.length < Math.min(per, N) && j < per * 3; j++) {
    const s = day * per + j;
    const it = arr[perm(tag, Math.floor(s / N), N)[s % N]];
    if (!seen.has(it)) { seen.add(it); out.push(it); }
  }
  return out;
}

// ---------- 저장소 (브라우저 localStorage, 외부 전송 없음) ----------
const KEY = "morning-english-v1";
const load = () => {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || {};
    return { days: d.days || {}, wrong: d.wrong || {}, plan: d.plan || null, voc: d.voc || {}, vplan: d.vplan || null, ts: d.ts || 0 };
  } catch { return { days: {}, wrong: {}, plan: null, voc: {}, vplan: null, ts: 0 }; }
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch {} window.onDBSave?.(); };
let DB = load();
// ts: 마지막으로 학습 기록이 바뀐 시각 (기기 간 동기화 때 어느 쪽이 최신인지 판단)
function record(kind, val) { (DB.days[today] ??= {})[kind] = val; DB.ts = Date.now(); save(); }
function streak() {
  let n = 0;
  const d = new Date();
  if (!DB.days[dkey(d)]) d.setDate(d.getDate() - 1);
  while (DB.days[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// 오답 복습: 틀린 문제는 다음 날부터 하루 최대 REVIEW개씩 다시 출제, 맞히면 목록에서 빠집니다.
const REVIEW = 2;
const pendingWrong = () => Object.keys(DB.wrong).filter(id => BYID.has(id)).length;
function reviewIds(exclude) {
  if (DB.plan?.d === today) return DB.plan.ids.filter(id => BYID.has(id));
  const ids = Object.entries(DB.wrong)
    .filter(([id, w]) => BYID.has(id) && w.d < today && !exclude.has(id))
    .sort((a, b) => a[1].d.localeCompare(b[1].d))
    .slice(0, REVIEW).map(([id]) => id);
  DB.plan = { d: today, ids }; save();
  return ids;
}

// ---------- 단어장 데이터 ----------
// 간격 반복: 단어마다 단계(b 0~5)를 두고, 맞힐수록 다음 복습까지의 간격이 길어집니다.
const POS = { n: "명사", v: "동사", adj: "형용사", adv: "부사", prep: "전치사", conj: "접속사", phr: "표현" };
const VBANK = VOCA.map(x => ({ ...x, id: hid("V" + x.w + "|" + x.p) }));
const VBYID = new Map(VBANK.map(x => [x.id, x]));
const VNEW = 10;            // 하루 새 단어
const VREV = 20;            // 하루 복습 단어 최대
const VGAP = [1, 2, 4, 7, 15, 30]; // 단계별 다음 복습까지 일수
const VLABEL = b => (b >= 4 ? "외웠어요" : b >= 2 ? "익숙해지는 중" : "외우는 중");
function addDays(k, n) { const [y, m, d] = k.split("-").map(Number); return dkey(new Date(y, m - 1, d + n)); }
const vDue = () => Object.entries(DB.voc).filter(([id, v]) => VBYID.has(id) && v.due <= today).length;
function vPlan() {
  if (DB.vplan?.d === today) return DB.vplan;
  const neu = cyc(VBANK, VNEW, "V", dayNum()).map(x => x.id);
  const ns = new Set(neu);
  const rev = Object.entries(DB.voc)
    .filter(([id, v]) => VBYID.has(id) && v.due <= today && !ns.has(id))
    .sort((a, b) => a[1].due.localeCompare(b[1].due) || a[1].b - b[1].b)
    .slice(0, VREV).map(([id]) => id);
  DB.vplan = { d: today, neu, rev }; save();
  return DB.vplan;
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 예문에서 표제어를 굵게 (applied, duties, signed up for 같은 변화형도 대부분 표시)
function mark(ex, w) {
  const toks = w.toLowerCase().replace(/^be /, "").split(/\s+/);
  const pat = toks.map(t => esc(t.length > 3 && /[ey]$/.test(t) ? t.slice(0, -1) : t) + "[a-z]*").join("\\s+");
  return ex.replace(new RegExp("\\b(" + pat + ")", "i"), "<b>$1</b>");
}

// ---------- 음성 합성 (Windows 내장 음성, 오프라인) ----------
let sayTok = 0;
function hush() { sayTok++; if ("speechSynthesis" in window) speechSynthesis.cancel(); }
function say(list, gap = 700) {
  if (!("speechSynthesis" in window)) return alert("이 브라우저는 음성 합성을 지원하지 않아요.");
  hush();
  const tok = sayTok;
  const v = speechSynthesis.getVoices().find(v => v.lang === "en-US" || v.lang === "en_US");
  let i = 0;
  const next = () => {
    if (tok !== sayTok || i >= list.length) return;
    const u = new SpeechSynthesisUtterance(list[i++]);
    u.lang = "en-US"; u.rate = 0.95;
    if (v) u.voice = v;
    u.onend = () => setTimeout(next, gap); // 문장 사이에 짧은 쉼
    speechSynthesis.speak(u);
  };
  next();
}

// ---------- 화면 전환 ----------
let cleanup = () => {};
let cur = "home";
function view(fn) {
  cleanup(); cleanup = () => {};
  hush();
  today = dkey();
  cur = fn.name;
  fn();
  window.scrollTo(0, 0);
}
// 탭을 켜둔 채 날짜가 바뀌면, 홈/기록 화면은 자동으로 새 날짜로 갱신
document.addEventListener("visibilitychange", () => {
  const views = { home, hist, wordbook };
  if (!document.hidden && dkey() !== today && views[cur]) view(views[cur]);
});

// ---------- 홈 ----------
function home() {
  const t = DB.days[today] || {};
  const w = pendingWrong();
  const vp = vPlan();
  app.innerHTML = `
    <p class="sub">${today} · 연속 ${streak()}일째 🔥 · 복습 대기 ${w}문제</p>
    <div class="grid">
      <section class="card"><h2>TOEIC</h2><p>듣기 3 · 문법/어휘 5 · 독해 2${w ? ` · 오답 복습 최대 ${REVIEW}` : ""}</p>
        <p class="st">${t.toeic ? `오늘 점수 ${t.toeic.s}/${t.toeic.n} ✅` : "아직 안 했어요"}</p>
        <button class="pri" id="bt">${t.toeic ? "다시 풀기 (연습)" : "시작"}</button></section>
      <section class="card"><h2>OPIc</h2><p>말하기 3문항 · 녹음 후 셀프 체크</p>
        <p class="st">${t.opic ? `${t.opic.n}문항 완료 ✅` : "아직 안 했어요"}</p>
        <button class="pri" id="bo">${t.opic ? "다시 하기 (연습)" : "시작"}</button></section>
      <section class="card"><h2>단어</h2><p>새 단어 ${vp.neu.length} · 복습 ${vp.rev.length} · 카드로 외우고 뜻 맞히기</p>
        <p class="st">${t.voca ? `오늘 점수 ${t.voca.s}/${t.voca.n} ✅` : "아직 안 했어요"}</p>
        <button class="pri" id="bv">${t.voca ? "다시 하기 (연습)" : "시작"}</button></section>
    </div>
    <p class="st">문제 은행: 듣기 ${BANK.L.length} · 문법/어휘 ${BANK.G.length} · 독해 지문 ${BANK.P.length} · OPIc ${OPIC.length} · 단어 ${VBANK.length}<br>
    은행을 한 바퀴 다 돌기 전에는 같은 문제가 다시 나오지 않아요. 기록에는 그날 첫 시도만 남아요.</p>`;
  $("#bt").onclick = () => view(toeic);
  $("#bo").onclick = () => view(opic);
  $("#bv").onclick = () => view(voca);
}

// ---------- TOEIC ----------
function toeic() {
  const practice = !!DB.days[today]?.toeic;
  const day = dayNum();
  const P = cyc(BANK.P, 1, "P", day)[0];
  const base = [...cyc(BANK.L, 3, "L", day), ...cyc(BANK.G, 5, "G", day), ...(P ? P.qs : [])];
  const rev = reviewIds(new Set(base.map(x => x.id))).map(id => ({ ...BYID.get(id), rev: true }));
  const items = [...base, ...rev].map(x => {
    const a = x.a ?? 0;
    return { ...x, o: shuffle(x.o.map((t, i) => ({ t, c: i === a })), rng(today + x.id)), my: null };
  });
  let i = 0;
  const t0 = Date.now();
  const kind = k => (k === "L" ? "듣기" : k === "G" ? "문법/어휘" : "독해");

  function show() {
    const x = items[i];
    const L = x.k === "L";
    app.innerHTML = `
      <p class="sub">TOEIC ${i + 1} / ${items.length} · ${kind(x.k)}${x.rev ? ' <span class="tag">오답 복습</span>' : ""}${practice ? ' <span class="tag">연습</span>' : ""}</p>
      <div class="bar"><i style="width:${(i / items.length) * 100}%"></i></div>
      <section class="card">
        ${x.p ? `<p class="pass">${x.p}</p>` : ""}
        ${L
          ? `<div class="row"><button id="pl" class="pri">🔊 다시 듣기</button><button id="tx" class="ghost">스크립트 보기</button></div>
             <p class="q" id="sc" hidden>${x.q}</p><p class="st">질문과 보기 A·B·C를 듣고 가장 알맞은 응답을 고르세요.</p>`
          : `<p class="q">${x.q}</p>`}
        <div class="opts${L ? " lis" : ""}">${x.o.map((o, j) => `<button class="opt" data-j="${j}">${"ABCD"[j]}<span class="ot"${L ? " hidden" : ""}>. ${o.t}</span></button>`).join("")}</div>
        <div id="fb"></div>
      </section>`;
    const reveal = () => { $("#sc").hidden = false; $$(".ot").forEach(s => (s.hidden = false)); };
    if (L) {
      const play = () => say([x.q, ...x.o.map((o, j) => `${"ABC"[j]}. ${o.t}`)]);
      $("#pl").onclick = play;
      $("#tx").onclick = reveal;
      play();
    }
    $$(".opt").forEach(b => b.onclick = () => {
      if (x.my !== null) return;
      x.my = +b.dataset.j;
      if (L) reveal();
      $$(".opt").forEach((el, j) => {
        if (x.o[j].c) el.classList.add("ok");
        else if (j === x.my) el.classList.add("bad");
      });
      $("#fb").innerHTML = `<p class="exp">${x.o[x.my].c ? "✅ 정답!" : "❌ 오답"} ${x.e || ""}</p>
        <button class="pri" id="nx">${i + 1 < items.length ? "다음" : "결과 보기"}</button>`;
      $("#nx").onclick = () => { hush(); i++; i < items.length ? show() : result(); };
    });
  }

  function result() {
    const s = items.filter(x => x.o[x.my].c).length;
    const sec = Math.round((Date.now() - t0) / 1000);
    if (!practice) {
      record("toeic", { s, n: items.length, sec });
      for (const x of items) {
        if (x.o[x.my].c) delete DB.wrong[x.id];
        else DB.wrong[x.id] = { d: today, n: (DB.wrong[x.id]?.n || 0) + 1 };
      }
      save();
    }
    const wrong = items.filter(x => !x.o[x.my].c);
    app.innerHTML = `
      <section class="card"><p class="sub">오늘의 TOEIC${practice ? " (연습 – 기록되지 않음)" : ""}</p>
        <p class="big">${s} / ${items.length}</p>
        <p class="st">소요 시간 ${Math.floor(sec / 60)}분 ${sec % 60}초${!practice && wrong.length ? ` · 틀린 ${wrong.length}문제는 내일부터 복습으로 다시 나와요` : ""}</p>
        ${wrong.length ? `<h3>틀린 문제</h3>` + wrong.map(x => `<div class="wrong"><b>${x.q}</b><br>정답: ${x.o.find(o => o.c).t}<br><span class="exp">${x.e || ""}</span></div>`).join("") : "<p>전부 맞혔어요! 🎉</p>"}
        <div class="row"><button class="pri" id="hm">홈으로</button></div></section>`;
    $("#hm").onclick = () => view(home);
  }
  show();
}

// ---------- OPIc ----------
function opic() {
  const practice = !!DB.days[today]?.opic;
  const day = dayNum();
  const by = g => OPIC.filter(x => x.g === g);
  // 묘사(a) + 습관(b) + [과거경험·비교(c) / 롤플레이(r) 하루씩 번갈아]
  const third = day % 2 === 0 ? cyc(by("c"), 1, "Oc", day / 2) : cyc(by("r"), 1, "Or", (day - 1) / 2);
  const qs = [...cyc(by("a"), 1, "Oa", day), ...cyc(by("b"), 1, "Ob", day), ...third];
  const checks = ["구체적인 예시/디테일을 넣었다", "시제를 맞췄다 (과거·현재)", "연결어(First, Then, However…)를 썼다", "마무리 문장으로 끝냈다"];
  const label = { a: "묘사", b: "습관·루틴", c: "경험·비교", r: "롤플레이" };
  let i = 0, total = 0;

  function show() {
    let rc = null, stream = null, recording = false, busy = false, dead = false, sec = 0, tm = null, url = null;
    const q = qs[i];
    app.innerHTML = `
      <p class="sub">OPIc ${i + 1} / ${qs.length} · ${label[q.g]}${practice ? ' <span class="tag">연습</span>' : ""}</p>
      <div class="bar"><i style="width:${(i / qs.length) * 100}%"></i></div>
      <section class="card">
        <p class="q">${q.q}</p>
        <div class="row"><button id="pl">🔊 질문 듣기</button></div>
        <p class="exp">💡 구조 팁: ${q.tip}</p>
        <hr style="border:0;border-top:1px solid var(--line)">
        <div class="row"><span class="timer" id="tm">00:00</span><button class="pri" id="rb">🎙 녹음 시작</button></div>
        <p class="exp" id="msg">목표: 1분 이상 말하기 (60초 넘으면 타이머가 초록색)</p>
        <audio id="au" controls hidden></audio>
        <div id="after" hidden>
          <h3>셀프 체크</h3>
          ${checks.map((c, j) => `<label><input type="checkbox" data-c="${j}"> ${c}</label>`).join("")}
          <div class="row"><button class="pri" id="nx">${i + 1 < qs.length ? "다음 문제" : "완료"}</button></div>
        </div>
      </section>`;
    // 이 화면의 요소를 미리 잡아둠 → 늦게 도착하는 녹음 결과가 다른 문제 화면에 붙지 않음
    const au = $("#au"), rb = $("#rb"), after = $("#after"), tmEl = $("#tm"), msg = $("#msg");
    $("#pl").onclick = () => say([q.q]);

    const release = s => { if (s) s.getTracks().forEach(t => t.stop()); };
    const stop = () => {
      recording = false; clearInterval(tm);
      if (rc && rc.state !== "inactive") rc.stop(); else { release(stream); stream = null; }
      rb.textContent = "🎙 다시 녹음";
      after.hidden = false;
    };
    cleanup = () => {
      dead = true; clearInterval(tm);
      if (rc) { rc.onstop = null; if (rc.state !== "inactive") rc.stop(); }
      release(stream); stream = null;
      if (url) URL.revokeObjectURL(url);
    };

    rb.onclick = async () => {
      if (busy) return;
      if (recording) return stop();
      busy = true; rb.disabled = true;
      after.hidden = true; au.hidden = true; // 녹음 중에는 '다음' 버튼 숨김
      rc = null;
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (dead) { release(s); return; } // 권한 창이 떠 있는 동안 화면을 떠난 경우
        stream = s;
        const rec = new MediaRecorder(s), chunks = [];
        rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
          au.src = url; au.hidden = false;
          release(s); if (stream === s) stream = null;
        };
        rc = rec;
        rec.start();
      } catch {
        if (dead) return;
        msg.textContent = "마이크를 사용할 수 없어 타이머만 작동해요. (브라우저의 마이크 권한을 확인하세요)";
      }
      busy = false; rb.disabled = false;
      recording = true; sec = 0;
      tmEl.textContent = "00:00"; tmEl.style.color = "";
      rb.textContent = "⏹ 정지";
      tm = setInterval(() => {
        sec++;
        tmEl.textContent = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
        if (sec >= 60) tmEl.style.color = "var(--ok)";
      }, 1000);
    };

    $("#nx").onclick = () => {
      total += $$("#after input:checked").length;
      cleanup(); cleanup = () => {};
      hush();
      i++; i < qs.length ? show() : finish();
    };
  }

  function finish() {
    if (!practice) record("opic", { n: qs.length, chk: total, max: qs.length * checks.length });
    app.innerHTML = `<section class="card"><p class="sub">오늘의 OPIc${practice ? " (연습 – 기록되지 않음)" : ""}</p>
      <p class="big">${total} / ${qs.length * checks.length}</p>
      <p class="st">셀프 체크 항목 달성 수. 녹음을 다시 들으며 어색한 문장을 고쳐 말해보세요!</p>
      <div class="row"><button class="pri" id="hm">홈으로</button></div></section>`;
    $("#hm").onclick = () => view(home);
  }
  show();
}


// ---------- 단어 ----------
function voca() {
  const practice = !!DB.days[today]?.voca;
  const plan = vPlan();
  const words = [
    ...plan.rev.filter(id => VBYID.has(id)).map(id => ({ ...VBYID.get(id), rev: true })),
    ...plan.neu.filter(id => VBYID.has(id)).map(id => ({ ...VBYID.get(id) }))
  ];
  const known = {};
  let i = 0;

  function card() {
    const x = words[i];
    app.innerHTML = `
      <p class="sub">단어 카드 ${i + 1} / ${words.length} <span class="tag">${x.rev ? "복습" : "새 단어"}</span>${practice ? ' <span class="tag">연습</span>' : ""}</p>
      <div class="bar"><i style="width:${(i / words.length) * 100}%"></i></div>
      <section class="card vcard">
        <p class="word">${x.w} <span class="pos">${POS[x.p] || x.p}</span></p>
        <div class="row"><button id="sw">🔊 발음</button></div>
        <div id="mean" hidden>
          <p class="meaning">${x.m}</p>
          <p class="ex">${mark(x.x, x.w)}</p>
          <div class="row"><button id="sx" class="ghost">🔊 예문 듣기</button></div>
        </div>
        <div class="row" id="rv"><button class="pri" id="show">뜻 보기</button></div>
        <div class="row" id="kk" hidden><button id="no">🤔 헷갈려요</button><button class="pri" id="yes">✅ 알아요</button></div>
      </section>
      <p class="st">뜻을 먼저 떠올려 본 뒤 '뜻 보기'를 누르세요. 카드를 다 보면 뜻 맞히기 퀴즈가 나와요.</p>`;
    say([x.w]);
    $("#sw").onclick = () => say([x.w]);
    $("#sx").onclick = () => say([x.x]);
    $("#show").onclick = () => { $("#mean").hidden = false; $("#rv").hidden = true; $("#kk").hidden = false; };
    const next = k => { known[x.id] = k; hush(); i++; i < words.length ? card() : quiz(); };
    $("#yes").onclick = () => next(true);
    $("#no").onclick = () => next(false);
  }

  // 뜻 맞히기: 같은 품사의 다른 단어 뜻을 오답 보기로 사용
  const r = rng(today + "VQ");
  const qs = shuffle(words, r).map(x => {
    const same = VBANK.filter(y => y.p === x.p && y.id !== x.id && y.m !== x.m);
    const pool = same.length >= 3 ? same : VBANK.filter(y => y.id !== x.id && y.m !== x.m);
    const wrongs = shuffle(pool, rng(today + x.id)).slice(0, 3).map(y => y.m);
    return { ...x, o: shuffle([{ t: x.m, c: true }, ...wrongs.map(t => ({ t, c: false }))], rng(today + x.id + "o")), my: null };
  });
  let j = 0;

  function quiz() {
    const x = qs[j];
    app.innerHTML = `
      <p class="sub">뜻 맞히기 ${j + 1} / ${qs.length}${practice ? ' <span class="tag">연습</span>' : ""}</p>
      <div class="bar"><i style="width:${(j / qs.length) * 100}%"></i></div>
      <section class="card">
        <p class="word">${x.w} <span class="pos">${POS[x.p] || x.p}</span></p>
        <div class="opts">${x.o.map((o, k) => `<button class="opt" data-k="${k}">${"ABCD"[k]}. ${o.t}</button>`).join("")}</div>
        <div id="fb"></div>
      </section>`;
    say([x.w]);
    $$(".opt").forEach(b => b.onclick = () => {
      if (x.my !== null) return;
      x.my = +b.dataset.k;
      $$(".opt").forEach((el, k) => {
        if (x.o[k].c) el.classList.add("ok");
        else if (k === x.my) el.classList.add("bad");
      });
      $("#fb").innerHTML = `<p class="exp">${x.o[x.my].c ? "✅ 정답!" : "❌ 오답"} <i>${mark(x.x, x.w)}</i></p>
        <button class="pri" id="nx">${j + 1 < qs.length ? "다음" : "결과 보기"}</button>`;
      $("#nx").onclick = () => { hush(); j++; j < qs.length ? quiz() : result(); };
    });
  }

  function result() {
    const ok = x => x.o[x.my].c;
    const s = qs.filter(ok).length;
    if (!practice) {
      record("voca", { s, n: qs.length });
      for (const x of qs) {
        const b0 = DB.voc[x.id]?.b ?? 0;
        // 맞히고 '알아요' → 한 단계 위, 맞혔지만 헷갈림 → 유지, 틀림 → 처음부터
        const b = !ok(x) ? 0 : known[x.id] ? Math.min(b0 + 1, 5) : b0;
        DB.voc[x.id] = { b, due: addDays(today, VGAP[b]), n: (DB.voc[x.id]?.n || 0) + 1 };
      }
      save();
    }
    const wrong = qs.filter(x => !ok(x));
    app.innerHTML = `
      <section class="card"><p class="sub">오늘의 단어${practice ? " (연습 – 기록되지 않음)" : ""}</p>
        <p class="big">${s} / ${qs.length}</p>
        <p class="st">${practice ? "" : "틀린 단어는 내일, 맞힌 단어는 단계에 따라 2~30일 뒤에 다시 나와요."}</p>
        ${wrong.length ? `<h3>다시 볼 단어</h3>` + wrong.map(x => `<div class="wrong"><b>${x.w}</b> <span class="pos">${POS[x.p] || x.p}</span> ${x.m}<br><span class="exp">${mark(x.x, x.w)}</span></div>`).join("") : "<p>전부 맞혔어요! 🎉</p>"}
        <div class="row"><button class="pri" id="hm">홈으로</button><button id="wb">단어장 보기</button></div></section>`;
    $("#hm").onclick = () => view(home);
    $("#wb").onclick = () => view(wordbook);
  }

  if (!words.length) { app.innerHTML = `<section class="card"><p>오늘 볼 단어가 없어요.</p></section>`; return; }
  card();
}

// ---------- 단어장 ----------
function wordbook() {
  const learned = Object.entries(DB.voc).filter(([id]) => VBYID.has(id)).map(([id, v]) => ({ ...VBYID.get(id), ...v }));
  const cnt = f => learned.filter(f).length;
  let filter = "all", q = "";
  app.innerHTML = `<section class="card"><h2>내 단어장</h2>
    <p class="sub">학습한 단어 ${learned.length} / ${VBANK.length} · 오늘 복습 ${vDue()}개</p>
    <div class="row seg">
      <button data-f="all" class="on">전체 ${learned.length}</button>
      <button data-f="lo">외우는 중 ${cnt(x => x.b <= 1)}</button>
      <button data-f="mid">익숙해지는 중 ${cnt(x => x.b >= 2 && x.b <= 3)}</button>
      <button data-f="hi">외웠어요 ${cnt(x => x.b >= 4)}</button>
    </div>
    <input id="q" type="search" placeholder="단어나 뜻으로 찾기" autocomplete="off">
    <div id="wl"></div></section>`;
  const draw = () => {
    const ql = q.trim().toLowerCase();
    const list = learned
      .filter(x => filter === "all" || (filter === "lo" ? x.b <= 1 : filter === "mid" ? x.b >= 2 && x.b <= 3 : x.b >= 4))
      .filter(x => !ql || x.w.toLowerCase().includes(ql) || x.m.includes(ql))
      .sort((a, b) => a.w.localeCompare(b.w));
    $("#wl").innerHTML = list.length
      ? list.map(x => `<div class="wrow"><button class="ghost sp" data-w="${x.id}" aria-label="${x.w} 발음 듣기">🔊</button>
          <div class="wtxt"><b>${x.w}</b> <span class="pos">${POS[x.p] || x.p}</span> ${x.m}<br><span class="st">${x.x}</span></div>
          <span class="lv lv${Math.min(Math.floor(x.b / 2), 2)}" title="다음 복습 ${x.due}">${VLABEL(x.b)}</span></div>`).join("")
      : `<p class="st">${learned.length ? "조건에 맞는 단어가 없어요." : "아직 학습한 단어가 없어요. 홈에서 오늘의 단어를 시작해 보세요."}</p>`;
    $$("#wl .sp").forEach(b => b.onclick = () => say([VBYID.get(b.dataset.w).w]));
  };
  $$(".seg button").forEach(b => b.onclick = () => {
    filter = b.dataset.f;
    $$(".seg button").forEach(x => x.classList.toggle("on", x === b));
    draw();
  });
  $("#q").oninput = e => { q = e.target.value; draw(); };
  draw();
}

// ---------- 기록 ----------
function hist() {
  const days = Object.keys(DB.days).sort().reverse().slice(0, 30);
  app.innerHTML = `<section class="card"><h2>최근 기록</h2><p class="sub">연속 ${streak()}일째 🔥 · 총 ${Object.keys(DB.days).length}일 · 복습 대기 ${pendingWrong()}문제</p>
    ${days.length ? `<table><tr><th>날짜</th><th>TOEIC</th><th>OPIc</th><th>단어</th></tr>` + days.map(d => {
      const x = DB.days[d];
      return `<tr><td>${d}</td><td>${x.toeic ? `${x.toeic.s}/${x.toeic.n}` : "-"}</td><td>${x.opic ? `${x.opic.chk}/${x.opic.max}` : "-"}</td><td>${x.voca ? `${x.voca.s}/${x.voca.n}` : "-"}</td></tr>`;
    }).join("") + `</table>` : "<p>아직 기록이 없어요.</p>"}
    <div id="sync"></div>
    <p class="st">로그인하지 않으면 기록은 이 브라우저에만 저장돼요. 브라우저 데이터를 지우기 전이나 PC를 옮길 때는 백업해 두세요.</p>
    <div class="row"><button id="ex">💾 백업 내보내기</button><button id="im">📂 백업 가져오기</button><input type="file" id="fi" accept=".json,application/json" hidden></div>
    <p class="st" id="bm"></p></section>`;
  window.renderSync?.($("#sync"));
  $("#ex").onclick = async () => {
    const name = `morning-english-backup-${today}.json`, json = JSON.stringify(DB, null, 1);
    // claude.ai 미리보기 안에서는 downloads 기능으로, 내 PC에서는 일반 다운로드로 저장
    const dl = window.claude?.use ? await window.claude.use("downloads").catch(() => null) : null;
    if (dl) {
      try { await dl.save({ filename: name, data: json }); $("#bm").textContent = "백업 파일을 저장했어요."; }
      catch (e) { if (e?.code !== "declined") $("#bm").textContent = "이 화면에서는 백업을 저장할 수 없어요."; }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#im").onclick = () => $("#fi").click();
  $("#fi").onchange = async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || typeof d.days !== "object") throw 0;
      // 확인 단계를 화면 안에 표시 (confirm 창이 막힌 환경에서도 동작)
      $("#bm").innerHTML = `백업(${Object.keys(d.days).length}일치)으로 현재 기록을 바꿀까요? <button id="ok">바꾸기</button> <button id="no" class="ghost">취소</button>`;
      $("#no").onclick = () => { $("#bm").textContent = ""; };
      $("#ok").onclick = () => {
        DB = { days: d.days, wrong: d.wrong || {}, plan: null, voc: d.voc || {}, vplan: null, ts: Date.now() };
        save();
        view(hist);
      };
    } catch { $("#bm").textContent = "올바른 백업 파일이 아니에요."; }
  };
}

$$("nav button").forEach(b => b.onclick = () => view({ home, hist, wordbook }[b.dataset.v]));
if ("speechSynthesis" in window) speechSynthesis.getVoices();
view(home);
