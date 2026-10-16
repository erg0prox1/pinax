import * as db from './db.js';

const TYPES = [
  'Eléctrico',
  'Hidráulico',
  'Electrónico',
  'Sensor',
  'Infraestructura',
  'Consumible',
  'Estructural y señalización',
  'TI',
  'Mobiliario',
  'Radios',
  'Generador',
  'ATS',
  'Minisplit',
];
const SYSTEM_TYPES = ['P60', 'CVIL', 'ZBV', 'ZPORTAL'];
const DEFAULT_SITES = ['Miguel Alemán', 'Camargo'];
const NONE = '__none'; // filtro "sin asignar"
const OTRO = '__otro'; // opción "OTRO (agregar sitio)"
const MAX_ROWS = 60;
const PLACEHOLDER =
  'Ej.\nMARCA: Siemens\nMODELO: 3RT2026\nSERIE: S VPB1234567\nCALIBRE: 25 A\nMATERIAL: Cobre\n(presión, voltaje, observaciones…)';

const app = document.getElementById('app');

/* ---------- utilidades ---------- */

// Crea elementos sin innerHTML, así el texto del usuario nunca se interpreta como HTML.
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const same = (a, b) => collator.compare(a.trim(), b.trim()) === 0;
const back = (href, text) => h('a', { class: 'back', href }, '‹ ', text);
const chevron = () => h('span', { class: 'chev', 'aria-hidden': 'true' }, '›');
const enc = encodeURIComponent;
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
// Texto sin acentos ni mayúsculas, para buscar.
const norm = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const pad = (n) => String(n).padStart(2, '0');
// Valor para <input type="datetime-local"> en hora local.
const toLocalInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// Lista con el valor actual incluido aunque ya no esté en la lista (p. ej. datos migrados).
const withCurrent = (list, current) => (current && !list.some((x) => same(x, current)) ? [...list, current] : list);

let urls = []; // URLs de fotos de la pantalla actual; se liberan al cambiar de pantalla
const urlFor = (blob) => {
  const u = URL.createObjectURL(blob);
  urls.push(u);
  return u;
};

let draftPhoto = null; // foto elegida en "Nuevo componente", antes de guardar
let flash = ''; // aviso que se muestra una vez en el menú
const consultState = { q: '', site: '', sys: '', type: '' };

async function compress(file, max = 1600, quality = 0.8) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
}

async function photoFromInput(input) {
  const f = input.files[0];
  input.value = '';
  if (!f) return null;
  try {
    return await compress(f);
  } catch {
    return f; // formato que el navegador no puede reescalar: se guarda tal cual
  }
}

async function loadSites() {
  const sites = await db.getAll('sites');
  for (const n of DEFAULT_SITES) {
    if (!sites.some((s) => same(s.name, n))) {
      const s = { id: db.uid(), name: n, createdAt: new Date().toISOString() };
      await db.put('sites', s);
      sites.push(s);
    }
  }
  return sites.map((s) => s.name).sort(collator.compare);
}

// Visor de foto a pantalla completa; con onDelete muestra el botón "Eliminar foto".
function openViewer(blob, onDelete) {
  const url = URL.createObjectURL(blob);
  const img = h('img', { class: 'viewer-img', src: url, alt: 'Foto del componente' });
  img.addEventListener('click', () => img.classList.toggle('zoomed'));
  const dlg = h(
    'dialog',
    { class: 'viewer', 'aria-label': 'Foto del componente' },
    h(
      'div',
      { class: 'viewer-bar' },
      h('button', { class: 'btn ghost', type: 'button', onClick: () => dlg.close() }, 'Cerrar'),
      onDelete
        ? h(
            'button',
            {
              class: 'btn danger',
              type: 'button',
              onClick: () => {
                if (!confirm('¿Eliminar esta foto?')) return;
                onDelete();
                dlg.close();
              },
            },
            'Eliminar foto'
          )
        : null
    ),
    h('div', { class: 'viewer-box' }, img),
    h('p', { class: 'viewer-hint' }, 'Toca la foto para ampliar o reducir')
  );
  dlg.addEventListener('close', () => {
    URL.revokeObjectURL(url);
    dlg.remove();
  });
  document.body.append(dlg);
  dlg.showModal();
}

/* ---------- menú ---------- */

async function menu() {
  const n = await db.count('records');
  const msg = flash;
  flash = '';
  return [
    h('header', {}, h('h1', {}, 'Pinax'), h('p', { class: 'sub' }, 'Bitácora de campo')),
    msg ? h('div', { class: 'msg ok', role: 'status' }, msg) : null,
    h(
      'a',
      { class: 'card primary', href: '#/nuevo' },
      h('span', { class: 'card-title' }, 'Tomar foto'),
      h('span', { class: 'card-sub' }, 'Nuevo componente')
    ),
    h(
      'a',
      { class: 'card outline', href: '#/consultar' },
      h('span', { class: 'card-title' }, 'Consultar'),
      h('span', { class: 'card-sub' }, n === 1 ? '1 componente guardado' : `${n} componentes guardados`)
    ),
    h('button', { class: 'btn ghost', type: 'button', onClick: exportBackup }, 'Exportar respaldo'),
  ];
}

/* ---------- nuevo componente: paso 1, la foto ---------- */

async function nuevo() {
  draftPhoto = null;
  const err = h('div', { class: 'err', role: 'alert' });
  const go = async (input) => {
    err.textContent = '';
    try {
      draftPhoto = await photoFromInput(input);
      if (draftPhoto) location.hash = '#/nuevo/ficha';
    } catch (e) {
      err.textContent = 'No se pudo leer la foto: ' + e.message;
    }
  };
  const cam = h('input', { id: 'n-file', type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onChange: () => go(cam) });
  // Sin "capture": el sistema deja elegir una foto de la biblioteca.
  const lib = h('input', { id: 'n-gallery', type: 'file', accept: 'image/*', hidden: true, onChange: () => go(lib) });
  return [
    h('header', {}, back('#/', 'Menú'), h('h1', {}, 'Nuevo componente'), h('p', { class: 'sub' }, 'Empieza con una foto del equipo o de su placa.')),
    h('button', { class: 'btn primary big tall', type: 'button', onClick: () => cam.click() }, 'Tomar foto'),
    h('button', { class: 'btn outline big tall', type: 'button', onClick: () => lib.click() }, 'Elegir de la biblioteca'),
    err,
    h('a', { class: 'skip', href: '#/nuevo/ficha' }, 'Continuar sin foto'),
    cam,
    lib,
  ];
}

/* ---------- ficha: crear y editar ---------- */

async function ficha(rec) {
  const isNew = !rec;
  const siteNames = await loadSites();
  let photo = isNew ? draftPhoto : rec.photo || null;

  const field = (fid, label, control, hint) =>
    h('div', { class: 'field' }, h('label', { for: fid }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
  const status = h('div', { class: 'msg', role: 'status' });
  const msg = (kind, text) => {
    status.className = 'msg ' + kind;
    status.textContent = text;
  };
  const clearMsg = () => {
    status.className = 'msg';
    status.textContent = '';
  };

  // Foto
  const thumb = h('button', { class: 'thumb', type: 'button', 'aria-label': 'Ver foto', onClick: () => photo && openViewer(photo, removePhoto) }, 'Sin foto');
  function showPhoto() {
    thumb.disabled = !photo;
    thumb.replaceChildren(photo ? h('img', { src: urlFor(photo), alt: 'Miniatura de la foto' }) : 'Sin foto');
  }
  function removePhoto() {
    photo = null;
    showPhoto();
    msg('ok', 'Foto quitada. Se confirma al guardar.');
  }
  showPhoto();
  const pick = async (input) => {
    try {
      const p = await photoFromInput(input);
      if (p) {
        photo = p;
        showPhoto();
        clearMsg();
      }
    } catch (e) {
      msg('err', 'No se pudo leer la foto: ' + e.message);
    }
  };
  const cam = h('input', { id: 'f-file', type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onChange: () => pick(cam) });
  const lib = h('input', { id: 'f-gallery', type: 'file', accept: 'image/*', hidden: true, onChange: () => pick(lib) });

  // Comentarios (ejemplo en gris que indica qué va ahí)
  const notes = h('textarea', { id: 'f-notes', rows: '8', placeholder: PLACEHOLDER, value: rec ? rec.notes : '' });

  // Fecha y hora por defecto (editable)
  const when = h('input', { id: 'f-when', type: 'datetime-local', value: toLocalInput(new Date(rec ? rec.createdAt : Date.now())) });

  // Nombre
  const name = h('input', { id: 'f-name', type: 'text', autocomplete: 'off', value: rec ? rec.name : '' });

  // Clasificación (opcional)
  const none = () => h('option', { value: '' }, '— Sin especificar —');
  const type = h('select', { id: 'f-type' }, none(), withCurrent(TYPES, rec && rec.type).map((t) => h('option', { value: t }, t)));
  type.value = rec ? rec.type || '' : '';
  const sys = h('select', { id: 'f-sys' }, none(), withCurrent(SYSTEM_TYPES, rec && rec.systemType).map((t) => h('option', { value: t }, t)));
  sys.value = rec ? rec.systemType || '' : '';

  // Sitio, con OTRO para agregar uno nuevo (confirmar o cancelar)
  const names = withCurrent(siteNames, rec && rec.site);
  const siteSel = h('select', { id: 'f-site' });
  let lastSite = rec ? rec.site || '' : '';
  function fillSites(selected) {
    siteSel.replaceChildren(none(), ...names.map((n) => h('option', { value: n }, n)), h('option', { value: OTRO }, 'OTRO (agregar sitio)'));
    siteSel.value = selected;
  }
  fillSites(lastSite);
  const newSite = h('input', { id: 'f-newsite', type: 'text', autocomplete: 'off', placeholder: 'Nombre del sitio nuevo' });
  const newSiteErr = h('div', { class: 'err', role: 'alert' });
  async function confirmSite() {
    const n = newSite.value.trim().replace(/\s+/g, ' ');
    if (!n) {
      newSiteErr.textContent = 'Escribe el nombre del sitio.';
      return;
    }
    const existing = names.find((x) => same(x, n));
    if (existing) {
      lastSite = existing;
    } else {
      await db.put('sites', { id: db.uid(), name: n, createdAt: new Date().toISOString() });
      names.push(n);
      names.sort(collator.compare);
      lastSite = n;
    }
    fillSites(lastSite);
    closeAdd();
  }
  function closeAdd() {
    addPanel.hidden = true;
    newSite.value = '';
    newSiteErr.textContent = '';
  }
  const addPanel = h(
    'div',
    { class: 'addsite', hidden: true },
    newSite,
    newSiteErr,
    h(
      'div',
      { class: 'addrow' },
      h('button', { class: 'btn primary', id: 'f-site-ok', type: 'button', onClick: () => confirmSite().catch((e) => (newSiteErr.textContent = e.message)) }, 'Confirmar'),
      h(
        'button',
        {
          class: 'btn ghost',
          id: 'f-site-cancel',
          type: 'button',
          onClick: () => {
            closeAdd();
            siteSel.value = lastSite;
          },
        },
        'Cancelar'
      )
    )
  );
  newSite.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      confirmSite().catch((e) => (newSiteErr.textContent = e.message));
    }
  });
  siteSel.addEventListener('change', () => {
    if (siteSel.value === OTRO) {
      addPanel.hidden = false;
      newSite.focus();
    } else {
      lastSite = siteSel.value;
      closeAdd();
    }
  });

  async function save() {
    const n = name.value.trim();
    if (!n) {
      msg('err', 'Pon un nombre.');
      name.focus();
      return;
    }
    if (!addPanel.hidden) {
      msg('err', 'Confirma o cancela el sitio nuevo.');
      return;
    }
    const now = new Date();
    const when_ = when.value ? new Date(when.value) : now;
    const record = {
      id: rec ? rec.id : db.uid(),
      name: n,
      type: type.value,
      systemType: sys.value,
      site: siteSel.value === OTRO ? '' : siteSel.value,
      notes: notes.value,
      photo: photo || null,
      createdAt: (isNaN(when_) ? now : when_).toISOString(),
      updatedAt: now.toISOString(),
    };
    await db.put('records', record);
    if (isNew) {
      draftPhoto = null;
      flash = `Guardado: ${n}`;
      location.hash = '#/';
    } else {
      location.hash = `#/registro/${enc(record.id)}`;
    }
  }

  const saveBtn = h('button', { class: 'btn primary big', type: 'submit' }, 'Guardar');
  const form = h(
    'form',
    {
      class: 'ficha',
      onSubmit: (ev) => {
        ev.preventDefault();
        saveBtn.disabled = true;
        save()
          .catch((e) => msg('err', 'No se pudo guardar: ' + e.message))
          .finally(() => (saveBtn.disabled = false));
      },
    },
    h(
      'div',
      { class: 'photo-row' },
      h('button', { class: 'btn outline', type: 'button', onClick: () => cam.click() }, 'Tomar foto'),
      h('button', { class: 'btn outline', type: 'button', onClick: () => lib.click() }, 'Elegir foto'),
      thumb,
      cam,
      lib
    ),
    field('f-notes', 'Comentarios', notes, 'Escribe aquí marca, modelo, serie, calibre, material… lo que identifique al componente.'),
    field('f-when', 'Fecha y hora del registro', when, 'Se llena sola con la fecha y hora actuales. Puedes corregirla.'),
    field('f-name', 'Nombre', name),
    h(
      'fieldset',
      { class: 'group' },
      h('legend', {}, 'Clasificación (opcional)'),
      field('f-type', 'Tipo de componente', type),
      field('f-sys', 'Tipo de sistema', sys),
      field('f-site', 'Sitio', siteSel),
      addPanel
    ),
    h('div', { class: 'actionbar' }, status, saveBtn)
  );
  form.addEventListener('input', clearMsg);

  return [
    h(
      'header',
      {},
      back(isNew ? '#/nuevo' : `#/registro/${enc(rec.id)}`, isNew ? 'Foto' : 'Cancelar'),
      h('h1', {}, isNew ? 'Ficha de componente' : 'Editar ficha')
    ),
    form,
  ];
}

async function editar(id) {
  const rec = await db.get('records', id);
  return rec ? ficha(rec) : notFound();
}

/* ---------- consultar ---------- */

async function consultar() {
  const recs = (await db.getAll('records')).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const uniq = (k) => [...new Set(recs.map((r) => r[k]).filter(Boolean))].sort(collator.compare);
  const filter = (id, label, key, stateKey) => {
    const sel = h(
      'select',
      { id, 'aria-label': label },
      h('option', { value: '' }, `${label}: todos`),
      uniq(key).map((v) => h('option', { value: v }, v)),
      recs.some((r) => !r[key]) ? h('option', { value: NONE }, `${label}: sin asignar`) : null
    );
    sel.value = consultState[stateKey];
    if (sel.value !== consultState[stateKey]) consultState[stateKey] = sel.value = '';
    sel.addEventListener('change', () => {
      consultState[stateKey] = sel.value;
      render();
    });
    return sel;
  };
  const q = h('input', { id: 'q', type: 'search', placeholder: 'Buscar en todo…', 'aria-label': 'Búsqueda general', autocomplete: 'off', value: consultState.q });
  q.addEventListener('input', () => {
    consultState.q = q.value;
    render();
  });
  const fSite = filter('c-site', 'Sitio', 'site', 'site');
  const fSys = filter('c-sys', 'Sistema', 'systemType', 'sys');
  const fType = filter('c-type', 'Tipo', 'type', 'type');
  const count = h('p', { class: 'sub', id: 'c-count', role: 'status' });
  const list = h('ul', { class: 'list' });

  const matchField = (value, want) => !want || (want === NONE ? !value : value === want);
  function render() {
    const terms = norm(consultState.q).split(/\s+/).filter(Boolean);
    const found = recs.filter(
      (r) =>
        matchField(r.site, consultState.site) &&
        matchField(r.systemType, consultState.sys) &&
        matchField(r.type, consultState.type) &&
        terms.every((t) => norm(`${r.name} ${r.notes} ${r.type} ${r.systemType} ${r.site}`).includes(t))
    );
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    count.textContent = recs.length
      ? `${found.length} de ${recs.length}` + (found.length > MAX_ROWS ? ` · mostrando ${MAX_ROWS}, afina la búsqueda` : '')
      : '';
    list.replaceChildren(
      ...(found.length
        ? found.slice(0, MAX_ROWS).map((r) =>
            h(
              'li',
              {},
              h(
                'a',
                { class: 'row', href: `#/registro/${enc(r.id)}` },
                r.photo ? h('img', { class: 'thumb-sm', src: urlFor(r.photo), alt: '' }) : h('span', { class: 'thumb-sm none' }, 'Sin foto'),
                h(
                  'span',
                  { class: 'main' },
                  h('span', { class: 'title' }, r.name),
                  h('span', { class: 'meta' }, [r.site, r.systemType, r.type].filter(Boolean).join(' · ') || 'Sin clasificar'),
                  h('span', { class: 'meta' }, fmtDate(r.createdAt))
                ),
                chevron()
              )
            )
          )
        : [h('li', { class: 'empty' }, recs.length ? 'Sin resultados.' : 'Aún no hay componentes guardados.')])
    );
  }
  render();

  return [
    h('header', {}, back('#/', 'Menú'), h('h1', {}, 'Consultar')),
    h('div', { class: 'filters' }, q, fSite, fSys, fType),
    h(
      'button',
      {
        class: 'btn ghost small',
        type: 'button',
        onClick: () => {
          Object.assign(consultState, { q: '', site: '', sys: '', type: '' });
          route();
        },
      },
      'Limpiar filtros'
    ),
    count,
    list,
  ];
}

/* ---------- ficha completa (consulta) ---------- */

async function registro(id) {
  const rec = await db.get('records', id);
  if (!rec) return notFound();
  const row = (label, value, mono) =>
    h('div', { class: 'kv' }, h('dt', {}, label), h('dd', { class: mono ? 'mono pre' : '' }, value || '—'));
  const upd = rec.updatedAt && Math.abs(new Date(rec.updatedAt) - new Date(rec.createdAt)) > 60000;
  return [
    h('header', {}, back('#/consultar', 'Consultar'), h('h1', {}, rec.name), h('p', { class: 'sub' }, fmtDate(rec.createdAt))),
    rec.photo
      ? h('button', { class: 'photo-big', type: 'button', 'aria-label': 'Ampliar foto', onClick: () => openViewer(rec.photo) }, h('img', { src: urlFor(rec.photo), alt: 'Foto del componente' }))
      : h('p', { class: 'empty' }, 'Sin foto.'),
    h(
      'dl',
      { class: 'detail' },
      row('Sitio', rec.site),
      row('Tipo de sistema', rec.systemType),
      row('Tipo de componente', rec.type),
      row('Fecha y hora', fmtDate(rec.createdAt)),
      upd ? row('Última edición', fmtDate(rec.updatedAt)) : null,
      row('Comentarios', rec.notes, true)
    ),
    h('a', { class: 'btn primary big', href: `#/editar/${enc(rec.id)}` }, 'Editar'),
    h('a', { class: 'btn outline big', href: '#/' }, 'Inicio'),
    h(
      'button',
      {
        class: 'btn danger-outline big',
        type: 'button',
        onClick: async () => {
          if (!confirm(`¿Borrar «${rec.name}»? No se puede deshacer.`)) return;
          await db.del('records', rec.id);
          location.hash = '#/consultar';
        },
      },
      'Borrar'
    ),
  ];
}

function notFound() {
  return [h('p', { class: 'empty' }, 'No se encontró esta pantalla.'), back('#/', 'Ir al menú')];
}

/* ---------- respaldo ---------- */

async function exportBackup() {
  const [sites, records] = await Promise.all(['sites', 'records'].map((s) => db.getAll(s)));
  const toDataURL = (blob) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  const out = await Promise.all(records.map(async ({ photo, ...rest }) => ({ ...rest, photo: photo ? await toDataURL(photo) : null })));
  const data = { version: 2, exportedAt: new Date().toISOString(), sites: sites.map((s) => s.name), records: out };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const a = h('a', { href: url, download: `pinax-respaldo-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ---------- router ---------- */

async function route() {
  const [a, b] = location.hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
  let view;
  try {
    if (!a) view = await menu();
    else if (a === 'nuevo' && !b) view = await nuevo();
    else if (a === 'nuevo' && b === 'ficha') view = await ficha(null);
    else if (a === 'consultar') view = await consultar();
    else if (a === 'registro' && b) view = await registro(b);
    else if (a === 'editar' && b) view = await editar(b);
    else view = notFound();
  } catch (e) {
    console.error(e);
    view = [h('p', { class: 'err' }, 'Algo falló: ' + e.message), back('#/', 'Ir al menú')];
  }
  app.replaceChildren(...view);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
