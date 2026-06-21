/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CATEGORY_MAP } from './helper';
import { courses } from '../data/coursesData';
import { INITIAL_LOCATIONS } from '../locationsData';

// Course brand red (route line / El Jefe).
const COURSE_ACCENT = '#EA4423';

/** A photo of the collection (its ORIGINAL). The GTA version is looked up
 *  separately by `key` in the gta store, so the original is never overwritten. */
export type PhotoEntry = {
  /** Composite key, also the gta-store key: "course:<id>" | "loc:<id>". */
  key: string;
  original: string; // base64 dataURL
  label: string;
  accent: string;
  rank: number; // coherent ordering: course → secondary → ambiance
};

export const courseKey = (id: string): string => `course:${id}`;
export const locKey = (id: number): string => `loc:${id}`;

/**
 * Merge the THREE original stores into deduped, coherently-sorted entries:
 * course photos (data order, RUN 0 included) → secondary Escapades → ambiance.
 * Location-keyed photos (capturedPhotos + spotPhotos) dedup by spot id; the
 * ambiance store wins for a shared id (the newer, intentional shot).
 * Single source of truth shared by the gallery AND the styling queue.
 */
export function buildPhotoCollection(
  coursePhotos: Record<string, string>,
  capturedPhotos: Record<number, string>,
  spotPhotos: Record<number, string>,
): PhotoEntry[] {
  const items: PhotoEntry[] = [];

  courses.forEach((c, i) => {
    const url = coursePhotos[c.id];
    if (url) items.push({ key: courseKey(c.id), original: url, label: c.title, accent: COURSE_ACCENT, rank: 100 + i });
  });

  const byLoc = new Map<number, string>();
  Object.entries(capturedPhotos).forEach(([id, url]) => { if (url) byLoc.set(Number(id), url); });
  Object.entries(spotPhotos).forEach(([id, url]) => { if (url) byLoc.set(Number(id), url); });
  byLoc.forEach((url, id) => {
    const loc = INITIAL_LOCATIONS.find((l) => l.id === id);
    if (!loc) return;
    const isSecondary = loc.category === 'Escapades';
    const accent = CATEGORY_MAP[loc.category]?.accentColor ?? '#9aa0ab';
    items.push({ key: locKey(id), original: url, label: loc.name, accent, rank: (isSecondary ? 200 : 300) + id });
  });

  return items.sort((a, b) => a.rank - b.rank);
}
