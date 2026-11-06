"use strict";
// ---------- 계정 로그인 + 기록 동기화 (Supabase) ----------
// config.js에 Supabase 주소와 공개 키가 있을 때만 켜집니다.
// 이메일 + 비밀번호로 로그인하므로 웹사이트, 내 PC 파일(file://), Windows 프로그램 어디서나 동작합니다.
// 가입 확인·비밀번호 재설정 메일의 링크는 config.js의 siteUrl(배포 주소)로 연결됩니다.
(() => {
  const cfg = window.ME_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase?.createClient) return;

  let sb;
  try {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: location.protocol.startsWith("http"), flowType: "implicit", storageKey: "morning-english-auth" }
    });
  } catch { return; }

  let user = null, ready = false, busy = false, last = null, note = "", timer = null, el = null, pendingEmail = "", recovering = false;
  const TABLE = "progress";
  const h = s => String(s).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  // 두 기기의 기록 합치기
  // - 날짜별 점수: 양쪽을 모두 남김 (같은 날 같은 항목은 더 최근에 공부한 쪽)
  // - 단어 진도: 단어마다 복습 횟수가 더 많은 쪽
  // - 오답 목록: 더 최근에 공부한 쪽
  function merge(l, r) {
    const newer = (r.ts || 0) > (l.ts || 0) ? r : l, older = newer === r ? l : r;
    const days = {};
    for (const k of new Set([...Object.keys(l.days || {}), ...Object.keys(r.days || {})]))
      days[k] = { ...(older.days?.[k] || {}), ...(newer.days?.[k] || {}) };
    const voc = { ...(older.voc || {}) };
    for (const [id, v] of Object.entries(newer.voc || {}))
      if (!voc[id] || (v.n || 0) >= (voc[id].n || 0)) voc[id] = v;
    return {
      days, voc,
      wrong: { ...(newer.wrong || {}) },
      plan: l.plan?.d === today ? l.plan : r.plan?.d === today ? r.plan : l.plan,
      vplan: l.vplan?.d === today ? l.vplan : r.vplan?.d === today ? r.vplan : l.vplan,
      ts: Math.max(l.ts || 0, r.ts || 0)
    };
  }

  // 서버에서 받아 합친 뒤, 바뀐 게 있으면 다시 올림
  async function sync() {
    if (!user || busy) return;
    busy = true; note = ""; paint();
    try {
      const { data: row, error } = await sb.from(TABLE).select("data").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      const remote = row?.data || null;
      const merged = remote ? merge(DB, remote) : DB;
      const changedLocal = JSON.stringify(merged) !== JSON.stringify(DB);
      DB = merged;
      try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch {}
      if (!remote || JSON.stringify(merged) !== JSON.stringify(remote)) {
        const { error: e2 } = await sb.from(TABLE).upsert({ user_id: user.id, data: DB, updated_at: new Date().toISOString() });
        if (e2) throw e2;
      }
      ready = true; last = new Date();
      // 다른 기기의 기록이 들어왔으면 지금 보고 있는 목록 화면을 새로 그림 (문제 푸는 중에는 건드리지 않음)
      if (changedLocal && ["home", "hist", "wordbook"].includes(cur)) view({ home, hist, wordbook }[cur]);
    } catch (e) {
      note = "동기화하지 못했어요. 인터넷 연결을 확인해 주세요.";
      console.warn("sync failed", e);
    } finally { busy = false; paint(); }
  }

  // 학습 기록이 저장될 때마다 2초 뒤 서버에도 반영
  window.onDBSave = () => {
    if (!user || !ready) return;
    clearTimeout(timer);
    timer = setTimeout(sync, 2000);
  };
  document.addEventListener("visibilitychange", () => { if (!document.hidden && user) sync(); });

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recovering = true; note = "";
      setTimeout(() => view(hist), 0); // 기록 화면에서 새 비밀번호 입력
    }
    const was = user?.id;
    user = session?.user || null;
    if (!user) ready = false;
    if (user && user.id !== was) setTimeout(sync, 0);
    paint();
  });

  // 기록 화면의 '계정 동기화' 영역
  function paint() {
    if (!el || !el.isConnected) return;
    if (user) {
      el.innerHTML = `<div class="syncbox"><h3>☁️ 계정 동기화</h3>
        <p><b>${h(user.email || "로그인됨")}</b> 로 로그인됨</p>
        <p class="st">${busy ? "동기화하는 중…" : last ? `마지막 동기화 ${hhmm(last)} · 학습 기록이 자동으로 저장돼요.` : "아직 동기화 전이에요."}</p>
        ${note ? `<p class="st warn">${note}</p>` : ""}
        <div class="row"><button id="sn"${busy ? " disabled" : ""}>지금 동기화</button><button id="so" class="ghost">로그아웃</button></div></div>`;
      el.querySelector("#sn").onclick = () => sync();
      el.querySelector("#so").onclick = async () => {
        await sb.auth.signOut();
        note = "로그아웃했어요. 이 브라우저의 기록은 그대로 남아 있어요."; paint();
      };
      return;
    }
    // 비밀번호 재설정 메일의 링크로 들어온 경우: 새 비밀번호 입력
    if (recovering) {
      el.innerHTML = `<div class="syncbox"><h3>🔑 새 비밀번호 설정</h3>
        <form id="sfr" class="row"><input id="np" type="password" minlength="6" required placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password"><button class="pri">변경</button></form>
        ${note ? `<p class="st warn">${note}</p>` : ""}</div>`;
      el.querySelector("#sfr").onsubmit = async e => {
        e.preventDefault();
        const { error } = await sb.auth.updateUser({ password: el.querySelector("#np").value });
        note = error ? "비밀번호를 바꾸지 못했어요. 6자 이상으로 다시 입력해 주세요." : "비밀번호를 바꿨어요.";
        if (!error) recovering = false;
        paint();
      };
      return;
    }
    el.innerHTML = `<div class="syncbox"><h3>☁️ 계정 동기화</h3>
      <p class="st">로그인하면 기록이 저장돼 다른 PC나 휴대폰에서도 이어서 공부할 수 있어요.</p>
      <form id="sf" class="authf">
        <input id="em" type="email" required placeholder="이메일 주소" autocomplete="email" value="${h(pendingEmail)}">
        <input id="pw" type="password" required minlength="6" placeholder="비밀번호 (6자 이상)" autocomplete="current-password">
        <div class="row"><button class="pri" id="si" data-act="in">로그인</button><button id="su" data-act="up">회원가입</button><button type="button" class="ghost" id="fg">비밀번호를 잊었어요</button></div>
      </form>
      ${note ? `<p class="st warn">${note}</p>` : ""}</div>`;
    const form = el.querySelector("#sf");
    const lock = on => form.querySelectorAll("button").forEach(b => (b.disabled = on));
    const msg = err => {
      const m = (err?.message || "").toLowerCase();
      if (err?.status === 429 || m.includes("rate")) return "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.";
      if (m.includes("invalid login")) return "이메일이나 비밀번호가 맞지 않아요.";
      if (m.includes("not confirmed")) return "메일함에서 가입 확인 링크를 먼저 눌러 주세요.";
      if (m.includes("already registered")) return "이미 가입된 이메일이에요. 로그인해 주세요.";
      if (m.includes("password")) return "비밀번호는 6자 이상으로 정해 주세요.";
      return "처리하지 못했어요. 인터넷 연결과 입력 내용을 확인해 주세요.";
    };
    form.onsubmit = async e => {
      e.preventDefault();
      const act = e.submitter?.dataset.act || "in";
      const email = el.querySelector("#em").value.trim(), password = el.querySelector("#pw").value;
      pendingEmail = email; lock(true);
      if (act === "up") {
        const { data, error } = await sb.auth.signUp({ email, password, options: cfg.siteUrl ? { emailRedirectTo: cfg.siteUrl } : {} });
        note = error ? msg(error) : data.session ? "" : `${h(email)} 로 가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 여기서 로그인하세요. (스팸함도 확인해 주세요)`;
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        note = error ? msg(error) : "";
      }
      paint();
    };
    el.querySelector("#fg").onclick = async () => {
      const email = el.querySelector("#em").value.trim();
      if (!email) { note = "이메일 주소를 먼저 입력해 주세요."; paint(); return; }
      pendingEmail = email; lock(true);
      const { error } = await sb.auth.resetPasswordForEmail(email, cfg.siteUrl ? { redirectTo: cfg.siteUrl } : {});
      note = error ? msg(error) : `${h(email)} 로 비밀번호 재설정 메일을 보냈어요. 메일의 링크를 누르면 새 비밀번호를 정할 수 있어요.`;
      paint();
    };
  }
  window.renderSync = target => { el = target; paint(); };

})();
