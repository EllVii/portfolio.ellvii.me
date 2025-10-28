// assets/assistant.js
(function () {
  // ------- DOM scaffold (uses your assistant.css classes) -------
  const html = `
  <button class="lpb-fab" id="lpbFab" aria-label="Open portfolio assistant">💬</button>

  <div class="lpb-panel" id="lpbPanel" role="dialog" aria-modal="true" aria-labelledby="lpbTitle" style="display:none">
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
  </div>`;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap);

  // ------- Handles -------
  const $fab = document.getElementById("lpbFab");
  const $panel = document.getElementById("lpbPanel");
  const $header = document.getElementById("lpbHeader");
  const $body = document.getElementById("lpbBody");
  const $form = document.getElementById("lpbForm");
  const $input = document.getElementById("lpbInput");
  const $close = document.getElementById("lpbClose");
  const $min = document.getElementById("lpbMin");
  const $chips = document.getElementById("lpbChips");
  const $resize = document.getElementById("lpbResize");

  // ------- State -------
  let fuse = null;
  let data = [];
  let busy = false; // prevent overlapping requests

  // ------- Helpers -------
  function openPanel() {
    $panel.style.display = "block";
    setTimeout(() => $input.focus(), 0);
  }
  function closePanel() {
    $panel.style.display = "none";
  }
  function post(role, html) {
    const div = document.createElement("div");
    div.className = "lpb-msg " + (role === "user" ? "user" : "bot");
    div.innerHTML = html;
    $body.appendChild(div);
    $body.scrollTop = $body.scrollHeight;
    return div;
  }
  function typing() {
    const n = document.createElement("div");
    n.className = "lpb-msg bot";
    n.setAttribute("data-typing", "1");
    n.innerHTML = `<span class="lpb-typing" aria-label="Assistant is typing">…</span>`;
    $body.appendChild(n);
    $body.scrollTop = $body.scrollHeight;
    return n;
  }
  function clearTyping() {
    const t = $body.querySelector('[data-typing="1"]');
    if (t) t.remove();
  }
  const badge = (t) => `<span class="lpb-tag">${t}</span>`;

  // ------- Drag move -------
  (function enableDrag() {
    let dragging = false,
      startX = 0,
      startY = 0,
      startLeft = 0,
      startTop = 0;
    $header.addEventListener("mousedown", (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = $panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      document.body.style.userSelect = "none";
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX,
        dy = e.clientY - startY;
      $panel.style.left = startLeft + dx + "px";
      $panel.style.top = startTop + dy + "px";
      $panel.style.right = "auto";
      $panel.style.bottom = "auto";
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
      document.body.style.userSelect = "";
    });
  })();

  // ------- Resize -------
  (function enableResize() {
    let resizing = false,
      startX = 0,
      startY = 0,
      startW = 0,
      startH = 0;
    $resize.addEventListener("mousedown", (e) => {
      e.preventDefault();
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      const r = $panel.getBoundingClientRect();
      startW = r.width;
      startH = r.height;
      document.body.style.userSelect = "none";
    });
    window.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const dw = e.clientX - startX,
        dh = e.clientY - startY;
      $panel.style.width = Math.max(300, startW + dw) + "px";
      $panel.style.height = Math.max(420, startH + dh) + "px";
    });
    window.addEventListener("mouseup", () => {
      resizing = false;
      document.body.style.userSelect = "";
    });
  })();

  // ------- Open/Close/Minimize -------
  $fab.addEventListener("click", openPanel);
  $close.addEventListener("click", closePanel);
  $min.addEventListener("click", () => ($panel.style.display = "none"));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
    if (e.key === "/" && $panel.style.display === "block" && document.activeElement !== $input) {
      e.preventDefault();
      $input.focus();
    }
  });

  // ------- Init (load data + Fuse) -------
  async function init() {
    try {
      // Ensure Fuse exists (loaded by index.html). If not, load it.
      if (typeof Fuse === "undefined") {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/fuse.js@6.6.2";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const res = await fetch("/assets/portfolio-index.json", { cache: "no-store" });
      data = await res.json();

      fuse = new Fuse(data, {
        includeScore: true,
        threshold: 0.38,
        keys: ["title", "tags", "summary", "bullets", "skills", "role", "content"],
      });

      post(
        "bot",
        `Hi! Ask about <b>KCS</b>, <b>ServiceNow SOP</b>, <b>HIPAA</b>, or metrics like <b>AHT</b>. I’ll search my work samples and summarize highlights.`
      );
    } catch (err) {
      console.error("Assistant init failed:", err);
      post("bot", "Search unavailable right now.");
    }
  }
  init();

  // -------
