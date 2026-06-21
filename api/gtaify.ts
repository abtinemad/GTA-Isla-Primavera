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

  const image: string | undefined = req.body?.image;
  if (!image || typeof image !== 'string') {
    res.status(400).json({ error: 'missing_image' });
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
