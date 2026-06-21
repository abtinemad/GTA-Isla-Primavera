/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fonction serverless Vercel (runtime Node) — proxie la stylisation « GTA AUTO »
 * via l'API image de Google. La clé NE quitte JAMAIS le client.
 *
 * Variables d'environnement (Vercel → Project Settings → Environment Variables) :
 *   - GTA_API_KEY : clé Google (générativelanguage). OBLIGATOIRE.
 *   - GTA_PROMPT  : prompt GTA universel (mis tel quel dans la part `text`).
 *                   Optionnel — fallback DEFAULT_PROMPT ci-dessous si absent.
 *
 * Entrée  (POST JSON) : { image: "<base64 sans préfixe data:>" }
 * Sortie  (200)       : { image: "<base64 stylisé>" }
 * Erreurs (4xx/5xx)   : { error: "<code>" } — l'app garde l'original, « régénérer »
 *                       pourra relancer.
 */

// Modèle principal puis fallback si 404.
const MODELS = ['gemini-3.1-flash-image', 'gemini-3.1-flash-image-preview'];

// Prompt « gtaifier » (server-side uniquement, jamais dans le client). Surchargeable
// via l'env GTA_PROMPT sans redéploiement.
const DEFAULT_PROMPT = `An artistic digital illustration in the style of a GTA-style loading-screen poster, based directly on the composition of the provided image. Hand-drawn comic-book aesthetic: clean bold black outlines, dynamic cell-shading, vivid saturated colors, painterly textures, high-contrast dramatic lighting, premium Rockstar loading-screen finish.

Render the EXACT same scene as an illustration in this art style — keep the original composition, layout, subjects, faces, expressions and proportions identical to the photo. Only the drawing/rendering style changes; do not add, remove, move or alter any elements.

Color palette & atmosphere — KEEP the photo's real colors true, vivid and dominant; they must stay clearly recognizable. Layer only a SUBTLE, light-touch Miami / neon-coast vibe on top (do NOT add objects like palms, neon signs or skylines, and do NOT recolor or override the photo's true colors): a gentle warm golden-hour glow, a faint coral/amber warmth in the highlights and a light cyan-teal hint in the cool tones, with at most a whisper of neon accent. The Miami feel is only a light atmospheric layer, never a global recolor.

No real trademarks (no "Grand Theft Auto", no "Vice City", no VCPD, no Rockstar/R* star, no real brand logos).`;

// ── Garde-fous anti-abus (le proxy transmet à Google → protéger la facturation) ──
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // ~2 Mo (l'app compresse à ~1280px / JPEG q85)
const RATE_LIMIT = 10;                    // requêtes…
const RATE_WINDOW_MS = 60_000;            // …par minute et par IP
// Origines autorisées : prod + previews Vercel (*.vercel.app) + localhost (dev).
const ALLOWED_HOSTS = ['localhost', '127.0.0.1'];
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// Rate-limit en mémoire (réinitialisé par instance serverless — suffisant ici).
const rateHits: Map<string, { count: number; start: number }> = new Map();

function clientIp(req: any): string {
  const fwd = String(req.headers['x-forwarded-for'] || '');
  return fwd.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateHits.size > 500) {
    for (const [k, v] of rateHits) if (now - v.start >= RATE_WINDOW_MS) rateHits.delete(k);
  }
  const e = rateHits.get(ip);
  if (!e || now - e.start >= RATE_WINDOW_MS) {
    rateHits.set(ip, { count: 1, start: now });
    return false;
  }
  e.count += 1;
  return e.count > RATE_LIMIT;
}

// Souhaité : refuse les requêtes cross-origin venant d'un navigateur. Une requête
// SANS Origin/Referer (script serveur, outil de dev) est tolérée — la validation et
// le rate-limit restent les garde-fous principaux dans ce cas.
function originAllowed(req: any): boolean {
  const ref = String(req.headers.origin || req.headers.referer || '');
  if (!ref) return true;
  try {
    const host = new URL(ref).hostname;
    return host.endsWith('.vercel.app') || ALLOWED_HOSTS.includes(host);
  } catch {
    return false;
  }
}

// Valide une image base64 (sans préfixe data:) : taille ≤ ~2 Mo + magic bytes
// JPEG (FF D8 FF) ou PNG (89 50 4E 47). Rien d'autre n'est transmis à Google.
function isValidImageB64(image: string): boolean {
  const approxBytes = Math.floor((image.length * 3) / 4); // estime sans allouer le buffer
  if (approxBytes > MAX_IMAGE_BYTES) return false;
  if (!B64_RE.test(image)) return false;
  const head = Buffer.from(image.slice(0, 16), 'base64');
  const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  return jpeg || png;
}

// Vercel : laisse le temps à la génération d'image.
export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.GTA_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'missing_api_key' });
    return;
  }

  // Origine (souhaité) → rate-limit (IP) → validation : tout est rejeté AVANT
  // le moindre appel à Google.
  if (!originAllowed(req)) {
    res.status(403).json({ error: 'forbidden_origin' });
    return;
  }
  if (isRateLimited(clientIp(req))) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const image: string | undefined = req.body?.image;
  if (!image || typeof image !== 'string') {
    res.status(400).json({ error: 'missing_image' });
    return;
  }
  if (!isValidImageB64(image)) {
    res.status(400).json({ error: 'invalid_image' });
    return;
  }

  const prompt = process.env.GTA_PROMPT || DEFAULT_PROMPT;
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: image } },
        ],
      },
    ],
  });

  let lastError = 'upstream_error';
  for (const model of MODELS) {
    let upstream: any;
    try {
      upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body,
        },
      );
    } catch {
      lastError = 'network_error';
      continue;
    }

    if (upstream.status === 404) {
      lastError = 'model_not_found';
      continue; // essaie le modèle de fallback
    }

    let json: any = null;
    try {
      json = await upstream.json();
    } catch {
      json = null;
    }

    if (!upstream.ok) {
      res.status(502).json({ error: json?.error?.message || `upstream_${upstream.status}` });
      return;
    }

    const parts: any[] = json?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
    const out: string | undefined = imgPart?.inlineData?.data || imgPart?.inline_data?.data;

    if (!out) {
      // Refus / safety / réponse texte seule → erreur propre (l'app garde l'original).
      res.status(422).json({ error: 'no_image_in_response' });
      return;
    }

    res.status(200).json({ image: out });
    return;
  }

  res.status(502).json({ error: lastError });
}
