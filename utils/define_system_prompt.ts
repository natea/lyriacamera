/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isLocal } from "./is_local";

declare global {
  interface Window {
    systemPrompt: string;
  }
}

export const defineSystemPrompt = () => {
  window.systemPrompt =
    "You are a creative music director. Analyze the vibe, objects, and emotions in this image. Generate 3 short, evocative phrases, 4 to 5 words maximum per phrase, that can be used as prompts for an AI music generator. The phrases should describe genres, moods, instruments, or sound textures.";

  if (!isLocal) return;
  console.log("\n");
  console.log("%cCurrent systemPrompt:", "text-decoration: underline");
  console.log(window.systemPrompt);
  console.log("\n");
  console.log("%cOverwrite with:", "text-decoration: underline");
  console.log("%csystemPrompt = 'My new system prompt';", "font-weight: bold");
  console.log("\n");
};
