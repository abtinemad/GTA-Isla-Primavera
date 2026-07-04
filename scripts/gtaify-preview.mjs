/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DEV-ONLY — GTA-ifie les photos de src/preview-photos/ via le MÊME proxy que le
 * pipeline réel (/api/gtaify, même modèle + même prompt côté serveur). Écrit les
 * résultats dans src/preview-photos-gta/ sous les MÊMES noms de fichier.
 *
 * Cache : si la version GTA existe déjà, on la saute (pas d'appel API gaspillé).
 *
 * Usage :
 *   node scripts/gtaify-preview.mjs https://ton-projet.vercel.app
 *   GTA_PROXY_BASE=https://ton-projet.vercel.app node scripts/gtaify-preview.mjs
 *   node scripts/gtaify-preview.mjs https://… --force   (régénère tout)
 *
 * Rien n'est poussé, aucune clé ne transite ici (la clé reste sur le proxy Vercel).
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Compression AVANT envoi (mêmes paramètres que src/utils/imageCompress.ts du
// pipeline réel : maxDim 1280, JPEG q85) → évite le 413 de Vercel (~4.5 Mo).
const MAX_DIM = 1280;
async function compress(buf) {
  return sharp(buf)
    .rotate() // respecte l'orientation EXIF
    .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../src/preview-photos');
const OUT_DIR = path.resolve(__dirname, '../src/preview-photos-gta');
const EXT = /\.(jpe?g|png|webp)$/i;

const args = process.argv.slice(2);
const force = args.includes('--force');
const base = (args.find((a) => /^https?:\/\//.test(a)) || process.env.GTA_PROXY_BASE || '').replace(/\/$/, '');

if (!base) {
  console.error('✗ URL du proxy manquante. Usage : node scripts/gtaify-preview.mjs https://ton-projet.vercel.app');
  process.exit(1);
}

const endpoint = `${base}/api/gtaify`;

async function gtaify(b64) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: b64 }),
  });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(`réponse non-JSON (HTTP ${res.status}) — la route ${endpoint} ne sert pas la fonction ?`);
  }
  const json = await res.json();
  if (!res.ok || !json?.image) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  return json.image; // base64 sans préfixe
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`✗ Dossier introuvable : ${SRC_DIR}`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const files = (await readdir(SRC_DIR)).filter((f) => EXT.test(f)).sort();
  if (!files.length) {
    console.error('✗ Aucune image dans src/preview-photos/');
    process.exit(1);
  }

  console.log(`→ Proxy : ${endpoint}`);
  console.log(`→ ${files.length} image(s) à traiter${force ? ' (--force)' : ''}\n`);

  let done = 0, skipped = 0, failed = 0;
  for (const f of files) {
    const outPath = path.join(OUT_DIR, f);
    if (!force && existsSync(outPath)) {
      console.log(`• ${f} — déjà GTA, skip`);
      skipped++;
      continue;
    }
    try {
      const raw = await readFile(path.join(SRC_DIR, f));
      const buf = await compress(raw);
      process.stdout.write(`• ${f} — ${(raw.length / 1e6).toFixed(1)}→${(buf.length / 1e6).toFixed(1)} Mo, génération… `);
      const out = await gtaify(buf.toString('base64'));
      await writeFile(outPath, Buffer.from(out, 'base64'));
      console.log('✓');
      done++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${done} générée(s) · ${skipped} en cache · ${failed} échec(s) → src/preview-photos-gta/`);
  if (failed && !done) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
