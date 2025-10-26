(function(){
  const html = `
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
      <input class="lpb-input" id="lpbInput" type="text" placeholder="Ask about my experience, metrics, or tools…"/>
      <button class="lpb-send" type="submit">Send</button>
    </form>
  </div>
  <div class="lpb-resize" id="lpbResize" aria-hidden="true"></div>
</div>`;
  const wrap = document.createElement('div'); wrap.innerHTML = html; document.body.appendChild(wrap);

  const $fab=document.getElementById('lpbFab'), $panel=document.getElementById('lpbPanel'),
        $header=document.getElementById('lpbHeader'), $body=document.getElementById('lpbBody'),
        $form=document.getElementById('lpbForm'), $input=document.getElementById('lpbInput'),
        $close=document.getElementById('lpbClose'), $min=document.getElementById('lpbMin'),
        $chips=document.getElementById('lpbChips'), $resize=document.getElementById('lpbResize');
  let fuse, data=[];

  function post(role, html){ const d=document.createElement('div'); d.className='lpb-msg '+(role==='user'?'user':'bot'); d.innerHTML=html; $body.appendChild(d); $body.scrollTop=$body.scrollHeight; }
  function openPanel(){ $panel.style.display='block'; $fab.style.transform='translateX(-76px)'; $input.focus(); }
  function closePanel(){ $panel.style.display='none'; $fab.style.transform=''; }
  $fab.addEventListener('click', openPanel); $close.addEventListener('click', closePanel); $min.addEventListener('click', closePanel);
  window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closePanel(); });

  // Drag
  (function(){ let dragging=false,sx=0,sy=0,sl=0,st=0;
    $header.addEventListener('mousedown',(e)=>{ dragging=true; sx=e.clientX; sy=e.clientY; const r=$panel.getBoundingClientRect(); sl=r.left; st=r.top; document.body.style.userSelect='none'; });
    window.addEventListener('mousemove',(e)=>{ if(!dragging) return; const dx=e.clientX-sx, dy=e.clientY-sy; let L=sl+dx, T=st+dy; const r=$panel.getBoundingClientRect(), vw=innerWidth, vh=innerHeight;
      T=Math.max(8,Math.min(T,vh-80)); L=Math.max(8,Math.min(L,vw-r.width-8)); Object.assign($panel.style,{left:L+'px',top:T+'px',right:'auto',bottom:'auto'}); });
    window.addEventListener('mouseup',()=>{ dragging=false; document.body.style.userSelect=''; });
  })();

  // Resize
  (function(){ let resizing=false,sx=0,sy=0,sw=0,sh=0;
    $resize.addEventListener('mousedown',(e)=>{ e.preventDefault(); resizing=true; sx=e.clientX; sy=e.clientY; const r=$panel.getBoundingClientRect(); sw=r.width; sh=r.height; document.body.style.userSelect='none'; });
    window.addEventListener('mousemove',(e)=>{ if(!resizing) return; const dw=e.clientX-sx, dh=e.clientY-sy; $panel.style.width=Math.max(300,sw+dw)+'px'; $panel.style.height=Math.max(400,sh+dh)+'px'; });
    window.addEventListener('mouseup',()=>{ resizing=false; document.body.style.userSelect=''; });
  })();

  // Init search
  async function init(){
    try{
      const res = await fetch('/assets/portfolio-index.json', { cache:'no-store' });
      if(!res.ok) throw new Error('HTTP '+res.status+' fetching portfolio-index.json');
      data = await res.json();
      fuse = new Fuse(data,{ includeScore:true, threshold:0.38, keys:['title','tags','summary','bullets','skills','role','content'] });
      post('bot','Hi! Ask about <b>KCS</b>, <b>ServiceNow SOP</b>, <b>HIPAA</b>, or metrics like <b>AHT</b>.');
    }catch(err){ console.error('Assistant init failed:', err); post('bot','Search failed: '+(err?.message||'see Console')); }
  }
  init();

  $chips.addEventListener('click',(e)=>{ if(e.target.classList.contains('lpb-chip')){ $input.value=e.target.textContent.trim(); $form.dispatchEvent(new Event('submit',{cancelable:true})); }});

  $form.addEventListener('submit',(e)=>{
    e.preventDefault(); const q=$input.value.trim(); if(!q) return; post('user', q);
    if(!fuse){ post('bot','Search unavailable.'); return; }
    const hits=fuse.search(q).slice(0,5).map(x=>x.item);
    if(!hits.length){ post('bot','No exact match. Try <b>KCS</b>, <b>ServiceNow</b>, <b>SOP</b>, <b>HIPAA</b>, or <b>dashboard</b>.'); return; }
    const reply=hits.map(h=>{
      const m=[]; if(h.metrics?.repeat_calls_reduction_pct) m.push(`↓ Repeat Calls: <b>${h.metrics.repeat_calls_reduction_pct}%</b>`);
      if(h.metrics?.aht_reduction_pct) m.push(`↓ AHT: <b>${h.metrics.aht_reduction_pct}%</b>`);
      if(h.metrics?.escalation_resolution_improvement_pct) m.push(`↓ Escalation Time: <b>${h.metrics.escalation_resolution_improvement_pct}%</b>`);
      return `
        <div class="lpb-card">
          <div style="font-size:12px;color:#6b7280">${h.type==='resume'?'Source: Resume':'Source: Project'}</div>
          <div style="font-weight:700;margin-top:2px;">${h.title}</div>
          ${h.summary?`<div style="font-size:13px;color:#555;margin-top:4px;">${h.summary}</div>`:''}
          ${(h.tags||[]).length?`<div class="lpb-tags">${h.tags.map(t=>'<span class="lpb-tag">'+t+'</span>').join('')}</div>`:''}
          ${m.length?`<div style="margin-top:6px;font-size:13px;">${m.join(' · ')}</div>`:''}
          <div style="margin-top:8px;">
            ${h.url?`<a class="lpb-cta" href="${h.url}" target="_blank" rel="noopener">Open</a>`:''}
            ${h.source_pdf?`<a class="lpb-cta" href="${h.source_pdf}" target="_blank" rel="noopener">View PDF</a>`:''}
          </div>
        </div>`;
    }).join('');
    post('bot', reply); $input.value='';
  });

  // "/" to focus
  window.addEventListener('keydown',(e)=>{ if(e.key==='/' && $panel.style.display==='block' && document.activeElement!==$input){ e.preventDefault(); $input.focus(); }});
})();
