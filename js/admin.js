/* =====================================================================
   SOMOS UNO · TABLA MUNDIAL — Panel admin
   Login con contraseña hardcodeada + edición de resultados que se
   guardan directamente en Google Sheets (vía Apps Script).
   ===================================================================== */
(function(){
  const fmt = n => n.toLocaleString('es-CO');
  const WEEK_LABEL = { S1:'Semana 1', S2:'Semana 2', S3:'Semana 3', S4:'Semana 4' };
  let currentWeek = 'S2';     // semana en edición
  let order = [];             // arreglo de team.id 1°→6°
  let participation = null;   // team.id ganador del bono

  /* ---------------- LOGIN ---------------- */
  function initLogin(){
    const form = document.getElementById('loginForm');
    const err  = document.getElementById('loginErr');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const pass = document.getElementById('pass').value.trim();
      const expected = (SU._cfg && SU._cfg.adminPassword) || 'somosuno2026';
      if(!pass){ err.textContent = 'Ingresa la contraseña.'; return; }
      if(pass !== expected){ err.textContent = 'Contraseña incorrecta.'; return; }
      err.textContent = '';

      document.getElementById('login').classList.add('hide');
      document.getElementById('dash').classList.add('show');

      // carga inicial desde Google Sheets
      try{
        await SU.loadResults();
      }catch(e2){
        toast('⚠️ No se pudo leer la nube. Revisa apiUrl en config.js');
      }
      buildTabs();
      loadWeek('S'+SU.SCORING.currentWeek);
    });
  }

  /* ---------------- TABS DE SEMANA ---------------- */
  function buildTabs(){
    const wrap = document.getElementById('wtabs');
    wrap.innerHTML = SU.SCORING.weeks.map(w => {
      const st = SU.weekStatus(w);
      const sub = st==='done'?'Jugada':st==='live'?'En curso':'Próxima';
      return `<button class="wtab" data-w="${w}">
        <span>${w}</span><small>${sub}</small></button>`;
    }).join('');
    wrap.querySelectorAll('.wtab').forEach(b =>
      b.addEventListener('click', () => loadWeek(b.dataset.w)));
  }

  function loadWeek(w){
    currentWeek = w;
    const res = SU.getResults()[w];
    order = res && res.order ? [...res.order] : SU.TEAMS.map(t=>t.id);
    participation = res ? res.participation : null;
    document.getElementById('weekTitle').textContent = 'Resultados · ' + WEEK_LABEL[w];
    document.querySelectorAll('.wtab').forEach(b => b.classList.toggle('active', b.dataset.w===w));
    renderList();
    renderPart();
  }

  /* ---------------- LISTA ORDENABLE ---------------- */
  function renderList(){
    const ul = document.getElementById('orderList');
    ul.innerHTML = order.map((id, i) => {
      const t = SU.team(id);
      const base = SU.SCORING.byPosition[i] ?? 0;
      const bonus = participation===id ? SU.SCORING.participation : 0;
      return `<li class="oitem" draggable="true" data-id="${id}"
          style="--team-a:${t.colors.a}">
        <span class="drag-handle" title="Arrastra para reordenar">⠿</span>
        <span class="oitem__pos">${i+1}</span>
        <span class="oitem__flag" style="background-image:url('${t.poster}')"></span>
        <span class="oitem__name">
          <span class="oitem__country">${t.name}</span>
          <span class="oitem__group">${t.group}</span>
        </span>
        <span class="oitem__pts">${fmt(base+bonus)}<small>PTS${bonus?' · +500':''}</small></span>
        <span class="oitem__moves">
          <button class="mvbtn up" ${i===0?'disabled':''} aria-label="Subir">▲</button>
          <button class="mvbtn dn" ${i===order.length-1?'disabled':''} aria-label="Bajar">▼</button>
        </span>
      </li>`;
    }).join('');
    wireList(ul);
  }

  function wireList(ul){
    // botones subir/bajar
    ul.querySelectorAll('.up').forEach((b,i)=> b.addEventListener('click',e=>{
      e.stopPropagation(); const idx = idxOf(b); if(idx>0) swap(idx,idx-1);
    }));
    ul.querySelectorAll('.dn').forEach(b=> b.addEventListener('click',e=>{
      e.stopPropagation(); const idx = idxOf(b); if(idx<order.length-1) swap(idx,idx+1);
    }));
    // drag & drop
    let dragId = null;
    ul.querySelectorAll('.oitem').forEach(li => {
      li.addEventListener('dragstart', e => { dragId = li.dataset.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
      li.addEventListener('dragend',   () => { li.classList.remove('dragging'); ul.querySelectorAll('.oitem').forEach(x=>x.classList.remove('over')); });
      li.addEventListener('dragover',  e => { e.preventDefault(); li.classList.add('over'); });
      li.addEventListener('dragleave', () => li.classList.remove('over'));
      li.addEventListener('drop', e => {
        e.preventDefault();
        const from = order.indexOf(dragId);
        const to = order.indexOf(li.dataset.id);
        if(from<0||to<0||from===to) return;
        order.splice(to,0, order.splice(from,1)[0]);
        renderList();
      });
    });
  }
  function idxOf(btn){ return order.indexOf(btn.closest('.oitem').dataset.id); }
  function swap(a,b){ [order[a],order[b]]=[order[b],order[a]]; renderList(); }

  /* ---------------- PARTICIPACIÓN ---------------- */
  function renderPart(){
    const wrap = document.getElementById('partGrid');
    wrap.innerHTML = SU.TEAMS.map(t => `
      <label class="part-opt ${participation===t.id?'sel':''}" style="--team-a:${t.colors.a}" data-id="${t.id}">
        <span class="pf" style="background-image:url('${t.poster}')"></span>
        <span class="pn">${t.name}</span>
        <span class="pp">+500</span>
        <input type="radio" name="part" value="${t.id}" ${participation===t.id?'checked':''}>
      </label>`).join('');
    wrap.querySelectorAll('.part-opt').forEach(o => o.addEventListener('click', () => {
      // permite des-seleccionar tocando la misma opción
      participation = (participation === o.dataset.id) ? null : o.dataset.id;
      renderPart(); renderList();
    }));
  }

  /* ---------------- GUARDAR (escribe en Google Sheets) ---------------- */
  async function save(){
    const btn = document.getElementById('saveBtn');
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Guardando…';
    try{
      await SU.saveResults({
        week: currentWeek,
        order: [...order],
        participation: participation || null,
      });
      buildTabs();
      document.querySelectorAll('.wtab').forEach(b => b.classList.toggle('active', b.dataset.w===currentWeek));
      toast('¡Resultados de '+currentWeek+' guardados en la nube!');
    }catch(err){
      console.error(err);
      toast('❌ ' + (err.message || 'No se pudo guardar'));
    }finally{
      btn.disabled = false; btn.textContent = original;
    }
  }

  /* ---------------- RECARGAR desde la nube (descarta cambios) ---------------- */
  async function reload(){
    if(!confirm('¿Descartar los cambios sin guardar y recargar desde la nube?')) return;
    try{
      await SU.loadResults();
      buildTabs();
      loadWeek(currentWeek);
      toast('Datos recargados desde Google Sheets');
    }catch(err){
      toast('❌ No se pudo recargar: ' + (err.message||''));
    }
  }

  function toast(msg){
    const t = document.getElementById('toast');
    t.querySelector('span').textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 3200);
  }

  /* ---------------- INIT ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    document.getElementById('saveBtn').addEventListener('click', save);
    document.getElementById('resetBtn').addEventListener('click', reload);
  });
})();
