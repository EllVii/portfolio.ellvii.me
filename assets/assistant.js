/* assets/assistant.js */
(function () {
  // ---- DOM scaffold (bubble + panel) ----
  const shell = document.createElement("div");
  shell.innerHTML = `
    <button class="lpb-fab" id="lpbFab" aria-label="Open portfolio assistant">💬</button>
    <div class="lpb-panel" id="lpbPanel" role="dialog" aria-modal="true" aria-labelledby="lpbTitle">
      <div class="lpb-header" id="lpbHeader">
        <div class="lpb-title" id="lpbTitle">Portfolio Assistant</div>
        <div class="lpb-controls">
          <button class="lpb-btn" id="lpbMin" title="Minimize">–</button>
          <button class="lpb-btn" id="lpbClose" title="Close">✕</button>
        </div>
      </div>
      <div class="lpb-chipbar" id="lpbChips">
        <button class="lpb-chip">KCS results</button>
        <button class="lpb-chip">ServiceNow SOP</button>
        <button class="lpb-chip">HIPAA verification</button>
        <button class="lpb-chip">BSIT escalation</button>
      </div>
      <div class="lpb-body" id="lpbBody" tabindex="0" aria-live="polite"></div>
      <div class="lpb-footer">
        <form class="lpb-row" id="lpbForm">
          <input class="lpb-input" id="lpbInput" type="text" placeholder="Ask about my experience, metrics, or tools…" />
          <button class="lpb-send" type="submit">Send</button>
        </form>
      </div>
      <div class="lpb-resize" id="lpbResize" aria-hidden="true"></div>
    </div>
  `;
  document.body.appendChild(shell);

  // ---- Elements ----
  const $fab    = document.getElementById("lpbFab");
  const $panel  = document.getElementById("lpbPanel");
  const $header = document.getElementById("lpbHeader");
  const $body   = document.getElementById("lpbBody");
  const $form   = document.getElementById("lpbForm");
  const $input  = document.getElementById("lpbInput");
  const $close  = document.getElementById("lpbClose");
  const $min    = document.getElementById("lpbMin");
  const $chips  = document.getElementById("lpbChips");
  const $resize = document.getElementById("lpbResize");

  // ---- Open / close ----
  function openPanel(){ $panel.style.display = "block"; $input.focus(); }
  function closePanel(){ $panel.style.display = "none"; }
  $fab.addEventListener("click", openPanel);
  $close.addEventListener("click", closePanel);
  $min.addEventListener("click", () => ($panel.style.display = "none"));
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

  // ---- Drag to move ----
  (function enableDrag() {
    let dragging=false, sx=0, sy=0, sl=0, st=0;
    $header.addEventListener("mousedown", (e) => {
      dragging = true; sx=e.clientX; sy=e.clientY;
      const r=$panel.getBoundingClientRect(); sl=r.left; st=r.top;
      document.body.style.userSelect="none";
    });
    window.addEventListener("mousemove", (e) => {
      if(!dragging) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      $panel.style.left = sl+dx+"px";
      $panel.style.top  = st+dy+"px";
      $panel.style.right="auto"; $panel.style.bottom="auto";
    });
    window.addEventListener("mouseup", () => { dragging=false; document.body.style.userSelect=""; });
  })();

  // ---- Resize ----
  (function enableResize() {
    let resizing=false, sx=0, sy=0, sw=0, sh=0;
    $resize.addEventListener("mousedown", (e) => {
      e.preventDefault(); resizing=true; sx=e.clientX; sy=e.clientY;
      const r=$panel.getBoundingClientRect(); sw=r.width; sh=r.height;
      document.body.style.userSelect="none";
    });
    window.addEventListener("mousemove", (e) => {
      if(!resizing) return;
      const dw=e.clientX-sx, dh=e.clientY-sy;
      $panel.style.width  = Math.max(320, sw+dw)+"px";
      $panel.style.height = Math.max(420, sh+dh)+"px";
    });
    window.addEventListener("mouseup", () => { resizing=false; document.body.style.userSelect=""; });
  })();

  // ---- Utilities ----
  function post(role, html){
    const div=document.createElement("div");
    div.className = "lpb-msg " + (role === "user" ? "user" : "bot");
    div.innerHTML = html;
    $body.appendChild(div);
    $body.scrollTop = $body.scrollHeight;
    return div;
  }
  const badge = (t) => `<span class="lpb-tag">${t}</span>`;

  // ---- Load portfolio data + Fuse ----
  let fuse=null, corpus=[];
  async function loadCorpus(){
    const res = await fetch("/assets/portfolio-index.json", { cache: "no-store" });
    corpus = await res.json();
    // Fuse is loaded by index.html via CDN
    fuse = new Fuse(corpus, {
      includeScore: true,
      threshold: 0.38,
      keys: ["title","tags","summary","bullets","skills","role","content"]
    });
    post("bot", `Hi! Ask about <b>KCS</b>, <b>ServiceNow SOP</b>, <b>HIPAA</b>, or metrics like <b>AHT</b>.`);
  }
  loadCorpus().catch(err => {
    console.error("Assistant init failed:", err);
    post("bot", "Search unavailable right now.");
  });

  // ---- Chips (quick prompts) ----
  $chips.addEventListener("click", (e) => {
    if (!e.target.classList.contains("lpb-chip")) return;
    $input.value = e.target.textContent.trim();
    $form.dispatchEvent(new Event("submit", { cancelable: true }));
  });

  // ---- AI helper ----
  async function askAI(q, hits){
    try {
      const controller = new AbortController();
      const to = setTimeout(()=>controller.abort(), 15000); // 15s safety
      const aiRes = await fetch("/.netlify/functions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, topHits: hits }),
        signal: controller.signal
      });
      clearTimeout(to);

      if (!aiRes.ok) {
        const errTxt = await aiRes.text().catch(()=> "");
        throw new Error(errTxt || ("AI HTTP " + aiRes.status));
      }
      const json = await aiRes.json();
      return json?.text?.trim();
    } catch (e) {
      console.warn("AI fallback:", e.message || e);
      return null; // caller will gracefully skip AI section
    }
  }

  // ---- Form submit ----
  $form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $input.value.trim();
    if (!q) return;
    post("user", q);
    $input.value = "";

    if(!fuse){ post("bot","Search unavailable."); return; }

    const hits = fuse.search(q).slice(0,5).map(x => x.item);
    if (!hits.length) {
      post("bot", `No exact match. Try <b>KCS</b>, <b>ServiceNow</b>, <b>SOP</b>, <b>HIPAA</b>, or <b>dashboard</b>.`);
      return;
    }

    // Show cards from corpus
    const cards = hits.map(h=>{
      const metrics=[];
      if (h.metrics?.repeat_calls_reduction_pct) metrics.push(`↓ Repeat Calls: <b>${h.metrics.repeat_calls_reduction_pct}%</b>`);
      if (h.metrics?.aht_reduction_pct)        metrics.push(`↓ AHT: <b>${h.metrics.aht_reduction_pct}%</b>`);
      if (h.metrics?.escalation_resolution_improvement_pct) metrics.push(`↓ Escalation Time: <b>${h.metrics.escalation_resolution_improvement_pct}%</b>`);
      return `
        <div class="lpb-card">
          <div style="font-size:12px;color:var(--muted)">${h.type === "resume" ? "Source: Resume" : "Source: Project"}</div>
          <div style="font-weight:700;margin-top:2px;">${h.title}</div>
          ${h.summary ? `<div style="font-size:13px;color:#555;margin-top:4px;">${h.summary}</div>` : ""}
          ${(h.tags||[]).length ? `<div class="lpb-tags">${h.tags.map(badge).join("")}</div>` : ""}
          ${metrics.length ? `<div style="margin-top:6px;font-size:13px;">${metrics.join(" · ")}</div>` : ""}
          <div style="margin-top:8px;">
            ${h.url ? `<a class="lpb-cta" href="${h.url}" target="_blank" rel="noopener">Open</a>` : ""}
            ${h.source_pdf ? `<a class="lpb-cta" href="${h.source_pdf}" target="_blank" rel="noopener">View PDF</a>` : ""}
          </div>
        </div>`;
    }).join("");
    post("bot", cards);

    // Typing indicator while we hit AI
    const typing = post("bot", `<span style="opacity:.7">Summarizing…</span>`);

    // Ask AI with the top hits as lightweight context
    const aiText = await askAI(q, hits);

    // Remove typing indicator and render AI, or quietly skip if null
    typing.remove();
    if (aiText) {
      post("bot", aiText.replace(/\n/g, "<br>"));
    }
  });

  // ---- Keyboard shortcut: "/" focuses input when open ----
  window.addEventListener("keydown", (e)=>{
    if(e.key === "/" && $panel.style.display === "block" && document.activeElement !== $input){
      e.preventDefault(); $input.focus();
    }
  });
})();
