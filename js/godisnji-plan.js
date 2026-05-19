// ========================================
// js/godisnji-plan.js
// Godišnji plan sječe 2026 — Pogon Bosanska Krupa
// ========================================
(function () {
  'use strict';

  // ---- PLAN DATA ----
  const PLAN_ENTRIES = [
    { gj:'Risovac Krupa', odjel:'13',    bruto:3244,  neto:2768, cTrupci:3,    dzgo:2,   lTrupci:875,  cijepano:1888 },
    { gj:'Risovac Krupa', odjel:'35',    bruto:5417,  neto:4648, cTrupci:122,  dzgo:44,  lTrupci:1813, cijepano:2670 },
    { gj:'Risovac Krupa', odjel:'50',    bruto:5161,  neto:4329, cTrupci:1824, dzgo:227, lTrupci:971,  cijepano:1307 },
    { gj:'Risovac Krupa', odjel:'54P',   bruto:1511,  neto:1276, cTrupci:639,  dzgo:109, lTrupci:208,  cijepano:320  },
    { gj:'Risovac Krupa', odjel:'55',    bruto:5195,  neto:4258, cTrupci:2193, dzgo:328, lTrupci:789,  cijepano:948  },
    { gj:'Risovac Krupa', odjel:'56',    bruto:3877,  neto:3206, cTrupci:1779, dzgo:263, lTrupci:439,  cijepano:725  },
    { gj:'Risovac Krupa', odjel:'59/1',  bruto:3724,  neto:3087, cTrupci:1545, dzgo:208, lTrupci:658,  cijepano:676  },
    { gj:'Risovac Krupa', odjel:'63',    bruto:4033,  neto:3339, cTrupci:1309, dzgo:236, lTrupci:796,  cijepano:998  },
    { gj:'Risovac Krupa', odjel:'66',    bruto:2645,  neto:2307, cTrupci:0,    dzgo:52,  lTrupci:949,  cijepano:1307 },
    { gj:'Risovac Krupa', odjel:'68/2',  bruto:2605,  neto:2287, cTrupci:35,   dzgo:6,   lTrupci:1012, cijepano:1234 },
    { gj:'Risovac Krupa', odjel:'71P',   bruto:1957,  neto:1655, cTrupci:664,  dzgo:114, lTrupci:401,  cijepano:476  },
    { gj:'Risovac Krupa', odjel:'97',    bruto:4889,  neto:4058, cTrupci:1253, dzgo:236, lTrupci:901,  cijepano:1668 },
    { gj:'Risovac Krupa', odjel:'113P',  bruto:5177,  neto:4300, cTrupci:225,  dzgo:74,  lTrupci:1278, cijepano:2723 },
    { gj:'Grmeč Jasenica', odjel:'4/1',   bruto:2490, neto:2117, cTrupci:0,   dzgo:0,   lTrupci:303,  cijepano:1814 },
    { gj:'Grmeč Jasenica', odjel:'11P',   bruto:208,  neto:179,  cTrupci:0,   dzgo:0,   lTrupci:73,   cijepano:106  },
    { gj:'Grmeč Jasenica', odjel:'43P',   bruto:1099, neto:740,  cTrupci:40,  dzgo:100, lTrupci:160,  cijepano:440  },
    { gj:'Grmeč Jasenica', odjel:'60',    bruto:3551, neto:3061, cTrupci:295, dzgo:65,  lTrupci:1050, cijepano:1651 },
    { gj:'Grmeč Jasenica', odjel:'61',    bruto:4774, neto:4105, cTrupci:454, dzgo:102, lTrupci:1393, cijepano:2156 },
    { gj:'Grmeč Jasenica', odjel:'64/2P', bruto:996,  neto:608,  cTrupci:13,  dzgo:23,  lTrupci:211,  cijepano:361  },
    { gj:'Grmeč Jasenica', odjel:'66',    bruto:5339, neto:4493, cTrupci:0,   dzgo:0,   lTrupci:1025, cijepano:3468 },
    { gj:'Grmeč Jasenica', odjel:'67',    bruto:4853, neto:4199, cTrupci:0,   dzgo:0,   lTrupci:1530, cijepano:2669 },
    { gj:'Grmeč Jasenica', odjel:'69P',   bruto:1309, neto:1204, cTrupci:82,  dzgo:32,  lTrupci:390,  cijepano:700  },
    { gj:'Grmeč Jasenica', odjel:'85P',   bruto:678,  neto:418,  cTrupci:0,   dzgo:73,  lTrupci:25,   cijepano:320  },
    { gj:'Grmeč Jasenica', odjel:'88P',   bruto:1805, neto:1200, cTrupci:0,   dzgo:0,   lTrupci:20,   cijepano:1180 },
    { gj:'Vojskova', odjel:'15',  bruto:450, neto:383, cTrupci:0, dzgo:0, lTrupci:0,   cijepano:383 },
    { gj:'Vojskova', odjel:'21P', bruto:787, neto:624, cTrupci:0, dzgo:0, lTrupci:202, cijepano:422 },
    { gj:'Vojskova', odjel:'25',  bruto:750, neto:637, cTrupci:0, dzgo:0, lTrupci:0,   cijepano:637 },
  ];

  const GJ_LIST = ['Risovac Krupa', 'Grmeč Jasenica', 'Vojskova'];
  const GJ_COLOR = { 'Risovac Krupa':'#1d4ed8', 'Grmeč Jasenica':'#15803d', 'Vojskova':'#b45309', 'Slučajni užici':'#7c3aed' };
  const GJ_BG   = { 'Risovac Krupa':'#eff6ff',  'Grmeč Jasenica':'#f0fdf4',  'Vojskova':'#fff7ed', 'Slučajni užici':'#f5f3ff'  };
  const C = {
    cTrupci:'#1e40af', celDuga:'#5b21b6', celCijepana:'#7c3aed', skart:'#9ca3af',
    lTrupci:'#15803d', ogrDugi:'#92400e', ogrCijepani:'#b45309', gule:'#d97706',
  };
  const PLAN_YEAR = 2026;

  // ---- STATE ----
  let _rows    = [];
  let _rawPrimke = [];
  let _loaded  = false;
  let _loading = false;
  let _activeTab  = 'grupe';
  let _gjFilter   = 'sve';
  let _stFilter   = 'sve';
  let _search     = '';
  let _sort = {
    grupe:     { col:'odjel', asc:true },
    sortimenti:{ col:'stepen', asc:false },
    pregled:   { col:'odjel', asc:true },
    projekat:  { col:'odjel', asc:true },
  };
  let _gpChart = null;

  // ---- HELPERS ----
  function normKey(s) {
    return String(s||'').trim().toUpperCase()
      .replace(/Č/g,'C').replace(/Ć/g,'C')
      .replace(/Š/g,'S').replace(/Ž/g,'Z').replace(/Đ/g,'DJ')
      .replace(/P\s*$/, '').trim();
  }

  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    const v = Math.round(n);
    if (v === 0) return '—';
    return v.toLocaleString('de-DE');
  }

  function fmtN(n) {
    if (n == null || isNaN(n)) return '0';
    return Math.round(n).toLocaleString('de-DE');
  }

  function deriveStatus(pct) {
    return pct >= 95 ? 'posjeceno' : pct > 5 ? 'u-sjeci' : 'planirano';
  }

  function getOvr(gj, odjel) { return localStorage.getItem('gp|'+gj+'|'+odjel) || 'auto'; }

  function dzgoAct(a) { return (a.celDuga||0)+(a.celCijepana||0)+(a.skart||0); }
  function cijAct(a)  { return (a.ogrDugi||0)+(a.ogrCijepani||0)+(a.gule||0); }

  function formatDay(datumStr) {
    const p = datumStr.split('.');
    if (p.length < 3) return datumStr;
    const d = new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
    const days = ['Ned','Pon','Uto','Sri','Čet','Pet','Sub'];
    return datumStr + ' (' + (days[d.getDay()]||'') + ')';
  }

  // ---- UI COMPONENTS ----
  function realizacijaBadge(pct) {
    if (pct == null || isNaN(pct)) return '<span style="color:#9ca3af;background:#f3f4f6;padding:2px 7px;border-radius:99px;font-size:11px;font-weight:600;">—</span>';
    const p = parseFloat(pct.toFixed(1));
    let col, bg;
    if (p >= 90)     { col='#166534'; bg='#dcfce7'; }
    else if (p >= 60){ col='#92400e'; bg='#fef3c7'; }
    else if (p > 0)  { col='#991b1b'; bg='#fee2e2'; }
    else             { col='#6b7280'; bg='#f3f4f6'; return `<span style="color:${col};background:${bg};padding:2px 7px;border-radius:99px;font-size:11px;font-weight:600;">—</span>`; }
    return `<span style="color:${col};background:${bg};padding:2px 7px;border-radius:99px;font-size:11px;font-weight:600;">${p.toFixed(1)}%</span>`;
  }

  function statusBadge(s) {
    const m = {
      posjeceno: {bg:'#dcfce7', col:'#166534', lbl:'Posječeno'},
      'u-sjeci': {bg:'#fef3c7', col:'#92400e', lbl:'U sječi'},
      planirano: {bg:'#f3f4f6', col:'#6b7280', lbl:'Planirano'},
    };
    const c = m[s]||m.planirano;
    return `<span style="background:${c.bg};color:${c.col};padding:2px 7px;border-radius:99px;font-size:11px;font-weight:600;">${c.lbl}</span>`;
  }

  function statusSelectHtml(gj, odjel, ovr) {
    const eg = gj.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const eo = odjel.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const opts = [['auto','Auto'],['posjeceno','Posječeno'],['u-sjeci','U sječi'],['planirano','Planirano']];
    return `<select style="font-size:11px;padding:2px 4px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;margin-left:4px;" onchange="gpSetOverride('${eg}','${eo}',this.value)">${opts.map(([v,l])=>`<option value="${v}"${ovr===v?' selected':''}>${l}</option>`).join('')}</select>`;
  }

  function bar2(pct, color) {
    const w = Math.min(100, Math.round(pct||0));
    const bc = (pct||0) > 100 ? '#dc2626' : (color||'#059669');
    return `<div style="height:5px;background:#e5e7eb;border-radius:3px;width:56px;display:inline-block;vertical-align:middle;"><div style="height:100%;width:${w}%;background:${bc};border-radius:3px;"></div></div>`;
  }

  function koefColor(k) { return k>=85?'#166534':k>=75?'#92400e':'#991b1b'; }

  function gjBadge(gj) {
    return `<span style="background:${GJ_BG[gj]};color:${GJ_COLOR[gj]};padding:2px 7px;border-radius:99px;font-size:11px;font-weight:700;">${gj}</span>`;
  }

  // Styled odjel number chip — optional display overrides the label
  function odjelLink(gj, odjel, display) {
    const eg = gj.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const eo = odjel.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const label = display !== undefined ? display : odjel;
    const isSluc = gj === 'Slučajni užici';
    const bg = isSluc ? '#f5f3ff' : '#eff6ff';
    const col = isSluc ? '#7c3aed' : '#1d4ed8';
    const border = isSluc ? '#ddd6fe' : '#bfdbfe';
    const hoverBg = isSluc ? '#ede9fe' : '#dbeafe';
    const hoverBorder = isSluc ? '#c4b5fd' : '#93c5fd';
    return `<span onclick="gpOpenOdjelModal('${eg}','${eo}')" style="cursor:pointer;display:inline-block;font-family:'Roboto Mono',monospace;font-weight:700;font-size:12px;background:${bg};color:${col};padding:3px 9px;border-radius:5px;border:1px solid ${border};min-width:28px;text-align:center;letter-spacing:0.3px;" onmouseover="this.style.background='${hoverBg}';this.style.borderColor='${hoverBorder}'" onmouseout="this.style.background='${bg}';this.style.borderColor='${border}'">${label}</span>`;
  }

  // Strip GJ prefix from a full odjel string (for slučajni display)
  function shortOdjel(fullOdjel) {
    for (const gj of GJ_LIST) {
      if (fullOdjel.toLowerCase().startsWith(gj.toLowerCase() + ' ')) {
        return fullOdjel.substring(gj.length + 1).trim();
      }
    }
    return fullOdjel;
  }

  // GJ section header row
  function gjHeaderRow(gj, cols) {
    const col = GJ_COLOR[gj];
    return `<tr style="background:linear-gradient(90deg,${col}1c 0%,${col}09 55%,transparent 100%);">
      <td colspan="${cols}" style="border-left:4px solid ${col};padding:9px 14px;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:7px;height:7px;background:${col};border-radius:2px;flex-shrink:0;"></span>
          <span style="font-size:12px;font-weight:800;color:${col};text-transform:uppercase;letter-spacing:0.5px;">${gj}</span>
        </div>
      </td>
    </tr>`;
  }

  // Subtotal row wrapper style
  function subTotalStyle(gj) {
    const col = GJ_COLOR[gj];
    return `background:${GJ_BG[gj]};border-top:2px solid ${col}50;font-weight:700;font-size:11px;`;
  }

  // ---- AGGREGATION ----
  function sumRows(rs) {
    const s  = k => rs.reduce((acc,r)=>acc+(r[k]||0),0);
    const sa = k => rs.reduce((acc,r)=>acc+(r.actual[k]||0),0);
    const planCT=s('cTrupci'), actCT=sa('cTrupci');
    const planDz=s('dzgo'),    celDuga=sa('celDuga'), celCij=sa('celCijepana'), skart=sa('skart');
    const planLT=s('lTrupci'), actLT=sa('lTrupci');
    const planCij=s('cijepano'), ogrDugi=sa('ogrDugi'), ogrCij=sa('ogrCijepani'), gule=sa('gule');
    const bruto=s('bruto'), neto=s('neto'), ukupno=sa('ukupno');
    return {
      planCT, actCT, pctCT: planCT>0?actCT/planCT*100:0,
      planDz, celDuga, celCij, skart, pctDz: planDz>0?(celDuga+celCij+skart)/planDz*100:0,
      planLT, actLT, pctLT: planLT>0?actLT/planLT*100:0,
      planCij, ogrDugi, ogrCij, gule, pctCij: planCij>0?(ogrDugi+ogrCij+gule)/planCij*100:0,
      bruto, neto, ukupno, stepen: neto>0?ukupno/neto*100:0,
    };
  }

  // ---- DATA PROCESSING ----
  function buildRows(primke) {
    return PLAN_ENTRIES.map(entry => {
      const planKey = normKey(entry.gj+' '+entry.odjel);
      const actual = { cTrupci:0, celDuga:0, celCijepana:0, skart:0, lTrupci:0, ogrDugi:0, ogrCijepani:0, gule:0, ukupno:0 };
      primke.filter(p => normKey(p.odjel)===planKey).forEach(p => {
        switch(p.sortiment){
          case 'TRUPCI Č':    actual.cTrupci    += p.kolicina; break;
          case 'CEL.DUGA':    actual.celDuga    += p.kolicina; break;
          case 'CEL.CIJEPANA':actual.celCijepana+= p.kolicina; break;
          case 'ŠKART':       actual.skart      += p.kolicina; break;
          case 'TRUPCI L':    actual.lTrupci    += p.kolicina; break;
          case 'OGR.DUGI':    actual.ogrDugi    += p.kolicina; break;
          case 'OGR.CIJEPANI':actual.ogrCijepani+= p.kolicina; break;
          case 'GULE':        actual.gule       += p.kolicina; break;
        }
      });
      actual.ukupno = actual.cTrupci+actual.celDuga+actual.celCijepana+actual.skart+actual.lTrupci+actual.ogrDugi+actual.ogrCijepani+actual.gule;
      const stepen = entry.neto>0 ? actual.ukupno/entry.neto*100 : 0;
      const koef   = entry.bruto>0 ? entry.neto/entry.bruto*100 : 0;
      const ovr    = getOvr(entry.gj, entry.odjel);
      const status = ovr==='auto' ? deriveStatus(stepen) : ovr;
      return { ...entry, actual, stepen, koef, status, override:ovr };
    });
  }

  function buildSlucajniRows(primke) {
    const planKeys = new Set(PLAN_ENTRIES.map(e => normKey(e.gj+' '+e.odjel)));
    const unmatched = primke.filter(p => !planKeys.has(normKey(p.odjel)));
    if (!unmatched.length) return [];
    const map = new Map();
    unmatched.forEach(p => {
      if (!map.has(p.odjel)) map.set(p.odjel, { odjel:p.odjel, actual:{ cTrupci:0, celDuga:0, celCijepana:0, skart:0, lTrupci:0, ogrDugi:0, ogrCijepani:0, gule:0, ukupno:0 } });
      const r = map.get(p.odjel);
      switch(p.sortiment){
        case 'TRUPCI Č':    r.actual.cTrupci    += p.kolicina; break;
        case 'CEL.DUGA':    r.actual.celDuga    += p.kolicina; break;
        case 'CEL.CIJEPANA':r.actual.celCijepana+= p.kolicina; break;
        case 'ŠKART':       r.actual.skart      += p.kolicina; break;
        case 'TRUPCI L':    r.actual.lTrupci    += p.kolicina; break;
        case 'OGR.DUGI':    r.actual.ogrDugi    += p.kolicina; break;
        case 'OGR.CIJEPANI':r.actual.ogrCijepani+= p.kolicina; break;
        case 'GULE':        r.actual.gule       += p.kolicina; break;
      }
      r.actual.ukupno = r.actual.cTrupci+r.actual.celDuga+r.actual.celCijepana+r.actual.skart+r.actual.lTrupci+r.actual.ogrDugi+r.actual.ogrCijepani+r.actual.gule;
    });
    return Array.from(map.values()).map(r => ({
      gj: 'Slučajni užici', odjel: r.odjel, odjelLabel: shortOdjel(r.odjel),
      slucajni: true,
      bruto:0, neto:0, cTrupci:0, dzgo:0, lTrupci:0, cijepano:0,
      actual: r.actual, stepen:0, koef:0, status:'u-sjeci', override:'auto',
    }));
  }

  function getModalRows(gj, odjel) {
    const primkeForOdjel = gj === 'Slučajni užici'
      ? _rawPrimke.filter(p => p.odjel === odjel)
      : _rawPrimke.filter(p => normKey(p.odjel) === normKey(gj+' '+odjel));
    const map = new Map();
    primkeForOdjel.forEach(p=>{
      const key = p.datum+'|'+(p.primac||'')+'|'+(p.radiliste||'');
      if (!map.has(key)) map.set(key, { datum:p.datum, primac:p.primac||'', radiliste:p.radiliste||'', izvodjac:p.izvodjac||'', cTrupci:0, celDuga:0, celCijepana:0, skart:0, lTrupci:0, ogrDugi:0, ogrCijepani:0, gule:0, ukupno:0 });
      const r = map.get(key);
      switch(p.sortiment){
        case 'TRUPCI Č':    r.cTrupci    += p.kolicina; break;
        case 'CEL.DUGA':    r.celDuga    += p.kolicina; break;
        case 'CEL.CIJEPANA':r.celCijepana+= p.kolicina; break;
        case 'ŠKART':       r.skart      += p.kolicina; break;
        case 'TRUPCI L':    r.lTrupci    += p.kolicina; break;
        case 'OGR.DUGI':    r.ogrDugi    += p.kolicina; break;
        case 'OGR.CIJEPANI':r.ogrCijepani+= p.kolicina; break;
        case 'GULE':        r.gule       += p.kolicina; break;
      }
      r.ukupno = r.cTrupci+r.celDuga+r.celCijepana+r.skart+r.lTrupci+r.ogrDugi+r.ogrCijepani+r.gule;
    });
    return Array.from(map.values()).sort((a,b)=>{
      const da = a.datum.split('.').reverse().join('');
      const db = b.datum.split('.').reverse().join('');
      return da.localeCompare(db);
    });
  }

  // ---- FILTERING ----
  function filteredRows() {
    let rows = [..._rows];
    if (_gjFilter !== 'sve') rows = rows.filter(r=>r.gj===_gjFilter);
    if (_stFilter !== 'sve') rows = rows.filter(r=>r.status===_stFilter);
    if (_search.trim()) {
      const q = _search.trim().toUpperCase();
      rows = rows.filter(r=>r.odjel.toUpperCase().includes(q)||r.gj.toUpperCase().includes(q));
    }
    return rows;
  }

  function sortedWithinGj(rows, tab) {
    const { col, asc } = _sort[tab]||{ col:'odjel', asc:true };
    const dir = asc ? 1 : -1;
    const planned   = rows.filter(r => !r.slucajni);
    const slucajni  = rows.filter(r =>  r.slucajni);
    const grouped = GJ_LIST.map(gj=>({gj, rows:planned.filter(r=>r.gj===gj)}));
    if (slucajni.length) grouped.push({ gj:'Slučajni užici', rows:slucajni });
    grouped.forEach(g=>{
      g.rows.sort((a,b)=>{
        let av, bv;
        if (col==='odjel')       { av=a.odjelLabel||a.odjel; bv=b.odjelLabel||b.odjel; }
        else if (col==='neto')   { av=a.neto;    bv=b.neto; }
        else if (col==='ukupno') { av=a.actual.ukupno; bv=b.actual.ukupno; }
        else if (col==='stepen') { av=a.stepen;  bv=b.stepen; }
        else { av=a.odjelLabel||a.odjel; bv=b.odjelLabel||b.odjel; }
        if (typeof av==='string') return av.localeCompare(bv,'bs')*dir;
        return ((av||0)-(bv||0))*dir;
      });
    });
    return grouped;
  }

  function sortArrow(tab, col) {
    const s = _sort[tab];
    if (!s || s.col!==col) return '<span style="color:#9ca3af;font-size:10px;">⇅</span>';
    return s.asc ? '<span style="color:#059669;font-size:10px;">↑</span>' : '<span style="color:#059669;font-size:10px;">↓</span>';
  }

  // ---- MAIN LOAD ----
  // Filtrira raw primke array po PLAN_YEAR i renderira UI
  function _processPrimke(raw) {
    const primke = (raw||[]).filter(p=>{
      const parts=(p.datum||'').split('.');
      return parts.length>=3 && parseInt(parts[2])===PLAN_YEAR;
    });
    _rawPrimke = primke;
    _rows = [...buildRows(primke), ...buildSlucajniRows(primke)];
    _loaded = true;
    renderActiveTab();
    if (typeof markTabRendered==='function') markTabRendered('godisnji-plan');
  }

  // Vraća parsed cache iz localStorage ili null
  function _readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return (obj && obj.data) ? obj.data : null;
    } catch(e) { return null; }
  }

  async function loadGodisnjiPlan(force) {
    if (_loading) return;
    _loading = true;
    const el = document.getElementById('godisnji-plan-content');
    if (!el) { _loading=false; return; }
    el.classList.remove('hidden');

    // 🚀 TURBO: instant render iz keša (dijeli ga sa "Primke (Sječa)" preload-om)
    // Prioritet: shared key (cache_primke_sjeca) → GP-specific key (legacy)
    const sharedKey = 'cache_primke_sjeca';
    const legacyKey = 'cache_gp_primke_'+PLAN_YEAR;
    let instant = !force && (_readCache(sharedKey) || _readCache(legacyKey));
    if (instant && instant.primke) {
      try { _processPrimke(instant.primke); } catch(e) { instant = null; }
    }
    if (!instant) showLoading();

    try {
      const url = buildApiUrl('primke');
      // Fetch sa kraćim timeoutom (30s); fetchWithCache će keširati pod sharedKey-om
      const data = await fetchWithCache(url, sharedKey, force||false, 30000);
      if (data.error) throw new Error(data.error);
      _processPrimke(data.primke);
      // Cleanup legacy cache key (jednom uspješno učitano → više ne treba)
      try { localStorage.removeItem(legacyKey); } catch(e) {}
    } catch(err) {
      // Ako imamo instant render, samo logiraj — UI je već pokazan iz keša
      if (instant) {
        console.warn('[GP] refresh failed, koristim stale cache:', err.message);
      } else {
        console.error('[GP]', err);
        const v = document.getElementById('gp-'+_activeTab+'-view');
        if (v) v.innerHTML = `<div style="text-align:center;padding:60px;color:#dc2626;"><div style="font-size:32px;margin-bottom:12px;">❌</div>Greška: ${err.message}<br><br><button class="btn btn-primary" onclick="loadGodisnjiPlan(true)">Pokušaj ponovo</button></div>`;
      }
    } finally {
      _loading = false;
    }
  }

  function showLoading() {
    ['grupe','sortimenti','pregled','projekat'].forEach(t=>{
      const v = document.getElementById('gp-'+t+'-view');
      if (v && t===_activeTab) v.innerHTML = '<div style="text-align:center;padding:60px;color:#6b7280;"><div style="font-size:32px;margin-bottom:12px;">⏳</div>Učitavam podatke...</div>';
    });
  }

  // ---- TAB SWITCHING ----
  function switchGpTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('#gp-submenu .submenu-tab').forEach(b=>{
      b.classList.toggle('active', b.dataset.tab===tab);
    });
    ['grupe','sortimenti','pregled','projekat'].forEach(t=>{
      const v = document.getElementById('gp-'+t+'-view');
      if (v) v.classList.toggle('hidden', t!==tab);
    });
    if (_loaded) renderActiveTab();
    else loadGodisnjiPlan(false);
  }

  function renderActiveTab() {
    const rows = filteredRows();
    if (_activeTab==='grupe')      renderGrupe(rows);
    else if (_activeTab==='sortimenti') renderSortimenti(rows);
    else if (_activeTab==='pregled')    renderPregled(rows);
    else if (_activeTab==='projekat')   renderProjekat(rows);
  }

  // ---- RENDER: GRUPE ----
  function thSort(tab, col, label) {
    const active = _sort[tab] && _sort[tab].col === col;
    return `<th onclick="gpSort('${tab}','${col}')" style="cursor:pointer;white-space:nowrap;${active?'background:rgba(255,255,255,0.12);':''}">${label} ${sortArrow(tab,col)}</th>`;
  }

  // Border-left separators between sortiment groups (used on both th and td)
  const BL = {
    ct:  `border-left:2px solid rgba(30,64,175,0.35);`,
    dz:  `border-left:2px solid rgba(91,33,182,0.35);`,
    lt:  `border-left:2px solid rgba(21,128,61,0.35);`,
    cij: `border-left:2px solid rgba(180,83,9,0.35);`,
    tot: `border-left:2px solid rgba(71,85,105,0.4);`,
  };
  // Inline style for td cells inside dark total rows — overrides any CSS class color
  const WR = 'text-align:right;color:white;padding:6px 8px;';

  function renderGrupe(rows) {
    const view = document.getElementById('gp-grupe-view');
    if (!view) return;
    const grouped = sortedWithinGj(rows, 'grupe');
    const grand   = sumRows(rows);
    let html = `
    <div class="enterprise-card">
      <div class="enterprise-card-header">
        <div><h2>📊 Po grupama — odjeli i sortimenti</h2><span class="card-subtitle">Plan vs. ostvareno po svakom odjelu</span></div>
        <button onclick="gpExportCsv('grupe')" style="background:rgba(5,150,105,0.1);color:#059669;border:1px solid #059669;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;">📥 Export CSV</button>
      </div>
      <div class="enterprise-card-body">
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <table class="monthly-table" style="width:100%;min-width:900px;font-size:12px;border-collapse:collapse;">
      <thead>
        <tr style="background:#1e3a5f;color:white;">
          <th rowspan="2" style="width:32px;text-align:center;">#</th>
          <th rowspan="2" style="min-width:72px;text-align:left;padding-left:10px;">Odjel</th>
          <th rowspan="2" style="min-width:90px;">Status</th>
          <th colspan="2" style="background:#1e3399;text-align:center;${BL.ct}">Trupci Č</th>
          <th colspan="4" style="background:#3b1080;text-align:center;${BL.dz}">Cjepano Č</th>
          <th colspan="2" style="background:#14532d;text-align:center;${BL.lt}">Trupci L</th>
          <th colspan="4" style="background:#7c2d12;text-align:center;${BL.cij}">Cjepano L</th>
          <th rowspan="2" onclick="gpSort('grupe','neto')" style="cursor:pointer;min-width:70px;${BL.tot}">Plan m³ ${sortArrow('grupe','neto')}</th>
          <th rowspan="2" onclick="gpSort('grupe','ukupno')" style="cursor:pointer;min-width:70px;">Ostvr. m³ ${sortArrow('grupe','ukupno')}</th>
          <th rowspan="2" onclick="gpSort('grupe','stepen')" style="cursor:pointer;min-width:72px;">Stepen ${sortArrow('grupe','stepen')}</th>
        </tr>
        <tr style="background:#243b6e;color:white;font-size:11px;">
          <th style="background:#dbeafe;color:#1e40af;${BL.ct}">Plan</th>
          <th style="background:#dbeafe;color:#1e40af;">Ostvr.</th>
          <th style="background:#ede9fe;color:#5b21b6;${BL.dz}">Plan</th>
          <th style="background:#ede9fe;color:#5b21b6;">Cel.d.</th>
          <th style="background:#ede9fe;color:#6d28d9;">Cel.c.</th>
          <th style="background:#f1f5f9;color:#64748b;">Škart</th>
          <th style="background:#dcfce7;color:#166534;${BL.lt}">Plan</th>
          <th style="background:#dcfce7;color:#166534;">Ostvr.</th>
          <th style="background:#ffedd5;color:#9a3412;${BL.cij}">Plan</th>
          <th style="background:#ffedd5;color:#9a3412;">Ogr.d.</th>
          <th style="background:#ffedd5;color:#c2410c;">Ogr.c.</th>
          <th style="background:#fef9c3;color:#a16207;">Gule</th>
        </tr>
      </thead>
      <tbody>`;

    grouped.forEach(({gj, rows:gr})=>{
      if (!gr.length) return;
      const sub = sumRows(gr);
      const gjColor = GJ_COLOR[gj];
      html += gjHeaderRow(gj, 18);

      gr.forEach((r,i)=>{
        const stripe = i%2===1 ? 'background:#fafbfc;' : '';
        html += `<tr style="${stripe}border-bottom:1px solid #f1f5f9;">
          <td style="color:#cbd5e1;font-size:11px;text-align:center;padding:7px 4px;">${i+1}</td>
          <td style="padding:7px 8px;">${odjelLink(r.gj,r.odjel,r.odjelLabel)}</td>
          <td style="padding:7px 8px;white-space:nowrap;">${statusBadge(r.status)}${statusSelectHtml(r.gj,r.odjel,r.override)}</td>
          <td class="right" style="${BL.ct}color:#94a3b8;">${fmt(r.cTrupci)}</td>
          <td class="right" style="color:${C.cTrupci};font-weight:700;">${fmt(r.actual.cTrupci)}</td>
          <td class="right" style="${BL.dz}color:#94a3b8;">${fmt(r.dzgo)}</td>
          <td class="right" style="color:${C.celDuga};">${fmt(r.actual.celDuga)}</td>
          <td class="right" style="color:${C.celCijepana};">${fmt(r.actual.celCijepana)}</td>
          <td class="right" style="color:${C.skart};">${fmt(r.actual.skart)}</td>
          <td class="right" style="${BL.lt}color:#94a3b8;">${fmt(r.lTrupci)}</td>
          <td class="right" style="color:${C.lTrupci};font-weight:700;">${fmt(r.actual.lTrupci)}</td>
          <td class="right" style="${BL.cij}color:#94a3b8;">${fmt(r.cijepano)}</td>
          <td class="right" style="color:${C.ogrDugi};">${fmt(r.actual.ogrDugi)}</td>
          <td class="right" style="color:${C.ogrCijepani};">${fmt(r.actual.ogrCijepani)}</td>
          <td class="right" style="color:${C.gule};">${fmt(r.actual.gule)}</td>
          <td class="right" style="${BL.tot}font-weight:600;">${fmt(r.neto)}</td>
          <td class="right" style="font-weight:700;color:#0f172a;">${fmt(r.actual.ukupno)}</td>
          <td class="right">${realizacijaBadge(r.stepen)}</td>
        </tr>`;
      });

      html += `<tr style="${subTotalStyle(gj)}">
        <td style="padding:6px 4px;"></td>
        <td style="padding:6px 8px;color:${gjColor};font-size:11px;white-space:nowrap;">Σ ${gj.split(' ')[0]}</td>
        <td></td>
        <td class="right" style="${BL.ct}">${fmt(sub.planCT)}</td><td class="right" style="color:${C.cTrupci};">${fmt(sub.actCT)}</td>
        <td class="right" style="${BL.dz}">${fmt(sub.planDz)}</td><td class="right">${fmt(sub.celDuga)}</td><td class="right">${fmt(sub.celCij)}</td><td class="right">${fmt(sub.skart)}</td>
        <td class="right" style="${BL.lt}">${fmt(sub.planLT)}</td><td class="right" style="color:${C.lTrupci};">${fmt(sub.actLT)}</td>
        <td class="right" style="${BL.cij}">${fmt(sub.planCij)}</td><td class="right">${fmt(sub.ogrDugi)}</td><td class="right">${fmt(sub.ogrCij)}</td><td class="right">${fmt(sub.gule)}</td>
        <td class="right" style="${BL.tot}">${fmt(sub.neto)}</td>
        <td class="right" style="color:${gjColor};">${fmt(sub.ukupno)}</td>
        <td class="right">${realizacijaBadge(sub.stepen)}</td>
      </tr>`;
    });

    html += `<tr style="background:#1e293b;color:white;font-weight:700;border-top:3px solid #334155;">
      <td colspan="2" style="padding:8px 12px;color:white;">UKUPNO</td><td></td>
      <td style="${WR}${BL.ct}">${fmtN(grand.planCT)}</td><td style="${WR}">${fmtN(grand.actCT)}</td>
      <td style="${WR}${BL.dz}">${fmtN(grand.planDz)}</td><td style="${WR}">${fmtN(grand.celDuga)}</td><td style="${WR}">${fmtN(grand.celCij)}</td><td style="${WR}">${fmtN(grand.skart)}</td>
      <td style="${WR}${BL.lt}">${fmtN(grand.planLT)}</td><td style="${WR}">${fmtN(grand.actLT)}</td>
      <td style="${WR}${BL.cij}">${fmtN(grand.planCij)}</td><td style="${WR}">${fmtN(grand.ogrDugi)}</td><td style="${WR}">${fmtN(grand.ogrCij)}</td><td style="${WR}">${fmtN(grand.gule)}</td>
      <td style="${WR}${BL.tot}">${fmtN(grand.neto)}</td><td style="${WR}">${fmtN(grand.ukupno)}</td><td style="text-align:right;padding:6px 8px;">${realizacijaBadge(grand.stepen)}</td>
    </tr>
    </tbody></table></div>
    <p style="margin-top:10px;font-size:11px;color:#94a3b8;padding:0 4px;">
      Cjepano Č plan = Cel.duga + Cel.cijepana + Škart &nbsp;·&nbsp; Cjepano L plan = Ogr.dugo + Ogr.cijepano + Gule
    </p>
    </div></div>`;

    view.innerHTML = html;
  }

  // ---- RENDER: SORTIMENTI ----
  function renderSortimenti(rows) {
    const view = document.getElementById('gp-sortimenti-view');
    if (!view) return;
    const grand = sumRows(rows);
    const grouped = sortedWithinGj(rows, 'sortimenti');

    // KPI cards
    const cards = [
      { lbl:'Trupci Č',  plan:grand.planCT,  act:grand.actCT,  pct:grand.pctCT,  col:C.cTrupci  },
      { lbl:'Cjepano Č', plan:grand.planDz,  act:grand.celDuga+grand.celCij+grand.skart, pct:grand.pctDz, col:C.celDuga },
      { lbl:'Trupci L',  plan:grand.planLT,  act:grand.actLT,  pct:grand.pctLT,  col:C.lTrupci  },
      { lbl:'Cjepano L', plan:grand.planCij, act:grand.ogrDugi+grand.ogrCij+grand.gule, pct:grand.pctCij, col:C.ogrCijepani },
    ];

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px;">';
    cards.forEach(({lbl,plan,act,pct,col})=>{
      const ost = Math.max(0, plan-act);
      html += `<div class="section" style="padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:14px;font-weight:700;color:#374151;">${lbl}</span>
          ${realizacijaBadge(pct)}
        </div>
        <div style="font-size:22px;font-weight:800;color:${col};">${fmtN(act)} <span style="font-size:13px;font-weight:400;color:#6b7280;">m³</span></div>
        <div style="font-size:12px;color:#6b7280;margin:4px 0;">od ${fmtN(plan)} m³ plana</div>
        ${bar2(pct, col)}
        <div style="font-size:11px;color:#9ca3af;margin-top:6px;">Ostalo: ${fmtN(ost)} m³</div>
      </div>`;
    });
    html += '</div>';

    // Ukupna realizacija card
    html += `<div class="section" style="margin-bottom:24px;">
      <h2 style="font-size:16px;margin-bottom:12px;">📈 Ukupna realizacija godišnjeg plana ${PLAN_YEAR}</h2>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
        <div><span style="font-size:13px;color:#6b7280;">Plan neto: </span><strong>${fmtN(grand.neto)} m³</strong></div>
        <div><span style="font-size:13px;color:#6b7280;">Ostvareno: </span><strong style="color:#059669;">${fmtN(grand.ukupno)} m³</strong></div>
        ${realizacijaBadge(grand.stepen)}
      </div>
      <div style="height:10px;background:#e5e7eb;border-radius:5px;margin-bottom:16px;"><div style="height:100%;width:${Math.min(100,grand.stepen).toFixed(1)}%;background:#059669;border-radius:5px;transition:width 0.4s;"></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
        ${cards.map(({lbl,pct,col})=>`<div style="font-size:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:#374151;">${lbl}</span><span style="color:${col};font-weight:700;">${pct.toFixed(1)}%</span></div>
          ${bar2(pct,col)}
        </div>`).join('')}
      </div>
    </div>`;

    // Chart
    html += `<div class="section" style="margin-bottom:24px;">
      <h2 style="font-size:16px;margin-bottom:12px;">📊 Top 20 odjela — % realizacije po sortimentima</h2>
      <div style="position:relative;height:520px;"><canvas id="gp-sort-chart"></canvas></div>
    </div>`;

    // Table
    html += `<div class="enterprise-card">
      <div class="enterprise-card-header">
        <div><h2>📋 Tabela realizacije po odjelima</h2></div>
        <button onclick="gpExportCsv('sortimenti')" style="background:rgba(5,150,105,0.1);color:#059669;border:1px solid #059669;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;">📥 Export CSV</button>
      </div>
      <div class="enterprise-card-body">
      <div style="overflow-x:auto;">
      <table class="monthly-table" style="width:100%;font-size:12px;">
      <thead><tr>
        <th>#</th><th style="text-align:left;">GJ</th>
        ${thSort('sortimenti','odjel','Odjel')}
        <th>Status</th>
        ${thSort('sortimenti','koef','Koef.')}
        ${thSort('sortimenti','neto','Plan m³')}
        ${thSort('sortimenti','ukupno','Ostvr. m³')}
        ${thSort('sortimenti','stepen','Stepen')}
        <th>Trupci Č %</th><th>Cjepano Č %</th><th>Trupci L %</th><th>Cjepano L %</th>
        <th>Progres</th>
      </tr></thead><tbody>`;

    let rowNum = 0;
    grouped.forEach(({gj, rows:gr})=>{
      if (!gr.length) return;
      const sub = sumRows(gr);
      html += gjHeaderRow(gj, 13);
      gr.forEach((r,i)=>{
        rowNum++;
        const pctCT  = r.cTrupci>0?r.actual.cTrupci/r.cTrupci*100:null;
        const pctDz  = r.dzgo>0?dzgoAct(r.actual)/r.dzgo*100:null;
        const pctLT  = r.lTrupci>0?r.actual.lTrupci/r.lTrupci*100:null;
        const pctCij = r.cijepano>0?cijAct(r.actual)/r.cijepano*100:null;
        const stripe = i%2===1 ? 'background:#fafbfc;' : '';
        html += `<tr style="${stripe}border-bottom:1px solid #f1f5f9;">
          <td style="color:#cbd5e1;font-size:11px;text-align:center;padding:7px 4px;">${rowNum}</td>
          <td style="padding:7px 8px;">${gjBadge(gj)}</td>
          <td style="padding:7px 8px;">${odjelLink(r.gj,r.odjel,r.odjelLabel)}</td>
          <td style="padding:7px 8px;">${statusBadge(r.status)}</td>
          <td class="right" style="color:${koefColor(r.koef)};font-weight:600;padding:7px 8px;">${r.koef.toFixed(1)}%</td>
          <td class="right" style="padding:7px 8px;">${fmt(r.neto)}</td>
          <td class="right" style="font-weight:600;padding:7px 8px;">${fmt(r.actual.ukupno)}</td>
          <td class="right" style="padding:7px 8px;">${realizacijaBadge(r.stepen)}</td>
          <td class="right" style="padding:7px 8px;">${pctCT!=null?realizacijaBadge(pctCT):'<span style="color:#9ca3af">—</span>'}</td>
          <td class="right" style="padding:7px 8px;">${pctDz!=null?realizacijaBadge(pctDz):'<span style="color:#9ca3af">—</span>'}</td>
          <td class="right" style="padding:7px 8px;">${pctLT!=null?realizacijaBadge(pctLT):'<span style="color:#9ca3af">—</span>'}</td>
          <td class="right" style="padding:7px 8px;">${pctCij!=null?realizacijaBadge(pctCij):'<span style="color:#9ca3af">—</span>'}</td>
          <td style="padding:7px 8px;">${bar2(r.stepen,'#059669')}</td>
        </tr>`;
      });
      html += `<tr style="${subTotalStyle(gj)}">
        <td style="padding:6px 4px;"></td><td style="padding:6px 8px;">${gjBadge(gj)}</td>
        <td style="padding:6px 8px;color:${GJ_COLOR[gj]};font-size:11px;">Σ ${gj.split(' ')[0]}</td><td></td><td></td>
        <td class="right" style="padding:6px 8px;">${fmt(sub.neto)}</td>
        <td class="right" style="padding:6px 8px;color:${GJ_COLOR[gj]};">${fmt(sub.ukupno)}</td>
        <td class="right" style="padding:6px 8px;">${realizacijaBadge(sub.stepen)}</td>
        <td class="right" style="padding:6px 8px;">${realizacijaBadge(sub.pctCT)}</td>
        <td class="right" style="padding:6px 8px;">${realizacijaBadge(sub.pctDz)}</td>
        <td class="right" style="padding:6px 8px;">${realizacijaBadge(sub.pctLT)}</td>
        <td class="right" style="padding:6px 8px;">${realizacijaBadge(sub.pctCij)}</td>
        <td></td>
      </tr>`;
    });

    html += `<tr style="background:#1e293b;color:white;font-weight:700;">
      <td colspan="2" style="color:white;padding:6px 8px;">UKUPNO</td><td></td><td></td><td></td>
      <td style="${WR}">${fmtN(grand.neto)}</td><td style="${WR}">${fmtN(grand.ukupno)}</td>
      <td style="text-align:right;padding:6px 8px;">${realizacijaBadge(grand.stepen)}</td>
      <td style="text-align:right;padding:6px 8px;">${realizacijaBadge(grand.pctCT)}</td>
      <td style="text-align:right;padding:6px 8px;">${realizacijaBadge(grand.pctDz)}</td>
      <td style="text-align:right;padding:6px 8px;">${realizacijaBadge(grand.pctLT)}</td>
      <td style="text-align:right;padding:6px 8px;">${realizacijaBadge(grand.pctCij)}</td>
      <td></td>
    </tr></tbody></table></div></div></div>`;

    view.innerHTML = html;

    // Render chart after DOM update
    requestAnimationFrame(()=>renderSortChart(rows));
  }

  function renderSortChart(rows) {
    if (typeof window.loadChartJs !== 'function') return;
    window.loadChartJs().then(()=>{
      const canvas = document.getElementById('gp-sort-chart');
      if (!canvas) return;
      if (_gpChart) { _gpChart.destroy(); _gpChart=null; }

      const top20 = [...rows].sort((a,b)=>a.stepen-b.stepen).slice(0,20);
      const labels = top20.map(r=>r.odjel+' ('+r.gj.split(' ')[0]+')');
      const pctCT  = top20.map(r=>r.cTrupci>0?+(r.actual.cTrupci/r.cTrupci*100).toFixed(1):0);
      const pctDz  = top20.map(r=>r.dzgo>0?+(dzgoAct(r.actual)/r.dzgo*100).toFixed(1):0);
      const pctLT  = top20.map(r=>r.lTrupci>0?+(r.actual.lTrupci/r.lTrupci*100).toFixed(1):0);
      const pctCij = top20.map(r=>r.cijepano>0?+(cijAct(r.actual)/r.cijepano*100).toFixed(1):0);

      _gpChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label:'Trupci Č',  data:pctCT,  backgroundColor:C.cTrupci+'cc',  borderWidth:0 },
            { label:'Cjepano Č', data:pctDz,  backgroundColor:C.celDuga+'cc',  borderWidth:0 },
            { label:'Trupci L',  data:pctLT,  backgroundColor:C.lTrupci+'cc',  borderWidth:0 },
            { label:'Cjepano L', data:pctCij, backgroundColor:C.ogrCijepani+'cc', borderWidth:0 },
          ],
        },
        options: {
          indexAxis:'y',
          responsive:true, maintainAspectRatio:false,
          plugins: {
            legend:{ position:'top', labels:{ boxWidth:12, font:{ size:12 } } },
            tooltip:{ callbacks:{ label: ctx=>`${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}%` } },
          },
          scales: {
            x:{ title:{ display:true, text:'% realizacije' }, ticks:{ callback: v=>v+'%' }, max:150 },
            y:{ ticks:{ font:{ size:11 } } },
          },
        },
        plugins: [{
          afterDraw(chart) {
            const ctx = chart.ctx;
            const x100 = chart.scales.x.getPixelForValue(100);
            if (!x100) return;
            ctx.save();
            ctx.strokeStyle='#dc2626'; ctx.lineWidth=2; ctx.setLineDash([6,3]);
            ctx.beginPath(); ctx.moveTo(x100, chart.chartArea.top); ctx.lineTo(x100, chart.chartArea.bottom); ctx.stroke();
            ctx.restore();
          }
        }],
      });
    });
  }

  // ---- RENDER: PREGLED ----
  function renderPregled(rows) {
    const view = document.getElementById('gp-pregled-view');
    if (!view) return;
    const grouped = sortedWithinGj(rows, 'pregled');
    const grand   = sumRows(rows);

    let html = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
      <span style="font-size:13px;font-weight:600;color:#374151;">Legenda:</span>
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;"><span style="width:14px;height:14px;background:#dcfce7;border:1px solid #86efac;border-radius:3px;display:inline-block;"></span>Posječeno</span>
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;"><span style="width:14px;height:14px;background:#fef3c7;border:1px solid #fcd34d;border-radius:3px;display:inline-block;"></span>U sječi</span>
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;"><span style="width:14px;height:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:3px;display:inline-block;"></span>Planirano</span>
    </div>
    <div class="enterprise-card">
      <div class="enterprise-card-header">
        <div><h2>📋 Pregled plana sječe ${PLAN_YEAR}</h2></div>
        <button onclick="gpExportCsv('pregled')" style="background:rgba(5,150,105,0.1);color:#059669;border:1px solid #059669;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;">📥 Export CSV</button>
      </div>
      <div class="enterprise-card-body">
      <div style="overflow-x:auto;">
      <table class="monthly-table" style="width:100%;font-size:12px;">
      <thead><tr>
        <th>Rb.</th>
        ${thSort('pregled','odjel','Odjel')}
        ${thSort('pregled','neto','Bruto m³')}
        <th class="right">Neto m³</th>
        <th class="right">Trupci Č</th>
        <th class="right">Cjepano Č</th>
        <th class="right">Trupci L</th>
        <th class="right">Cjepano L</th>
        <th>Status</th>
      </tr></thead><tbody>`;

    let rowNum=0;
    grouped.forEach(({gj, rows:gr})=>{
      if (!gr.length) return;
      const sub = sumRows(gr);
      html += gjHeaderRow(gj, 9);
      gr.forEach((r,i)=>{
        rowNum++;
        const rowBg = r.status==='posjeceno'?'background:#f0fdf4;':r.status==='u-sjeci'?'background:#fffbeb;':i%2===1?'background:#fafbfc;':'';
        html += `<tr style="${rowBg}border-bottom:1px solid #f1f5f9;">
          <td style="color:#cbd5e1;font-size:11px;text-align:center;padding:7px 4px;">${rowNum}</td>
          <td style="padding:7px 8px;">${odjelLink(r.gj,r.odjel,r.odjelLabel)}</td>
          <td class="right" style="padding:7px 8px;">${fmt(r.bruto)}</td>
          <td class="right" style="padding:7px 8px;">${fmt(r.neto)}</td>
          <td class="right" style="padding:7px 8px;color:${C.cTrupci};">${r.cTrupci?fmt(r.cTrupci):'—'}</td>
          <td class="right" style="padding:7px 8px;color:${C.celDuga};">${r.dzgo?fmt(r.dzgo):'—'}</td>
          <td class="right" style="padding:7px 8px;color:${C.lTrupci};">${r.lTrupci?fmt(r.lTrupci):'—'}</td>
          <td class="right" style="padding:7px 8px;color:${C.ogrCijepani};">${r.cijepano?fmt(r.cijepano):'—'}</td>
          <td style="padding:7px 8px;">${statusBadge(r.status)}</td>
        </tr>`;
      });
      html += `<tr style="${subTotalStyle(gj)}">
        <td style="padding:6px 4px;"></td>
        <td style="padding:6px 8px;color:${GJ_COLOR[gj]};font-size:11px;">Σ ${gj.split(' ')[0]}</td>
        <td class="right" style="padding:6px 8px;">${fmt(sub.bruto)}</td>
        <td class="right" style="padding:6px 8px;">${fmt(sub.neto)}</td>
        <td class="right" style="padding:6px 8px;color:${C.cTrupci};">${fmt(sub.planCT)}</td>
        <td class="right" style="padding:6px 8px;color:${C.celDuga};">${fmt(sub.planDz)}</td>
        <td class="right" style="padding:6px 8px;color:${C.lTrupci};">${fmt(sub.planLT)}</td>
        <td class="right" style="padding:6px 8px;color:${C.ogrCijepani};">${fmt(sub.planCij)}</td>
        <td></td>
      </tr>`;
    });

    html += `<tr style="background:#1e293b;color:white;font-weight:700;">
      <td colspan="2" style="color:white;padding:6px 8px;">UKUPNO</td>
      <td style="${WR}">${fmtN(grand.bruto)}</td><td style="${WR}">${fmtN(grand.neto)}</td>
      <td style="${WR}">${fmtN(grand.planCT)}</td>
      <td style="${WR}">${fmtN(grand.planDz)}</td>
      <td style="${WR}">${fmtN(grand.planLT)}</td>
      <td style="${WR}">${fmtN(grand.planCij)}</td>
      <td></td>
    </tr></tbody></table></div></div></div>`;

    view.innerHTML = html;
  }

  // ---- RENDER: PROJEKAT ----
  function renderProjekat(rows) {
    const view = document.getElementById('gp-projekat-view');
    if (!view) return;
    const grouped = sortedWithinGj(rows, 'projekat');
    const grand   = sumRows(rows);

    let html = `
    <div class="enterprise-card">
      <div class="enterprise-card-header">
        <div><h2>📐 Plan po projektu ${PLAN_YEAR}</h2><span class="card-subtitle">Projekat vs. Sječa po odjelima</span></div>
        <button onclick="gpExportCsv('projekat')" style="background:rgba(5,150,105,0.1);color:#059669;border:1px solid #059669;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;">📥 Export CSV</button>
      </div>
      <div class="enterprise-card-body">
      <div style="overflow-x:auto;">
      <table class="monthly-table" style="width:100%;font-size:12px;min-width:640px;">
      <thead><tr>
        <th>Rb.</th><th style="text-align:left;">Odjel</th><th>Stavka</th>
        <th class="right">Trupci Č</th><th class="right">Cjepano Č</th>
        <th class="right">Trupci L</th><th class="right">Cjepano L</th>
        <th class="right">Ukupno m³</th><th>Stepen</th>
      </tr></thead><tbody>`;

    let odjelNum=0;
    grouped.forEach(({gj, rows:gr})=>{
      if (!gr.length) return;
      const sub = sumRows(gr);
      const gjCol = GJ_COLOR[gj];
      const gjBg  = GJ_BG[gj];
      html += gjHeaderRow(gj, 9);
      gr.forEach((r,i)=>{
        odjelNum++;
        const dzA=dzgoAct(r.actual), cjA=cijAct(r.actual);
        const R = 'text-align:right;padding:7px 10px;';
        html += `
        <tr style="background:#eff6ff;">
          <td rowspan="2" style="color:#94a3b8;font-size:11px;text-align:center;vertical-align:middle;padding:8px 4px;border-left:3px solid ${gjCol}44;">${odjelNum}</td>
          <td rowspan="2" style="vertical-align:middle;padding:8px 10px;background:#f0f4ff;">${odjelLink(r.gj,r.odjel,r.odjelLabel)}</td>
          <td style="color:#1d4ed8;font-size:11px;font-weight:700;white-space:nowrap;padding:8px 10px;border-left:3px solid #93c5fd;background:#dbeafe44;">📐 Plan</td>
          <td style="${R}color:#475569;">${fmt(r.cTrupci)}</td>
          <td style="${R}color:#475569;">${fmt(r.dzgo)}</td>
          <td style="${R}color:#475569;">${fmt(r.lTrupci)}</td>
          <td style="${R}color:#475569;">${fmt(r.cijepano)}</td>
          <td style="${R}color:#1e40af;font-weight:700;">${fmt(r.neto)}</td>
          <td style="padding:8px 6px;"></td>
        </tr>
        <tr style="background:#f0fdf4;border-bottom:2px solid #e2e8f0;">
          <td style="color:#166534;font-size:11px;font-weight:700;white-space:nowrap;padding:8px 10px;border-left:3px solid #86efac;background:#bbf7d044;">🪓 Sječa</td>
          <td style="${R}color:${C.cTrupci};font-weight:700;">${fmt(r.actual.cTrupci)}</td>
          <td style="${R}color:${C.celDuga};font-weight:700;">${fmt(dzA)}</td>
          <td style="${R}color:${C.lTrupci};font-weight:700;">${fmt(r.actual.lTrupci)}</td>
          <td style="${R}color:${C.ogrCijepani};font-weight:700;">${fmt(cjA)}</td>
          <td style="${R}color:#059669;font-weight:800;">${fmt(r.actual.ukupno)}</td>
          <td style="padding:8px 6px;">${realizacijaBadge(r.stepen)}</td>
        </tr>`;
      });

      const dzSub=sub.celDuga+sub.celCij+sub.skart, cjSub=sub.ogrDugi+sub.ogrCij+sub.gule;
      const SR = `text-align:right;padding:6px 10px;`;
      html += `
      <tr style="background:${gjBg};border-top:2px solid ${gjCol}40;font-weight:700;font-size:11px;">
        <td rowspan="2" style="color:${gjCol};vertical-align:middle;padding:6px 4px;text-align:center;">Σ</td>
        <td rowspan="2" style="color:${gjCol};font-weight:700;vertical-align:middle;padding:6px 10px;">${gj.split(' ')[0]}</td>
        <td style="color:#1d4ed8;padding:6px 10px;border-left:3px solid #93c5fd;">Projekat</td>
        <td style="${SR}color:#475569;">${fmt(sub.planCT)}</td>
        <td style="${SR}color:#475569;">${fmt(sub.planDz)}</td>
        <td style="${SR}color:#475569;">${fmt(sub.planLT)}</td>
        <td style="${SR}color:#475569;">${fmt(sub.planCij)}</td>
        <td style="${SR}color:#1e40af;">${fmt(sub.neto)}</td><td></td>
      </tr>
      <tr style="background:${gjBg};border-bottom:3px solid ${gjCol}60;font-weight:700;font-size:11px;">
        <td style="color:#166534;padding:6px 10px;border-left:3px solid #86efac;">Sječa</td>
        <td style="${SR}color:${C.cTrupci};">${fmt(sub.actCT)}</td>
        <td style="${SR}color:${C.celDuga};">${fmt(dzSub)}</td>
        <td style="${SR}color:${C.lTrupci};">${fmt(sub.actLT)}</td>
        <td style="${SR}color:${C.ogrCijepani};">${fmt(cjSub)}</td>
        <td style="${SR}color:${gjCol};font-weight:800;">${fmt(sub.ukupno)}</td>
        <td style="padding:6px 6px;">${realizacijaBadge(sub.stepen)}</td>
      </tr>`;
    });

    const grandDz=grand.celDuga+grand.celCij+grand.skart, grandCj=grand.ogrDugi+grand.ogrCij+grand.gule;
    html += `
    <tr style="background:#1e293b;color:white;font-weight:700;">
      <td rowspan="2" style="color:white;padding:6px 8px;text-align:center;vertical-align:middle;">Σ</td>
      <td rowspan="2" style="color:white;padding:6px 8px;vertical-align:middle;">UKUPNO</td>
      <td style="color:#93c5fd;padding:6px 8px;border-left:3px solid #60a5fa;">Projekat</td>
      <td style="${WR}">${fmtN(grand.planCT)}</td><td style="${WR}">${fmtN(grand.planDz)}</td>
      <td style="${WR}">${fmtN(grand.planLT)}</td><td style="${WR}">${fmtN(grand.planCij)}</td>
      <td style="${WR}">${fmtN(grand.neto)}</td><td></td>
    </tr>
    <tr style="background:#1e293b;color:white;font-weight:700;">
      <td style="color:#86efac;padding:6px 8px;border-left:3px solid #4ade80;">Sječa</td>
      <td style="${WR}">${fmtN(grand.actCT)}</td><td style="${WR}">${fmtN(grandDz)}</td>
      <td style="${WR}">${fmtN(grand.actLT)}</td><td style="${WR}">${fmtN(grandCj)}</td>
      <td style="${WR}color:#86efac;">${fmtN(grand.ukupno)}</td>
      <td style="padding:6px 8px;">${realizacijaBadge(grand.stepen)}</td>
    </tr>
    </tbody></table></div></div></div>`;

    // Rekapitulacija
    html += `<div class="section" style="margin-top:24px;">
      <h2 style="font-size:15px;margin-bottom:12px;">📊 Rekapitulacija po GJ</h2>
      <div style="overflow-x:auto;"><table class="monthly-table" style="width:100%;font-size:12px;">
      <thead><tr>
        <th style="text-align:left;">Gazdinska jedinica</th>
        <th class="right">Projekat m³</th><th class="right">Sječa m³</th>
        <th class="right">Stepen</th><th class="right">Ostalo m³</th>
        <th>Realizacija</th>
      </tr></thead><tbody>`;

    GJ_LIST.forEach(gj=>{
      const gjRows = rows.filter(r=>r.gj===gj);
      if (!gjRows.length) return;
      const sub = sumRows(gjRows);
      const ost = Math.max(0, sub.neto - sub.ukupno);
      html += `<tr>
        <td><span style="display:inline-block;width:12px;height:12px;background:${GJ_COLOR[gj]};border-radius:2px;margin-right:6px;vertical-align:middle;"></span><strong>${gj}</strong></td>
        <td class="right">${fmt(sub.neto)}</td>
        <td class="right" style="color:#059669;font-weight:600;">${fmt(sub.ukupno)}</td>
        <td class="right">${realizacijaBadge(sub.stepen)}</td>
        <td class="right" style="color:#9ca3af;">${fmt(ost)}</td>
        <td style="min-width:120px;">${bar2(sub.stepen, GJ_COLOR[gj])}</td>
      </tr>`;
    });

    html += `<tr style="background:#1e293b;color:white;font-weight:700;">
      <td style="color:white;padding:6px 8px;">UKUPNO</td>
      <td style="${WR}">${fmtN(grand.neto)}</td>
      <td style="${WR}color:#86efac;">${fmtN(grand.ukupno)}</td>
      <td style="text-align:right;padding:6px 8px;">${realizacijaBadge(grand.stepen)}</td>
      <td style="${WR}color:#94a3b8;">${fmtN(Math.max(0,grand.neto-grand.ukupno))}</td><td></td>
    </tr>
    </tbody></table></div></div>`;

    view.innerHTML = html;
  }

  // ---- ODJEL DETAIL MODAL ----
  function openOdjelModal(gj, odjel) {
    const modal = document.getElementById('gp-odjel-modal');
    if (!modal) return;
    const rows = getModalRows(gj, odjel);
    const planRow = _rows.find(r=>r.gj===gj&&r.odjel===odjel);

    document.getElementById('gp-modal-title').innerHTML =
      `${gjBadge(gj)} &nbsp; Odjel ${odjel} &nbsp; <span style="font-size:13px;font-weight:400;color:#9ca3af;">${rows.length} primka zapisa</span>`;
    document.getElementById('gp-modal-ukupno').textContent = planRow ? fmtN(planRow.actual.ukupno)+' m³ ostvareno' : '';

    let tbody = '';
    let totals = { cTrupci:0, celDuga:0, celCijepana:0, skart:0, lTrupci:0, ogrDugi:0, ogrCijepani:0, gule:0, ukupno:0 };
    if (rows.length===0) {
      tbody = '<tr><td colspan="11" style="text-align:center;padding:30px;color:#6b7280;">Nema primka zapisa za ovaj odjel.</td></tr>';
    } else {
      rows.forEach(r=>{
        Object.keys(totals).forEach(k=>{ totals[k]+=(r[k]||0); });
        tbody += `<tr>
          <td style="white-space:nowrap;font-size:11px;">${formatDay(r.datum)}</td>
          <td style="font-size:11px;">${r.primac||'—'}</td>
          <td style="font-size:11px;">${r.radiliste||'—'}</td>
          <td class="right" style="color:${C.cTrupci};">${fmt(r.cTrupci)}</td>
          <td class="right" style="color:${C.celDuga};">${fmt(r.celDuga)}</td>
          <td class="right" style="color:${C.celCijepana};">${fmt(r.celCijepana)}</td>
          <td class="right" style="color:${C.skart};">${fmt(r.skart)}</td>
          <td class="right" style="color:${C.lTrupci};">${fmt(r.lTrupci)}</td>
          <td class="right" style="color:${C.ogrDugi};">${fmt(r.ogrDugi)}</td>
          <td class="right" style="color:${C.ogrCijepani};">${fmt(r.ogrCijepani)}</td>
          <td class="right" style="color:${C.gule};">${fmt(r.gule)}</td>
          <td class="right" style="font-weight:600;">${fmt(r.ukupno)}</td>
        </tr>`;
      });
      tbody += `<tr style="background:#1e293b;color:white;font-weight:700;font-size:11px;">
        <td colspan="3">UKUPNO (${rows.length} primki)</td>
        <td class="right">${fmtN(totals.cTrupci)}</td>
        <td class="right">${fmtN(totals.celDuga)}</td>
        <td class="right">${fmtN(totals.celCijepana)}</td>
        <td class="right">${fmtN(totals.skart)}</td>
        <td class="right">${fmtN(totals.lTrupci)}</td>
        <td class="right">${fmtN(totals.ogrDugi)}</td>
        <td class="right">${fmtN(totals.ogrCijepani)}</td>
        <td class="right">${fmtN(totals.gule)}</td>
        <td class="right">${fmtN(totals.ukupno)}</td>
      </tr>`;
    }
    document.getElementById('gp-modal-tbody').innerHTML = tbody;

    // Store for CSV
    modal._gjOdjel = { gj, odjel, rows };

    modal.style.display = 'flex';
    document.addEventListener('keydown', _closeModalOnEsc);
  }

  function closeOdjelModal() {
    const modal = document.getElementById('gp-odjel-modal');
    if (modal) modal.style.display = 'none';
    document.removeEventListener('keydown', _closeModalOnEsc);
  }

  function _closeModalOnEsc(e) { if (e.key==='Escape') closeOdjelModal(); }

  function exportModalCsv() {
    const modal = document.getElementById('gp-odjel-modal');
    if (!modal||!modal._gjOdjel) return;
    const { gj, odjel, rows } = modal._gjOdjel;
    const header = 'Datum,Primac,Radiliste,Trupci C,Cel.Duga,Cel.Cijepana,Skart,Trupci L,Ogr.Dugi,Ogr.Cijepani,Gule,Ukupno';
    const body = rows.map(r=>[r.datum,r.primac,r.radiliste,r.cTrupci,r.celDuga,r.celCijepana,r.skart,r.lTrupci,r.ogrDugi,r.ogrCijepani,r.gule,r.ukupno].join(',')).join('\n');
    downloadCsv(header+'\n'+body, 'Odjel_'+odjel+'_primke.csv');
  }

  // ---- PRINT MODAL ----
  function openPrintModal() {
    const modal = document.getElementById('gp-print-modal');
    if (!modal) return;
    const rows = filteredRows();
    const grand = sumRows(rows);
    const grouped = GJ_LIST.map(gj=>({ gj, rows:rows.filter(r=>r.gj===gj) }));

    let paperHtml = `
    <div style="font-family:Arial,sans-serif;color:#1f2937;">
      <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #1e293b;padding-bottom:16px;">
        <h1 style="font-size:20px;margin:0 0 6px;">GODIŠNJI PLAN SJEČE ${PLAN_YEAR}</h1>
        <h2 style="font-size:15px;font-weight:400;margin:0 0 6px;">Pogon Bosanska Krupa</h2>
        <span style="font-size:12px;color:#6b7280;">Datum štampe: ${new Date().toLocaleDateString('bs-BA')}</span>
      </div>`;

    grouped.forEach(({ gj, rows:gr })=>{
      if (!gr.length) return;
      const sub = sumRows(gr);
      paperHtml += `
      <h3 style="font-size:13px;color:${GJ_COLOR[gj]};margin:20px 0 8px;">${gj}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px;">
        <thead><tr style="background:#1e293b;color:white;">
          <th style="padding:5px;text-align:left;">Rb.</th>
          <th style="padding:5px;text-align:left;">Odjel</th>
          <th style="padding:5px;">Bruto</th><th style="padding:5px;">Neto</th>
          <th style="padding:5px;">Tr.Č</th><th style="padding:5px;">Cjep.Č</th>
          <th style="padding:5px;">Tr.L</th><th style="padding:5px;">Cjep.L</th>
          <th style="padding:5px;">Ostvr.</th><th style="padding:5px;">Stepen</th><th style="padding:5px;">Status</th>
        </tr></thead><tbody>`;
      gr.forEach((r,i)=>{
        paperHtml += `<tr style="border-bottom:1px solid #e5e7eb;${i%2?'background:#f9fafb':''}">
          <td style="padding:4px 5px;">${i+1}</td>
          <td style="padding:4px 5px;font-weight:600;">${r.odjel}</td>
          <td style="padding:4px 5px;text-align:right;">${fmtN(r.bruto)}</td>
          <td style="padding:4px 5px;text-align:right;">${fmtN(r.neto)}</td>
          <td style="padding:4px 5px;text-align:right;">${r.cTrupci?fmtN(r.cTrupci):'—'}</td>
          <td style="padding:4px 5px;text-align:right;">${r.dzgo?fmtN(r.dzgo):'—'}</td>
          <td style="padding:4px 5px;text-align:right;">${r.lTrupci?fmtN(r.lTrupci):'—'}</td>
          <td style="padding:4px 5px;text-align:right;">${r.cijepano?fmtN(r.cijepano):'—'}</td>
          <td style="padding:4px 5px;text-align:right;font-weight:600;">${fmtN(r.actual.ukupno)}</td>
          <td style="padding:4px 5px;text-align:right;">${r.stepen.toFixed(1)}%</td>
          <td style="padding:4px 5px;">${r.status==='posjeceno'?'✅ Posj.':r.status==='u-sjeci'?'🔄 U sj.':'📋 Plan.'}</td>
        </tr>`;
      });
      paperHtml += `<tr style="background:#f0fdf4;font-weight:700;">
        <td colspan="2" style="padding:4px 5px;">Σ ${gj}</td>
        <td style="padding:4px 5px;text-align:right;">${fmtN(sub.bruto)}</td>
        <td style="padding:4px 5px;text-align:right;">${fmtN(sub.neto)}</td>
        <td style="padding:4px 5px;text-align:right;">${fmtN(sub.planCT)}</td>
        <td style="padding:4px 5px;text-align:right;">${fmtN(sub.planDz)}</td>
        <td style="padding:4px 5px;text-align:right;">${fmtN(sub.planLT)}</td>
        <td style="padding:4px 5px;text-align:right;">${fmtN(sub.planCij)}</td>
        <td style="padding:4px 5px;text-align:right;">${fmtN(sub.ukupno)}</td>
        <td style="padding:4px 5px;text-align:right;">${sub.stepen.toFixed(1)}%</td>
        <td></td>
      </tr></tbody></table>`;
    });

    paperHtml += `
      <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:12px;">
        <tr style="background:#1e293b;color:white;font-weight:700;">
          <td colspan="2" style="padding:6px 8px;">GRAND TOTAL</td>
          <td style="padding:6px 8px;text-align:right;">${fmtN(grand.bruto)}</td>
          <td style="padding:6px 8px;text-align:right;">${fmtN(grand.neto)}</td>
          <td style="padding:6px 8px;text-align:right;">${fmtN(grand.planCT)}</td>
          <td style="padding:6px 8px;text-align:right;">${fmtN(grand.planDz)}</td>
          <td style="padding:6px 8px;text-align:right;">${fmtN(grand.planLT)}</td>
          <td style="padding:6px 8px;text-align:right;">${fmtN(grand.planCij)}</td>
          <td style="padding:6px 8px;text-align:right;">${fmtN(grand.ukupno)}</td>
          <td style="padding:6px 8px;text-align:right;">${grand.stepen.toFixed(1)}%</td>
          <td></td>
        </tr>
      </table>
      <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;font-size:11px;">
        <div style="border-top:1px solid #9ca3af;padding-top:6px;">Izradio: ____________________</div>
        <div style="border-top:1px solid #9ca3af;padding-top:6px;">Odobrio: ____________________</div>
      </div>
    </div>`;

    document.getElementById('gp-print-paper').innerHTML = paperHtml;
    modal.style.display = 'flex';
  }

  function closePrintModal() {
    const modal = document.getElementById('gp-print-modal');
    if (modal) modal.style.display = 'none';
  }

  function doPrint() { window.print(); }

  // ---- CSV EXPORT ----
  function gpExportCsv(tab) {
    const rows = filteredRows();
    let lines = [];
    if (tab==='grupe'||tab==='pregled') {
      lines.push(['GJ','Odjel','Bruto','Neto','Trupci C plan','Cjepano C plan','Trupci L plan','Cjepano L plan','Act.Trupci C','Act.Cel.D','Act.Cel.C','Act.Skart','Act.Trupci L','Act.Ogr.D','Act.Ogr.C','Act.Gule','Ostvareno','Stepen %','Status'].join(','));
      rows.forEach(r=>lines.push([r.gj,r.odjel,r.bruto,r.neto,r.cTrupci,r.dzgo,r.lTrupci,r.cijepano,r.actual.cTrupci,r.actual.celDuga,r.actual.celCijepana,r.actual.skart,r.actual.lTrupci,r.actual.ogrDugi,r.actual.ogrCijepani,r.actual.gule,Math.round(r.actual.ukupno),r.stepen.toFixed(1),r.status].join(',')));
    } else if (tab==='sortimenti') {
      lines.push(['GJ','Odjel','Plan m3','Ostvareno m3','Stepen %','Trupci C %','Cjepano C %','Trupci L %','Cjepano L %'].join(','));
      rows.forEach(r=>lines.push([r.gj,r.odjel,r.neto,Math.round(r.actual.ukupno),r.stepen.toFixed(1),(r.cTrupci>0?r.actual.cTrupci/r.cTrupci*100:0).toFixed(1),(r.dzgo>0?dzgoAct(r.actual)/r.dzgo*100:0).toFixed(1),(r.lTrupci>0?r.actual.lTrupci/r.lTrupci*100:0).toFixed(1),(r.cijepano>0?cijAct(r.actual)/r.cijepano*100:0).toFixed(1)].join(',')));
    } else {
      lines.push(['GJ','Odjel','Proj.TrC','Proj.CjC','Proj.TrL','Proj.CjL','Projekat m3','Sj.TrC','Sj.CjC','Sj.TrL','Sj.CjL','Sjeceno m3','Stepen %'].join(','));
      rows.forEach(r=>lines.push([r.gj,r.odjel,r.cTrupci,r.dzgo,r.lTrupci,r.cijepano,r.neto,r.actual.cTrupci,dzgoAct(r.actual),r.actual.lTrupci,cijAct(r.actual),Math.round(r.actual.ukupno),r.stepen.toFixed(1)].join(',')));
    }
    downloadCsv('﻿'+lines.join('\n'), 'GodišnjiPlan_'+tab+'.csv');
  }

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  // ---- FILTER/SORT PUBLIC ----
  function filterGpGj(gj) {
    _gjFilter = gj;
    document.querySelectorAll('[data-gj-btn]').forEach(b=>{
      b.style.opacity = b.dataset.gjBtn===gj ? '1' : '0.5';
      b.style.fontWeight = b.dataset.gjBtn===gj ? '700' : '400';
    });
    if (_loaded) renderActiveTab();
  }

  function filterGpStatus(st) {
    _stFilter = st;
    document.querySelectorAll('[data-st-btn]').forEach(b=>{
      b.style.fontWeight = b.dataset.stBtn===st ? '700' : '400';
      b.style.boxShadow  = b.dataset.stBtn===st ? 'inset 0 -2px 0 currentColor' : 'none';
    });
    if (_loaded) renderActiveTab();
  }

  function filterGpSearch(val) {
    _search = val;
    if (_loaded) renderActiveTab();
  }

  function gpSort(tab, col) {
    if (_sort[tab].col===col) { _sort[tab].asc = !_sort[tab].asc; }
    else { _sort[tab] = { col, asc: col==='stepen'?false:true }; }
    if (_loaded) renderActiveTab();
  }

  function gpSetOverride(gj, odjel, val) {
    if (val==='auto') localStorage.removeItem('gp|'+gj+'|'+odjel);
    else localStorage.setItem('gp|'+gj+'|'+odjel, val);
    _rows = _rows.map(r=>{
      if (r.gj!==gj||r.odjel!==odjel) return r;
      const ovr = val==='auto'?'auto':val;
      return { ...r, override:ovr, status:ovr==='auto'?deriveStatus(r.stepen):ovr };
    });
    renderActiveTab();
  }

  // ---- PUBLIC API ----
  window.loadGodisnjiPlan   = loadGodisnjiPlan;
  window.switchGpTab        = switchGpTab;
  window.filterGpGj         = filterGpGj;
  window.filterGpStatus     = filterGpStatus;
  window.filterGpSearch     = filterGpSearch;
  window.gpSort             = gpSort;
  window.gpSetOverride      = gpSetOverride;
  window.gpOpenOdjelModal   = openOdjelModal;
  window.closeGpOdjelModal  = closeOdjelModal;
  window.gpExportModalCsv   = exportModalCsv;
  window.openGpPrintModal   = openPrintModal;
  window.closeGpPrintModal  = closePrintModal;
  window.gpDoPrint          = doPrint;
  window.gpExportCsv        = gpExportCsv;
})();
