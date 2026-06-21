/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PanelKey } from './denzelMessages';

// Static imports → Vite emits hashed asset URLs and bundles the files.
import boat from '../assets/panels/panel-boat.webp';
import happy from '../assets/panels/panel-happy.webp';
import teide from '../assets/panels/panel-teide.webp';
import car from '../assets/panels/panel-car.webp';
import corales from '../assets/panels/panel-corales.webp';
import arsenal from '../assets/panels/panel-arsenal.webp';
import eljefe from '../assets/panels/panel-eljefe.webp';
import couple from '../assets/panels/panel-couple.webp';

/** PanelKey → imported (hashed) asset URL, displayed behind Denzel's messages. */
export const PANEL_URLS: Record<PanelKey, string> = {
  boat,
  happy,
  teide,
  car,
  corales,
  arsenal,
  eljefe,
  couple,
};
