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

// Prompt par défaut (à surcharger via GTA_PROMPT en env serveur).
const DEFAULT_PROMPT =
  "Restyle this exact photo as official Grand Theft Auto loading-screen cover art: " +
  "bold hand-painted cel-shading, thick clean black outlines, punchy saturated colors, " +
  "high contrast sunny lighting, subtle halftone grain. Keep the original composition, " +
  "subjects and framing identical — only restyle. No text, no logos, no watermark.";

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
