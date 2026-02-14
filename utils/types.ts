/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Prompt {
  text: string;
  weight: number;
  isNew?: boolean;
}

export type PlaybackState = "stopped" | "playing" | "loading" | "paused";

export type FacingMode = "user" | "environment";

export type AppState =
  | "idle" // not generating or playing
  | "pendingStart" // first capture requested, waiting on prompt generation
  | "playing"; // capture loop active and music playing

export type IntervalPreset = {
  captureSeconds: number;
  crossfadeSeconds: number;
  labelValue: string;
  labelSub: string;
};

export type StreamSource = "camera" | "screen" | "none";

export type Page = "splash" | "main" | "interval" | "download" | "processing";
