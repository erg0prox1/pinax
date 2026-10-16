// Capa de datos: IndexedDB, todo queda en el equipo.
// records: un documento por componente (incluye la foto como Blob).
// sites: lista de sitios que se puede ampliar desde la ficha ("OTRO").
// systems, components, photos: almacenes de la versión anterior; solo se leen una vez para migrar.

const DB_NAME = 'bitacora';
const VERSION = 2;
let opening;

function migrateV1(tx) {
  const names = ['sites', 'systems', 'components', 'photos'];
  const data = {};
  let pending = names.length;
  for (const n of names) {
    const r = tx.objectStore(n).getAll();
    r.onsuccess = () => {
      data[n] = r.result;
      if (--pending) return;
      const out = tx.objectStore('records');
      for (const c of data.components) {
        const sys = data.systems.find((s) => s.id === c.systemId);
        const site = sys && data.sites.find((s) => s.id === sys.siteId);
        const photo = c.photoId && data.photos.find((p) => p.id === c.photoId);
        out.put({
          id: c.id,
          name: c.name,
          type: c.type || '',
          systemType: sys ? sys.code : '',
          site: site ? site.name : '',
          notes: c.notes || '',
          photo: photo ? photo.blob : null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt || c.createdAt,
        });
      }
    };
  }
}

function open() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = (ev) => {
        const d = r.result;
        const old = ev.oldVersion;
        if (old < 1) {
          d.createObjectStore('sites', { keyPath: 'id' });
          d.createObjectStore('systems', { keyPath: 'id' }).createIndex('siteId', 'siteId');
          d.createObjectStore('components', { keyPath: 'id' }).createIndex('systemId', 'systemId');
          d.createObjectStore('photos', { keyPath: 'id' });
        }
        d.createObjectStore('records', { keyPath: 'id' });
        if (old >= 1) migrateV1(r.transaction);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return opening;
}

const req = (store, mode, make) =>
  open().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(store, mode);
        const r = make(t.objectStore(store));
        t.oncomplete = () => resolve(r ? r.result : undefined);
        t.onerror = t.onabort = () => reject(t.error);
      })
  );

export const getAll = (store) => req(store, 'readonly', (s) => s.getAll());
export const get = (store, id) => req(store, 'readonly', (s) => s.get(id));
export const put = (store, obj) => req(store, 'readwrite', (s) => s.put(obj));
export const del = (store, id) => req(store, 'readwrite', (s) => s.delete(id));
export const count = (store) => req(store, 'readonly', (s) => s.count());

export const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
