/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AudioChunk,
  GoogleGenAI,
  LiveMusicFilteredPrompt,
  LiveMusicServerMessage,
  LiveMusicSession,
  WeightedPrompt,
} from "@google/genai";
import { decode, decodeAudioData } from "./audio";
import { throttle } from "./throttle";

export type PlaybackState = "stopped" | "playing" | "loading" | "paused";

export class LiveMusicHelper extends EventTarget {
  private session: LiveMusicSession | null = null;
  private sessionPromise: Promise<LiveMusicSession> | null = null;

  private filteredPrompts = new Set<string>();
  private nextStartTime = 0;
  private bufferTime = 2;

  public readonly audioContext: AudioContext;
  public extraDestination: AudioNode | null = null;

  private outputNode: GainNode;
  private playbackState: PlaybackState = "stopped";

  private prompts: WeightedPrompt[] = [];
  private lastSentPrompts: WeightedPrompt[] = [];

  constructor(
    private readonly ai: GoogleGenAI,
    private readonly model: string,
  ) {
    super();
    this.prompts = [];
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    this.outputNode = this.audioContext.createGain();
  }

  private getSession(): Promise<LiveMusicSession> {
    if (!this.sessionPromise) this.sessionPromise = this.connect();
    return this.sessionPromise;
  }

  private async connect(): Promise<LiveMusicSession> {
    this.sessionPromise = this.ai.live.music.connect({
      model: this.model,
      callbacks: {
        onmessage: async (e: LiveMusicServerMessage) => {
          if (e.filteredPrompt) {
            this.filteredPrompts = new Set([
              ...this.filteredPrompts,
              e.filteredPrompt.text!,
            ]);
            this.dispatchEvent(
              new CustomEvent<LiveMusicFilteredPrompt>("filtered-prompt", {
                detail: e.filteredPrompt,
              }),
            );
          }
          if (e.serverContent?.audioChunks) {
            await this.processAudioChunks(e.serverContent.audioChunks);
          }
        },
        onclose: () => console.log("Lyria RealTime stream closed."),
        onerror: (e: unknown) => {
          this.stop();
          this.dispatchEvent(
            new CustomEvent("error", {
              detail: "Connection error, please restart audio.",
            }),
          );
          console.log("Lyria RealTime error", e);
        },
      },
    });
    return this.sessionPromise;
  }

  private setPlaybackState(state: PlaybackState) {
    this.playbackState = state;
    this.dispatchEvent(
      new CustomEvent("playback-state-changed", { detail: state }),
    );
  }

  private async processAudioChunks(audioChunks: AudioChunk[]) {
    if (this.playbackState === "paused" || this.playbackState === "stopped") {
      return;
    }

    this.checkPromptFreshness(this.getChunkTexts(audioChunks));

    const audioBuffer = await decodeAudioData(
      decode(audioChunks[0].data!),
      this.audioContext,
      48000,
      2,
    );

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputNode);

    if (this.nextStartTime === 0) {
      this.nextStartTime = this.audioContext.currentTime + this.bufferTime;
      setTimeout(() => {
        this.setPlaybackState("playing");
      }, this.bufferTime * 1000);
    }

    if (this.nextStartTime < this.audioContext.currentTime) {
      this.setPlaybackState("loading");
      this.nextStartTime = 0;
      return;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  private getChunkTexts(chunks: AudioChunk[]): string[] {
    const chunkPrompts =
      chunks[0].sourceMetadata?.clientContent?.weightedPrompts;
    if (!chunkPrompts) {
      return [];
    }
    return chunkPrompts.map((p) => p.text);
  }

  private checkPromptFreshness(texts: string[]) {
    const sentPromptTexts = this.lastSentPrompts.map((p) => p.text);
    const allMatch = sentPromptTexts.every((text) => texts.includes(text));

    if (!allMatch) {
      return;
    }

    this.dispatchEvent(new CustomEvent("prompts-fresh"));
    this.lastSentPrompts = []; // clear so we only fire once
  }

  public get activePrompts(): WeightedPrompt[] {
    return this.prompts
      .filter((p) => {
        return !this.filteredPrompts.has(p.text) && p.weight > 0;
      })
      .map((p) => {
        return { text: p.text, weight: p.weight };
      });
  }

  public readonly setWeightedPrompts = throttle((prompts: WeightedPrompt[]) => {
    this.prompts = prompts;

    if (this.activePrompts.length === 0) {
      this.dispatchEvent(
        new CustomEvent("error", {
          detail: "There needs to be one active prompt to play.",
        }),
      );
      this.pause();
      return;
    }

    this.checkPromptFreshness(prompts.map((p) => p.text));
    void this.setWeightedPromptsImmediate();
  }, 200);

  private async setWeightedPromptsImmediate() {
    if (!this.session) return;
    try {
      this.lastSentPrompts = this.activePrompts;
      await this.session.setWeightedPrompts({
        weightedPrompts: this.activePrompts,
      });
    } catch (e: unknown) {
      this.dispatchEvent(
        new CustomEvent("error", { detail: (e as Error).message }),
      );
      this.pause();
    }
  }

  public async play() {
    this.setPlaybackState("loading");
    this.session = await this.getSession();

    void this.setWeightedPromptsImmediate();

    await this.audioContext.resume();
    this.session.play();
    this.outputNode.connect(this.audioContext.destination);
    if (this.extraDestination) this.outputNode.connect(this.extraDestination);
    this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.outputNode.gain.linearRampToValueAtTime(
      1,
      this.audioContext.currentTime + 0.1,
    );
  }

  public pause() {
    if (this.session) this.session.pause();
    this.setPlaybackState("paused");
    this.outputNode.gain.setValueAtTime(1, this.audioContext.currentTime);
    this.outputNode.gain.linearRampToValueAtTime(
      0,
      this.audioContext.currentTime + 0.1,
    );
    this.nextStartTime = 0;
    this.outputNode = this.audioContext.createGain();
  }

  public stop() {
    this.setPlaybackState("stopped");
    this.nextStartTime = 0;

    if (this.session) {
      const fadeDuration = 1;
      this.outputNode.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.outputNode.gain.setValueAtTime(
        this.outputNode.gain.value,
        this.audioContext.currentTime,
      );
      this.outputNode.gain.linearRampToValueAtTime(
        0,
        this.audioContext.currentTime + fadeDuration,
      );

      const sessionToStop = this.session;
      setTimeout(() => {
        sessionToStop.stop();
      }, fadeDuration * 1000);
    }
    this.session = null;
    this.sessionPromise = null;
  }

  public async playPause() {
    switch (this.playbackState) {
      case "playing":
        return this.pause();
      case "paused":
      case "stopped":
        return this.play();
      case "loading":
        return this.stop();
      default:
        console.error(`Unknown playback state: ${this.playbackState}`);
    }
  }
}
