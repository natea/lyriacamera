/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IntervalPreset } from "./types";
import { urlargs } from "./urlargs";

export const MAX_CAPTURE_DIM = 256;
export const IMAGE_MIME_TYPE = "image/png";
export const GEMINI_MODEL = "gemini-2.5-flash-lite";

export const INTERVAL_PRESETS: IntervalPreset[] = [
  {
    captureSeconds: 0,
    crossfadeSeconds: 0,
    labelValue: "0",
    labelSub: "INSTANT",
  },
  {
    captureSeconds: 10,
    crossfadeSeconds: 0,
    labelValue: "10s",
    labelSub: "FAST",
  },
  {
    captureSeconds: 20,
    crossfadeSeconds: 0,
    labelValue: "20s",
    labelSub: "MEDIUM",
  },
  {
    captureSeconds: 30,
    crossfadeSeconds: 6,
    labelValue: "30s",
    labelSub: "SLOW",
  },
];

export const DEFAULT_INTERVAL_PRESET = INTERVAL_PRESETS[2];

export const PREFERRED_STREAM_PARAMS = {
  width: { ideal: urlargs.streamWidth },
  height: { ideal: urlargs.streamHeight },
};
