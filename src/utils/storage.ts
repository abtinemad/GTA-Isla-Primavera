/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Persistance — deux responsabilités :
 *
 * 1. Renommage one-shot des clés localStorage mal orthographiées
 *    (« tenirife_* » → « tenerife_* ») sans perdre la progression existante.
 * 2. Stockage des photos de course (base64, lourdes) dans IndexedDB plutôt que
 *    dans localStorage (quota ~5 Mo). Les petites données (ids de complétion,
 *    wallet, timestamps) restent en localStorage.
 */

// --- 1. Migration des clés localStorage : tenirife_* → tenerife_* -----------

// Suffixes des clés conservées en localStorage (course_photos est exclu : il
// part en IndexedDB, voir plus bas).
const LEGACY_KEY_SUFFIXES = [
  'wallet',
  'denzel_ambient_ts',
  'captured_photos',
  'completed_courses',
  'completed_locations',
  'completed_times',
];

/**
 * Renomme une fois les clés héritées « tenirife_* » en « tenerife_* ».
 * Idempotent : sûr à appeler à chaque démarrage. À exécuter AVANT toute
 * lecture des clés (les initialiseurs d'état lisent déjà « tenerife_* »).
 */
export function migrateLegacyKeys(): void {
  try {
    for (const suffix of LEGACY_KEY_SUFFIXES) {
      const oldKey = `tenirife_${suffix}`;
      const newKey = `tenerife_${suffix}`;
      const legacy = localStorage.getItem(oldKey);
      if (legacy === null) continue;
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, legacy);
      }
      localStorage.removeItem(oldKey);
    }
  } catch {
    /* localStorage indisponible — rien à migrer */
  }
}

// --- 2. Photos de course en IndexedDB --------------------------------------

const DB_NAME = 'tenerife';
const DB_VERSION = 3;
const PHOTO_STORE = 'course_photos';
// Photos "ambiance" libres sur les spots (beach clubs/restos/ravito/bars/plages),
// indexées par l'id numérique du spot.
const SPOT_STORE = 'spot_photos';
// Photos d'Escapades (co-validation) — migrées de localStorage vers IndexedDB
// (les originaux 1280 px feraient sauter le quota localStorage). Clé = id du spot.
const CAPTURED_STORE = 'captured_photos';
// Versions stylisées GTA (proxy API), clé composite "course:<id>" / "loc:<id>".
// L'original n'est JAMAIS écrasé — il vit dans son store dédié à côté.
const GTA_STORE = 'gta_photos';
// Anciens emplacements localStorage du blob photos (les deux orthographes).
const LEGACY_PHOTO_KEYS = ['tenerife_course_photos', 'tenirife_course_photos'];
const LEGACY_CAPTURED_KEY = 'tenerife_captured_photos';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // Upgrade STRICTEMENT additif : on ne crée un store que s'il manque, jamais
    // de delete/clear. Chaque version ne fait qu'AJOUTER des stores.
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of [PHOTO_STORE, SPOT_STORE, CAPTURED_STORE, GTA_STORE]) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Génériques (clé string ou number) — factorisent les lectures/écritures.
async function getAllFromStore(store: string): Promise<Array<[IDBValidKey, string]>> {
  const db = await openDB();
  try {
    return await new Promise<Array<[IDBValidKey, string]>>((resolve, reject) => {
      const out: Array<[IDBValidKey, string]> = [];
      const req = db.transaction(store, 'readonly').objectStore(store).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          out.push([cursor.key, cursor.value as string]);
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function putInStore(store: string, key: IDBValidKey, value: string): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Toutes les photos de course sous la forme { [courseId]: base64 }. */
export async function getAllCoursePhotos(): Promise<Record<string, string>> {
  const db = await openDB();
  try {
    return await new Promise<Record<string, string>>((resolve, reject) => {
      const out: Record<string, string> = {};
      const cursorReq = db
        .transaction(PHOTO_STORE, 'readonly')
        .objectStore(PHOTO_STORE)
        .openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          out[String(cursor.key)] = cursor.value as string;
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } finally {
    db.close();
  }
}

/** Persiste une photo de course (base64) indexée par l'id de la course. */
export async function putCoursePhoto(id: string, base64: string): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      tx.objectStore(PHOTO_STORE).put(base64, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Charge toutes les photos de course. Importe une fois l'ancien blob
 * localStorage dans IndexedDB (puis le purge pour libérer le quota).
 */
export async function loadCoursePhotos(): Promise<Record<string, string>> {
  for (const key of LEGACY_PHOTO_KEYS) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      /* localStorage indisponible */
    }
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      await Promise.all(
        Object.entries(parsed).map(([id, b64]) => putCoursePhoto(id, b64)),
      );
    } catch {
      /* blob corrompu — on l'abandonne */
    }
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  try {
    return await getAllCoursePhotos();
  } catch {
    return {};
  }
}

// --- 3. Photos "ambiance" de spots en IndexedDB (clé = id numérique) --------

/** Toutes les photos de spot sous la forme { [spotId]: base64 }. */
export async function getAllSpotPhotos(): Promise<Record<number, string>> {
  const db = await openDB();
  try {
    return await new Promise<Record<number, string>>((resolve, reject) => {
      const out: Record<number, string> = {};
      const cursorReq = db
        .transaction(SPOT_STORE, 'readonly')
        .objectStore(SPOT_STORE)
        .openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          out[Number(cursor.key)] = cursor.value as string;
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } finally {
    db.close();
  }
}

/** Persiste une photo "ambiance" (base64) indexée par l'id du spot. */
export async function putSpotPhoto(id: number, base64: string): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SPOT_STORE, 'readwrite');
      tx.objectStore(SPOT_STORE).put(base64, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Charge toutes les photos "ambiance" de spots. */
export async function loadSpotPhotos(): Promise<Record<number, string>> {
  try {
    return await getAllSpotPhotos();
  } catch {
    return {};
  }
}

// --- 4. Photos d'Escapades (co-validation) en IndexedDB (clé = id numérique) -

/** Persiste une photo d'Escapade (base64) indexée par l'id du spot. */
export async function putCapturedPhoto(id: number, base64: string): Promise<void> {
  await putInStore(CAPTURED_STORE, id, base64);
}

/**
 * Charge les photos d'Escapades. Importe une fois l'ancien blob localStorage
 * (tenerife_captured_photos) dans IndexedDB, puis le purge.
 */
export async function loadCapturedPhotos(): Promise<Record<number, string>> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_CAPTURED_KEY);
  } catch {
    /* localStorage indisponible */
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      await Promise.all(
        Object.entries(parsed).map(([id, b64]) => putCapturedPhoto(Number(id), b64)),
      );
    } catch {
      /* blob corrompu — on l'abandonne */
    }
    try {
      localStorage.removeItem(LEGACY_CAPTURED_KEY);
    } catch {
      /* ignore */
    }
  }
  try {
    const out: Record<number, string> = {};
    for (const [k, v] of await getAllFromStore(CAPTURED_STORE)) out[Number(k)] = v;
    return out;
  } catch {
    return {};
  }
}

// --- 5. Versions stylisées GTA (clé composite "course:<id>" / "loc:<id>") ----

/** Persiste la version GTA d'une photo (l'original reste intact ailleurs). */
export async function putGtaPhoto(key: string, base64: string): Promise<void> {
  await putInStore(GTA_STORE, key, base64);
}

/** Charge toutes les versions GTA sous la forme { [compositeKey]: base64 }. */
export async function loadGtaPhotos(): Promise<Record<string, string>> {
  try {
    const out: Record<string, string> = {};
    for (const [k, v] of await getAllFromStore(GTA_STORE)) out[String(k)] = v;
    return out;
  } catch {
    return {};
  }
}
