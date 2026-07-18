// ============================================================
// KUBIKATOR — Terenski kalkulator zapremine drvnih sortimenata
// Huberova formula: V = (π/4) × (d/100)² × L
// Izolovani modul: nema globalnih watchera, sav state lokalan
// ============================================================

// ─── Konfiguracija sortimenta (lako izmjenljivo) ─────────────
const KUBIKATOR_CETINARI = [
    'F/L Č', 'I Č', 'II Č', 'III Č', 'RD', 'TRUPCI Č',
    'CEL.DUGA', 'CEL.CIJEPANA', 'ŠKART'
];
const KUBIKATOR_LISCARI = [
    'F/L L', 'I L', 'II L', 'III L', 'TRUPCI L',
    'OGR.DUGI', 'OGR.CIJEPANI', 'GULE'
];
const KUBIKATOR_SORTIMENTI = [...KUBIKATOR_CETINARI, ...KUBIKATOR_LISCARI];
const KUB_KEY = 'kubikator_unosi';

// ─── Lokalni state ────────────────────────────────────────────
let _kubUnosi = [];
let _kubEditingId = null;
let _kubFilter = '';
let _kubVrsta = ''; // 'cetinari' | 'liscari' | ''
let _kubInited = false;

// ─── Pristupnik za printanje ──────────────────────────────────
function getKubikatorUnosi() { return _kubUnosi; }

// ─── Inicijalizacija ──────────────────────────────────────────
function initKubikator() {
    if (_kubInited) { _kubRenderAll(); return; }
    _kubInited = true;
    _kubUnosi = _kubUcitaj();
    _kubPopuniOdjeli();
    _kubRenderAll();

    // Enter tok: prečnik → dužina → dodaj
    const precnikEl = document.getElementById('kub-precnik');
    const duzinaEl  = document.getElementById('kub-duzina');
    const napomEl   = document.getElementById('kub-napomena');
    if (precnikEl) precnikEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); duzinaEl && duzinaEl.focus(); }
    });
    if (duzinaEl) duzinaEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); kubikatorDodaj(); }
    });
    if (napomEl) napomEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); kubikatorDodaj(); }
    });

    // Fokus odmah na prečnik
    precnikEl && precnikEl.focus();
    if (typeof markTabRendered === 'function') markTabRendered('kubikator');
}

// ─── Popuni odjel dropdown iz cached stanje-zaliha podataka ──
function _kubPopuniOdjeli() {
    const sel = document.getElementById('kub-odjel');
    if (!sel) return;
    try {
        const raw = localStorage.getItem('cache_stanje_zaliha');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const odjeli = (parsed.data || parsed).odjeli || [];
        const names = [...new Set(odjeli.map(o => o.odjel))].filter(Boolean).sort();
        if (!names.length) return;
        sel.innerHTML = '<option value="">— opciono —</option>';
        names.forEach(name => {
            const o = document.createElement('option');
            o.value = name; o.textContent = name;
            sel.appendChild(o);
        });
    } catch(e) {}
}

// ─── Odabir vrste: četinari / lišćari ────────────────────────
function kubikatorSetVrsta(vrsta) {
    _kubVrsta = vrsta;
    _kubPopuniSortiment();
    _kubOznaciVrstaBtn();
    document.getElementById('kub-sortiment').value = '';
    document.getElementById('kub-sortiment').focus();
}

function _kubPopuniSortiment() {
    const sel = document.getElementById('kub-sortiment');
    if (!sel) return;
    const lista = _kubVrsta === 'cetinari' ? KUBIKATOR_CETINARI
                : _kubVrsta === 'liscari'  ? KUBIKATOR_LISCARI
                : KUBIKATOR_SORTIMENTI;
    sel.innerHTML = '<option value="">— opciono —</option>';
    lista.forEach(s => {
        const o = document.createElement('option');
        o.value = s; o.textContent = s;
        sel.appendChild(o);
    });
}

function _kubOznaciVrstaBtn() {
    const btnC = document.getElementById('kub-btn-cetinari');
    const btnL = document.getElementById('kub-btn-liscari');
    if (!btnC || !btnL) return;
    if (_kubVrsta === 'cetinari') {
        btnC.style.background = '#047857'; btnC.style.color = 'white';
        btnL.style.background = 'white';   btnL.style.color = '#b45309';
    } else if (_kubVrsta === 'liscari') {
        btnL.style.background = '#b45309'; btnL.style.color = 'white';
        btnC.style.background = 'white';   btnC.style.color = '#047857';
    } else {
        btnC.style.background = 'white'; btnC.style.color = '#047857';
        btnL.style.background = 'white'; btnL.style.color = '#b45309';
    }
}

// ─── Dodaj / spremi izmjenu ───────────────────────────────────
function kubikatorDodaj() {
    // Normalizuj zarez — parseFloat("32,5") vrati 32 i tiho izgubi pola centimetra
    const _num = v => parseFloat(String(v == null ? '' : v).replace(',', '.'));
    const odjel    = (document.getElementById('kub-odjel').value    || '').trim();
    const sortiment = (document.getElementById('kub-sortiment').value || '').trim();
    const precnik   = _num(document.getElementById('kub-precnik').value);
    const duzina    = _num(document.getElementById('kub-duzina').value);
    const napomena  = (document.getElementById('kub-napomena').value || '').trim();

    if (!precnik || precnik <= 0) { _kubAlert('Prečnik mora biti veći od 0.'); return; }
    if (!duzina  || duzina  <= 0) { _kubAlert('Dužina mora biti veća od 0.');  return; }

    // Huber: V = (π/4) × (d/100)² × L
    const zapremina = (Math.PI / 4) * Math.pow(precnik / 100, 2) * duzina;

    if (_kubEditingId !== null) {
        const idx = _kubUnosi.findIndex(u => u.id === _kubEditingId);
        if (idx !== -1) {
            _kubUnosi[idx] = { ..._kubUnosi[idx], odjel, sortiment, precnik, duzina, zapremina, napomena };
        }
        _kubEditingId = null;
    } else {
        const ts = Date.now();
        _kubUnosi.push({ id: ts, ts, odjel, sortiment, precnik, duzina, zapremina, napomena });
    }

    _kubSacuvaj();
    _kubRenderAll();
    _kubResetFormu();
}

// ─── Obriši jedan red ─────────────────────────────────────────
function kubikatorObrisi(id) {
    if (!confirm('Obrisati ovaj unos?')) return;
    _kubUnosi = _kubUnosi.filter(u => u.id !== id);
    if (_kubEditingId === id) { _kubEditingId = null; _kubResetFormu(); }
    _kubSacuvaj();
    _kubRenderAll();
}

// ─── Izmijeni red ─────────────────────────────────────────────
function kubikatorIzmijeni(id) {
    const u = _kubUnosi.find(u => u.id === id);
    if (!u) return;
    // Postavi vrstu prema sortimentu ako postoji
    if (u.sortiment) {
        const novaVrsta = KUBIKATOR_CETINARI.includes(u.sortiment) ? 'cetinari' : 'liscari';
        if (novaVrsta !== _kubVrsta) {
            _kubVrsta = novaVrsta;
            _kubPopuniSortiment();
            _kubOznaciVrstaBtn();
        }
    }
    document.getElementById('kub-odjel').value    = u.odjel    || '';
    document.getElementById('kub-sortiment').value = u.sortiment || '';
    document.getElementById('kub-precnik').value   = u.precnik;
    document.getElementById('kub-duzina').value    = u.duzina;
    document.getElementById('kub-napomena').value  = u.napomena || '';
    _kubEditingId = id;
    document.getElementById('kub-dodaj-btn').textContent = '💾 SPREMI IZMJENU';
    document.getElementById('kub-odustani-btn').style.display = 'inline-block';
    document.getElementById('kub-forma-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Odustani od izmjene ──────────────────────────────────────
function kubikatorOdustani() {
    _kubEditingId = null;
    _kubResetFormu();
}

// ─── Obriši sve ───────────────────────────────────────────────
function kubikatorOcistiSve() {
    if (_kubUnosi.length === 0) return;
    if (!confirm('Obrisati sve unose? Ova akcija se ne može poništiti.')) return;
    _kubUnosi = [];
    _kubEditingId = null;
    _kubSacuvaj();
    _kubRenderAll();
    _kubResetFormu();
}

// ─── Filter po sortimentu ─────────────────────────────────────
function kubikatorSetFilter(val) {
    _kubFilter = val;
    _kubRenderTabela();
}

// ─── Privatne funkcije ────────────────────────────────────────

function _kubSacuvaj() {
    try { localStorage.setItem(KUB_KEY, JSON.stringify(_kubUnosi)); } catch(e) {}
}

function _kubUcitaj() {
    try {
        const raw = localStorage.getItem(KUB_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
}

function _kubResetFormu() {
    document.getElementById('kub-odjel').value     = '';
    document.getElementById('kub-sortiment').value = '';
    document.getElementById('kub-precnik').value   = '';
    document.getElementById('kub-duzina').value    = '';
    document.getElementById('kub-napomena').value  = '';
    document.getElementById('kub-dodaj-btn').textContent = '➕ DODAJ';
    document.getElementById('kub-odustani-btn').style.display = 'none';
    const precnikEl = document.getElementById('kub-precnik');
    if (precnikEl) precnikEl.focus();
}

function _kubRenderAll() {
    _kubOznaciVrstaBtn();
    _kubPopuniSortiment();
    _kubRenderRekapitulacija();
    _kubRenderTabela();
    _kubRenderFilterSelect();
}

function _kubRenderRekapitulacija() {
    const ukupnoKom = _kubUnosi.length;
    const ukupnoM3  = _kubUnosi.reduce((s, u) => s + u.zapremina, 0);

    document.getElementById('kub-ukupno-kom').textContent = ukupnoKom;
    document.getElementById('kub-ukupno-m3').textContent  = ukupnoM3.toFixed(2);

    const mapa = {};
    _kubUnosi.forEach(u => {
        const key = u.sortiment || '—';
        if (!mapa[key]) mapa[key] = { kom: 0, m3: 0 };
        mapa[key].kom++;
        mapa[key].m3 += u.zapremina;
    });

    const tbody = document.getElementById('kub-rekap-tbody');
    if (!tbody) return;

    if (Object.keys(mapa).length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:10px;">Nema unosa</td></tr>';
        return;
    }

    // Sortimentirani po redoslijedu konfiguracije, ostali na kraj
    const poznati = KUBIKATOR_SORTIMENTI.filter(s => mapa[s]);
    const ostali  = Object.keys(mapa).filter(s => !KUBIKATOR_SORTIMENTI.includes(s));
    tbody.innerHTML = [...poznati, ...ostali].map(s => `
        <tr>
            <td style="padding:6px 10px;font-weight:600;color:#065f46;">${s}</td>
            <td style="padding:6px 10px;text-align:center;">${mapa[s].kom}</td>
            <td style="padding:6px 10px;text-align:right;font-weight:600;color:#047857;">${mapa[s].m3.toFixed(2)}</td>
        </tr>`).join('');
}

function _kubRenderTabela() {
    const filtered = _kubFilter
        ? _kubUnosi.filter(u => u.sortiment === _kubFilter)
        : _kubUnosi;

    const tbody = document.getElementById('kub-tabela-tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#6b7280;padding:20px;">${_kubFilter ? 'Nema unosa za odabrani sortiment.' : 'Nema unosa. Dodajte prvi komad.'}</td></tr>`;
        return;
    }

    const reversed = [...filtered].reverse();
    tbody.innerHTML = reversed.map((u, visIdx) => {
        const rb = filtered.length - visIdx;
        const isEditing = u.id === _kubEditingId;
        const rowBg = isEditing ? 'background:#fffbeb;' : '';
        return `<tr style="border-bottom:1px solid #e5e7eb;${rowBg}">
            <td class="kub-col-rb"       style="padding:10px 8px;text-align:center;color:#6b7280;font-size:12px;">${rb}</td>
            <td class="kub-col-datum"    style="padding:10px 8px;font-size:12px;white-space:nowrap;">${_kubFmtTs(u.ts)}</td>
            <td                          style="padding:10px 8px;font-size:12px;color:#374151;">${u.odjel || '<span style="color:#d1d5db;">—</span>'}</td>
            <td                          style="padding:10px 8px;font-weight:600;color:#065f46;">${u.sortiment || '<span style="color:#d1d5db;">—</span>'}</td>
            <td                          style="padding:10px 8px;text-align:center;">${u.precnik}</td>
            <td                          style="padding:10px 8px;text-align:center;">${u.duzina.toFixed(2)}</td>
            <td                          style="padding:10px 8px;text-align:right;font-weight:700;color:#047857;">${u.zapremina.toFixed(2)}</td>
            <td class="kub-col-napomena" style="padding:10px 8px;font-size:12px;color:#4b5563;">${typeof escapeHtml === 'function' ? escapeHtml(u.napomena || '') : (u.napomena || '')}</td>
            <td style="padding:10px 6px;text-align:center;white-space:nowrap;">
                <button class="kub-action-btn" onclick="kubikatorIzmijeni(${u.id})" style="padding:5px 10px;font-size:12px;background:#2563eb;color:white;border:none;border-radius:5px;cursor:pointer;margin-right:4px;">✏️</button>
                <button class="kub-action-btn" onclick="kubikatorObrisi(${u.id})"   style="padding:5px 10px;font-size:12px;background:#dc2626;color:white;border:none;border-radius:5px;cursor:pointer;">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

function _kubRenderFilterSelect() {
    const sel = document.getElementById('kub-filter-sort');
    if (!sel) return;
    const aktivni = new Set(_kubUnosi.map(u => u.sortiment).filter(Boolean));
    const trenutni = sel.value;
    sel.innerHTML = '<option value="">Svi sortimenti</option>';
    KUBIKATOR_SORTIMENTI.filter(s => aktivni.has(s)).forEach(s => {
        const o = document.createElement('option');
        o.value = s; o.textContent = s;
        if (s === trenutni) o.selected = true;
        sel.appendChild(o);
    });
    if (_kubFilter && !aktivni.has(_kubFilter)) { _kubFilter = ''; sel.value = ''; }
}

function _kubFmtTs(ts) {
    return new Date(ts).toLocaleString('bs-BA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function _kubAlert(msg) {
    if (typeof showError === 'function') showError('Greška', msg);
    else alert(msg);
}
