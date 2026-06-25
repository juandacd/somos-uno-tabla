/* =====================================================================
   SOMOS UNO · TABLA MUNDIAL — Capa de datos
   ---------------------------------------------------------------------
   La "fuente de verdad" es un Google Sheet, expuesto vía Apps Script.
   • La tabla pública (standings.js) LEE con SU.loadResults() cada 30s.
   • El panel admin (admin.js) ESCRIBE con SU.saveResults(...).
   Mientras no haya conexión, se usan los datos de ejemplo (DEFAULT_RESULTS).
   ===================================================================== */

/* ---- Reglas de puntaje (NO cambiar) ---- */
const SCORING = {
  // puntos por puesto en la tarima (1° a 6°)
  byPosition: [1000, 700, 500, 200, 200, 200],
  participation: 500,           // bono para el equipo ganador de participación
  weeks: ['S1', 'S2', 'S3', 'S4'],
  currentWeek: 2,               // semana en curso (se sincroniza desde el Sheet)
};

/* ---- Selecciones (grupos) — estáticas, viven en el código ---- */
const TEAMS = [
  {
    id:'espana', name:'España', flag:'🇪🇸',
    group:'Camila P · Santiago · Michell S',
    colors:{ a:'#E4002B', b:'#FFCD00', ink:'#7a0016' },
    poster:'assets/posters/espana.jpg',
  },
  {
    id:'portugal', name:'Portugal', flag:'🇵🇹',
    group:'Valentina C · Miguel Ángel E',
    colors:{ a:'#1E7A46', b:'#DA291C', ink:'#0c3d22' },
    poster:'assets/posters/portugal.jpg',
  },
  {
    id:'francia', name:'Francia', flag:'🇫🇷',
    group:'Pastores Ricardo y Luisa Leiva',
    colors:{ a:'#1B3FBF', b:'#EF3340', ink:'#0e2470' },
    poster:'assets/posters/francia.jpg',
  },
  {
    id:'argentina', name:'Argentina', flag:'🇦🇷',
    group:'Daniela M · Manuela G · Wilson y Aide',
    colors:{ a:'#74ACDF', b:'#F4C022', ink:'#2f5e86' },
    poster:'assets/posters/argentina.jpg',
  },
  {
    id:'colombia', name:'Colombia', flag:'🇨🇴',
    group:'Samuel L · Juan David C',
    colors:{ a:'#FCD116', b:'#003893', ink:'#8a6f00' },
    poster:'assets/posters/colombia.jpg',
  },
  {
    id:'brasil', name:'Brasil', flag:'🇧🇷',
    group:'Alejandra L · Samuel M',
    colors:{ a:'#009C3B', b:'#FFDF00', ink:'#04612a' },
    poster:'assets/posters/brasil.jpg',
  },
];

/* ---- Resultados de respaldo (si el Sheet no responde) ----
   order: arreglo de team.id ordenados del 1° al 6° puesto en la tarima
   participation: team.id ganador del bono de 500
   Semanas no jugadas => null  */
const DEFAULT_RESULTS = {
  S1: {
    order: ['colombia','brasil','espana','argentina','portugal','francia'],
    participation: null,
  },
  S2: null,
  S3: null,
  S4: null,
};

/* =====================================================================
   API de datos
   ===================================================================== */
const SU = {
  SCORING, TEAMS,

  /* configuración inyectada por js/config.js */
  _cfg: (typeof window !== 'undefined' && window.SU_CONFIG) || {},

  /* caché en memoria de los resultados (lo que leen las funciones de cálculo) */
  _results: JSON.parse(JSON.stringify(DEFAULT_RESULTS)),
  loaded: false,

  team(id){ return TEAMS.find(t => t.id === id); },

  apiUrl(){
    const u = this._cfg.apiUrl || '';
    return (u && u.indexOf('PEGA_AQUI') === -1) ? u : '';
  },

  /* ---- LECTURA desde Google Sheets ---- */
  async loadResults(){
    const url = this.apiUrl();
    if(!url) return this._results;            // sin configurar => datos de ejemplo
    const res = await fetch(url, { method:'GET' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if(!data || data.ok === false) throw new Error((data && data.error) || 'Respuesta inválida');
    if(data.results) this._results = data.results;
    if(data.currentWeek) this.SCORING.currentWeek = +data.currentWeek;
    this.loaded = true;
    return this._results;
  },

  /* devuelve la caché en memoria (sincrónico, para las funciones de cálculo) */
  getResults(){ return this._results; },

  /* ---- ESCRITURA hacia Google Sheets ----
     Usa text/plain para evitar el preflight CORS de Apps Script. */
  async saveResults({ week, order, participation, points, currentWeek }){
    const url = this.apiUrl();
    if(!url) throw new Error('No has configurado apiUrl en js/config.js');
    const body = JSON.stringify({
      password: this._cfg.adminPassword || '',
      week, order, participation, points: points || null, currentWeek,
    });
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body,
    });
    const data = await res.json();
    if(!data || data.ok === false) throw new Error((data && data.error) || 'No se pudo guardar');
    if(data.results) this._results = data.results;
    if(data.currentWeek) this.SCORING.currentWeek = +data.currentWeek;
    return data;
  },

  /* puntos de una semana para cada equipo => { teamId: {pos, base, bonus, total} }
     Dos modos:
     · Normal: los puntos salen del puesto (SCORING.byPosition).
     · Personalizado (semana especial): si res.points existe, esos puntos
       mandan (permite empates, repartos distintos, etc.). */
  weekPoints(weekKey){
    const res = this.getResults()[weekKey];
    const map = {};
    TEAMS.forEach(t => { map[t.id] = { pos:null, base:0, bonus:0, total:0 }; });
    if(!res) return map;

    if(res.points){
      const orderList = (res.order && res.order.length) ? res.order : TEAMS.map(t=>t.id);
      TEAMS.forEach(t => {
        const base = Math.max(0, +res.points[t.id] || 0);
        const bonus = (res.participation === t.id) ? SCORING.participation : 0;
        const idx = orderList.indexOf(t.id);
        map[t.id] = { pos: idx>=0 ? idx+1 : null, base, bonus, total: base+bonus };
      });
      return map;
    }

    if(!res.order) return map;
    res.order.forEach((id, i) => {
      const base = SCORING.byPosition[i] ?? 0;
      const bonus = (res.participation === id) ? SCORING.participation : 0;
      map[id] = { pos:i+1, base, bonus, total:base+bonus };
    });
    return map;
  },

  /* tabla completa ordenada => [{team, weeks:{S1..}, total, rank}] */
  standings(){
    const rows = TEAMS.map(t => {
      const weeks = {};
      let total = 0;
      SCORING.weeks.forEach(w => {
        const p = this.weekPoints(w)[t.id];
        weeks[w] = p;
        total += p.total;
      });
      return { team:t, weeks, total };
    });
    // ordenar por total desc; desempate: mejor puesto reciente, luego nombre
    rows.sort((a,b) => {
      if(b.total !== a.total) return b.total - a.total;
      const wk = 'S'+SCORING.currentWeek;
      const pa = a.weeks[wk].pos ?? 99, pb = b.weeks[wk].pos ?? 99;
      if(pa !== pb) return pa - pb;
      return a.team.name.localeCompare(b.team.name);
    });
    rows.forEach((r,i)=> r.rank = i+1);
    return rows;
  },

  weekStatus(weekKey){
    const idx = SCORING.weeks.indexOf(weekKey) + 1;
    const res = this.getResults()[weekKey];
    if(idx < SCORING.currentWeek) return 'done';
    if(idx === SCORING.currentWeek) return 'live';
    return 'upcoming';
  },
};

if(typeof window !== 'undefined'){ window.SU = SU; }
