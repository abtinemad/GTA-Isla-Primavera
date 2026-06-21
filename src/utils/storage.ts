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
const DB_VERSION = 2;
const PHOTO_STORE = 'course_photos';
// Photos "ambiance" libres sur les spots (beach clubs/restos/ravito/bars/plages),
// indexées par l'id numérique du spot.
const SPOT_STORE = 'spot_photos';
// Anciens emplacements localStorage du blob photos (les deux orthographes).
const LEGACY_PHOTO_KEYS = ['tenerife_course_photos', 'tenirife_course_photos'];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // Upgrade STRICTEMENT additif : on ne crée un store que s'il manque, jamais
    // de delete/clear. v1→v2 conserve donc intégralement course_photos ; v2
    // ajoute seulement spot_photos.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
      if (!db.objectStoreNames.contains(SPOT_STORE)) {
        db.createObjectStore(SPOT_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
