/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resize + (re)compresse une image (dataURL) pour le stockage : grand côté à
 * `maxDim`, qualité JPEG `quality`. AUCUNE colorimétrie — on stocke l'ORIGINAL
 * (la stylisation GTA vient de l'API). Même pipeline que les captures missions.
 */
export function compressImage(src: string, maxDim = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(src);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
