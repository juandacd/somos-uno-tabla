/* =====================================================================
   SOMOS UNO · TABLA MUNDIAL — Lógica de la tabla pública
   Lee desde Google Sheets (vía SU.loadResults) y refresca cada 30s.
   ===================================================================== */
(function(){
  const fmt = n => n.toLocaleString('es-CO');
  const WEEK_LABEL = { S1:'Semana 1', S2:'Semana 2', S3:'Semana 3', S4:'Semana 4' };
  let lastHash = '';   // huella de los datos ya pintados (evita re-animar sin cambios)

  /* --- animación de conteo --- */
  function countUp(el, to, dur=1100){
    if(to === 0){ el.textContent = '0'; return; }
    const start = performance.now();
    function tick(now){
      const p = Math.min(1, (now-start)/dur);
      const e = 1 - Math.pow(1-p, 3);            // easeOutCubic
      el.textContent = fmt(Math.round(to*e));
      if(p<1) requestAnimationFrame(tick);
      else el.textContent = fmt(to);
    }
    requestAnimationFrame(tick);
    // respaldo: garantiza el valor final aunque el rAF se pause (proyector/pestaña sin foco)
    setTimeout(() => { el.textContent = fmt(to); }, dur + 400);
  }

  /* --- chip de semana --- */
  function weekChip(wk, p, status){
    // una semana con puntos siempre muestra sus puntos, aunque esté marcada como futura
    const empty = status === 'upcoming' && !p.total;
    const cls = status === 'live' ? 'wk--live' : empty ? 'wk--upcoming' : '';
    const val = empty
      ? '<span class="wk__v zero">—</span>'
      : `<span class="wk__v${p.total===0?' zero':''}">${p.total? fmt(p.total):'—'}</span>`;
    const bonus = p.bonus ? `<span class="wk__bonus">+500</span>` : '';
    const klabel = status === 'live' ? `${wk} · EN VIVO` : wk;
    return `<div class="wk ${cls}">
      <span class="wk__k">${klabel}</span>${val}${bonus}
    </div>`;
  }

  /* --- una fila --- */
  function rowHTML(r){
    const t = r.team;
    const leader = r.rank === 1 && r.total > 0;
    const weeks = SU.SCORING.weeks.map(w =>
      weekChip(w, r.weeks[w], SU.weekStatus(w))
    ).join('');
    const tag = leader ? `<span class="leader-tag"><span class="ball">⚽</span> Líder · 1er puesto</span>` : '';
    return `<article class="row ${leader?'row--leader':''}" data-team="${t.id}"
        style="--team-a:${t.colors.a}; --team-b:${t.colors.b}">
      ${tag}
      <div class="row__rank">${r.rank}</div>
      <div class="row__flag" style="background-image:url('${t.poster}')" role="img" aria-label="${t.name}"></div>
      <div class="row__name">
        <div class="row__country">${t.name}</div>
        <div class="row__group">${t.group}</div>
      </div>
      <div class="row__weeks">${weeks}</div>
      <div class="row__total">
        <div class="row__pts" data-to="${r.total}">0</div>
        <span class="row__pts-l">Puntos</span>
      </div>
    </article>`;
  }

  /* --- skeleton mientras carga --- */
  function renderSkeleton(){
    const board = document.getElementById('board');
    board.innerHTML = Array.from({length:6}).map(() => `
      <article class="row row--skeleton">
        <div class="row__rank"><span class="sk sk--rank"></span></div>
        <div class="row__flag sk sk--flag"></div>
        <div class="row__name">
          <span class="sk sk--line" style="width:60%"></span>
          <span class="sk sk--line" style="width:85%;margin-top:8px;height:11px"></span>
        </div>
        <div class="row__weeks">
          ${Array.from({length:4}).map(()=>'<span class="sk sk--wk"></span>').join('')}
        </div>
        <div class="row__total"><span class="sk sk--total"></span></div>
      </article>`).join('');
  }

  /* --- estado de jornada en el hero (se actualiza con el Sheet) --- */
  function syncHero(){
    const wk = SU.SCORING.currentWeek;
    const pill = document.getElementById('liveWeekPill');
    if(pill) pill.innerHTML =
      `<span class="live-dot" style="background:#fff;box-shadow:none"></span> ${WEEK_LABEL['S'+wk]} en curso`;

    document.querySelectorAll('.weeks-strip__item').forEach((el, i) => {
      const status = SU.weekStatus('S'+(i+1));
      el.classList.toggle('is-done', status==='done');
      el.classList.toggle('is-live', status==='live');
      el.classList.toggle('is-upcoming', status==='upcoming');
      const s = el.querySelector('.weeks-strip__s');
      if(s) s.textContent = status==='done' ? 'Jugada' : status==='live' ? 'En vivo' : (i===3 ? 'Final' : 'Próxima');
    });
  }

  /* --- render (animado solo cuando cambian los datos) --- */
  function render(animate=true){
    const rows = SU.standings();
    const board = document.getElementById('board');
    board.innerHTML = rows.map(rowHTML).join('');
    syncHero();

    const els = [...board.querySelectorAll('.row')];

    if(animate){
      // entrada escalonada + conteo
      els.forEach((el, i) => {
        setTimeout(() => {
          el.classList.add('in');
          const pts = el.querySelector('.row__pts');
          countUp(pts, +pts.dataset.to, 1000 + i*120);
        }, 180 + i*130);
      });
      // confeti cuando hay un líder con puntos
      if(rows[0] && rows[0].total > 0){
        setTimeout(() => burstConfetti(), 250 + els.length*130 + 300);
      }
    } else {
      // refresco silencioso (mismo dato): muestra valores finales sin animar
      els.forEach(el => {
        el.classList.add('in');
        const pts = el.querySelector('.row__pts');
        pts.textContent = fmt(+pts.dataset.to);
      });
    }

    // click => modal
    els.forEach(el => el.addEventListener('click', () => openModal(el.dataset.team)));
  }

  /* huella de los datos para detectar cambios entre polls */
  function hash(){
    return JSON.stringify(SU.getResults()) + '|' + SU.SCORING.currentWeek;
  }

  /* --- carga + refresco --- */
  async function refresh(first=false){
    try{
      await SU.loadResults();
      const h = hash();
      if(h !== lastHash){          // hubo cambios (o primera carga): animar
        lastHash = h;
        render(true);
      } else if(first){            // primera carga sin cambios respecto al respaldo
        render(true);
      }
    }catch(err){
      console.error('No se pudo leer Google Sheets:', err);
      if(first){ render(true); }   // muestra datos de respaldo
      showError();
    }
  }

  function showError(){
    const note = document.getElementById('boardNote');
    if(note) note.textContent = 'Sin conexión con la nube — mostrando últimos datos disponibles.';
  }

  /* --- modal detalle --- */
  function openModal(id){
    const t = SU.team(id);
    const row = SU.standings().find(r => r.team.id === id);
    const m = document.getElementById('modal');
    m.querySelector('.modal__poster').src = t.poster;
    m.querySelector('.modal__poster').alt = 'Póster ' + t.name;
    m.querySelector('.modal__country').textContent = t.name;
    m.querySelector('.modal__group').textContent = t.group;
    const wk = 'S'+SU.SCORING.currentWeek;
    m.querySelector('.modal__stats').innerHTML = `
      <div class="modal__stat"><b>#${row.rank}</b><span>Posición</span></div>
      <div class="modal__stat"><b>${fmt(row.total)}</b><span>Puntos totales</span></div>
      <div class="modal__stat"><b>${row.weeks[wk].pos ? '#'+row.weeks[wk].pos : '—'}</b><span>Puesto ${wk}</span></div>`;
    m.classList.add('open');
  }
  function closeModal(){ document.getElementById('modal').classList.remove('open'); }

  /* --- confeti (transmisión deportiva) --- */
  function burstConfetti(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#FF6B16','#E4231E','#2B2BE0','#5FC23C','#8A6BF0','#F4C022','#5FB4EF'];
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:80;overflow:hidden';
    document.body.appendChild(c);
    for(let i=0;i<90;i++){
      const p = document.createElement('i');
      const size = 6 + Math.random()*8;
      p.style.cssText = `position:absolute;top:-20px;left:${Math.random()*100}%;
        width:${size}px;height:${size*0.6}px;background:${colors[i%colors.length]};
        opacity:.9;border-radius:2px;transform:rotate(${Math.random()*360}deg)`;
      c.appendChild(p);
      const dur = 2600 + Math.random()*2200;
      const drift = (Math.random()-.5)*220;
      p.animate([
        { transform:`translate(0,0) rotate(0deg)`, opacity:1 },
        { transform:`translate(${drift}px, ${window.innerHeight+60}px) rotate(${720+Math.random()*360}deg)`, opacity:.9 }
      ], { duration:dur, easing:'cubic-bezier(.2,.6,.5,1)', delay:Math.random()*400 });
      setTimeout(()=>p.remove(), dur+500);
    }
    setTimeout(()=>c.remove(), 5600);
  }

  /* --- init --- */
  document.addEventListener('DOMContentLoaded', () => {
    renderSkeleton();
    refresh(true);

    // polling cada 30s (configurable en js/config.js)
    const ms = (SU._cfg && SU._cfg.pollMs) || 30000;
    setInterval(() => refresh(false), ms);
    // refresca también al volver a enfocar la pestaña
    document.addEventListener('visibilitychange', () => { if(!document.hidden) refresh(false); });

    document.getElementById('modal').addEventListener('click', e => {
      if(e.target.id === 'modal' || e.target.closest('.modal__close')) closeModal();
    });
    document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });
    // botón "celebrar" opcional
    const cel = document.getElementById('celebrate');
    if(cel) cel.addEventListener('click', burstConfetti);
  });
})();
