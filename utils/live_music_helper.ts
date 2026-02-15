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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NativeAudioPlugin = any;

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
  private _volume = 1;

  private prompts: WeightedPrompt[] = [];
  private lastSentPrompts: WeightedPrompt[] = [];

  private readonly useNativeAudio: boolean;
  private readonly nativeAudio: NativeAudioPlugin | null;

  constructor(
    private readonly ai: GoogleGenAI,
    private readonly model: string,
    nativeAudioPlugin?: NativeAudioPlugin,
  ) {
    super();
    this.prompts = [];
    this.useNativeAudio = !!nativeAudioPlugin;
    this.nativeAudio = nativeAudioPlugin ?? null;
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    this.outputNode = this.audioContext.createGain();
    this.outputNode.gain.value = 1;
    console.log("[LiveMusicHelper] Constructor: AudioContext created, sample rate:", this.audioContext.sampleRate);
    console.log("[LiveMusicHelper] Constructor: useNativeAudio:", this.useNativeAudio);
  }

  private getSession(): Promise<LiveMusicSession> {
    if (!this.sessionPromise) this.sessionPromise = this.connect();
    return this.sessionPromise;
  }

  private async connect(): Promise<LiveMusicSession> {
    console.log("[LiveMusicHelper] Connecting to Lyria RealTime...");
    this.sessionPromise = this.ai.live.music.connect({
      model: this.model,
      callbacks: {
        onmessage: async (e: LiveMusicServerMessage) => {
          if (e.filteredPrompt) {
            console.log("[LiveMusicHelper] Filtered prompt:", e.filteredPrompt.text);
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
            console.log("[LiveMusicHelper] Received audio chunks:", e.serverContent.audioChunks.length);
            await this.processAudioChunks(e.serverContent.audioChunks);
          }
        },
        onclose: () => console.log("[LiveMusicHelper] Lyria RealTime stream closed."),
        onerror: (e: unknown) => {
          console.error("[LiveMusicHelper] Lyria RealTime error", e);
          this.stop();
          this.dispatchEvent(
            new CustomEvent("error", {
              detail: "Connection error, please restart audio.",
            }),
          );
        },
      },
    });
    const session = await this.sessionPromise;
    console.log("[LiveMusicHelper] Connected to Lyria RealTime successfully");
    return session;
  }

  private setPlaybackState(state: PlaybackState) {
    this.playbackState = state;
    this.dispatchEvent(
      new CustomEvent("playback-state-changed", { detail: state }),
    );
  }

  private async processAudioChunks(audioChunks: AudioChunk[]) {
    console.log("[LiveMusicHelper] processAudioChunks called, playbackState:", this.playbackState);

    if (this.playbackState === "paused" || this.playbackState === "stopped") {
      console.log("[LiveMusicHelper] Ignoring audio chunks, playback is paused/stopped");
      return;
    }

    this.checkPromptFreshness(this.getChunkTexts(audioChunks));

    if (this.useNativeAudio && this.nativeAudio) {
      // Send raw base64 PCM data directly to native for playback
      await this.nativeAudio.sendAudioChunk({ data: audioChunks[0].data });

      if (this.nextStartTime === 0) {
        this.nextStartTime = 1; // Flag that we've started buffering
        console.log("[LiveMusicHelper] First native audio chunk sent, waiting for buffer...");
        setTimeout(() => {
          this.setPlaybackState("playing");
        }, this.bufferTime * 1000);
      }
      return;
    }

    const audioBuffer = await decodeAudioData(
      decode(audioChunks[0].data!),
      this.audioContext,
      48000,
      2,
    );
    console.log("[LiveMusicHelper] Audio buffer decoded, duration:", audioBuffer.duration);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputNode);
    console.log("[LiveMusicHelper] Audio source created and connected to outputNode");

    if (this.nextStartTime === 0) {
      this.nextStartTime = this.audioContext.currentTime + this.bufferTime;
      console.log("[LiveMusicHelper] First audio chunk, scheduling playback at:", this.nextStartTime);
      setTimeout(() => {
        this.setPlaybackState("playing");
      }, this.bufferTime * 1000);
    }

    if (this.nextStartTime < this.audioContext.currentTime) {
      console.log("[LiveMusicHelper] Buffer underrun! nextStartTime:", this.nextStartTime, "currentTime:", this.audioContext.currentTime);
      this.setPlaybackState("loading");
      this.nextStartTime = 0;
      return;
    }

    source.start(this.nextStartTime);
    console.log("[LiveMusicHelper] Audio source started at:", this.nextStartTime, "duration:", audioBuffer.duration);
    this.nextStartTime += audioBuffer.duration;
    console.log("[LiveMusicHelper] Next start time:", this.nextStartTime);
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

  public get volume(): number {
    return this._volume;
  }

  public setVolume(value: number) {
    this._volume = Math.max(0, Math.min(1, value));

    if (this.useNativeAudio && this.nativeAudio) {
      this.nativeAudio.setVolume({ volume: this._volume });
      return;
    }

    if (this.playbackState === "playing") {
      this.outputNode.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.outputNode.gain.setValueAtTime(
        this.outputNode.gain.value,
        this.audioContext.currentTime,
      );
      this.outputNode.gain.linearRampToValueAtTime(
        this._volume,
        this.audioContext.currentTime + 0.05,
      );
    }
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
    console.log("[LiveMusicHelper] play() called");
    console.log("[LiveMusicHelper] Current volume:", this._volume);

    this.setPlaybackState("loading");
    this.session = await this.getSession();
    console.log("[LiveMusicHelper] Session created:", !!this.session);

    void this.setWeightedPromptsImmediate();

    if (this.useNativeAudio && this.nativeAudio) {
      // Set up native audio engine (buffering + playback handled by native side)
      await this.nativeAudio.setup();
      await this.nativeAudio.setVolume({ volume: this._volume });
      console.log("[LiveMusicHelper] Native audio engine set up");
    } else {
      await this.audioContext.resume();
      console.log("[LiveMusicHelper] AudioContext state after resume:", this.audioContext.state);
    }

    this.session.play();
    console.log("[LiveMusicHelper] Session.play() called");

    if (!this.useNativeAudio) {
      this.outputNode.connect(this.audioContext.destination);
      console.log("[LiveMusicHelper] OutputNode connected to destination");

      if (this.extraDestination) this.outputNode.connect(this.extraDestination);
      this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.outputNode.gain.linearRampToValueAtTime(
        this._volume,
        this.audioContext.currentTime + 0.1,
      );
      console.log("[LiveMusicHelper] Gain ramp scheduled from 0 to", this._volume);
    }
  }

  public pause() {
    if (this.session) this.session.pause();
    this.setPlaybackState("paused");

    if (this.useNativeAudio && this.nativeAudio) {
      this.nativeAudio.stop().catch(() => {});
    } else {
      this.outputNode.gain.setValueAtTime(1, this.audioContext.currentTime);
      this.outputNode.gain.linearRampToValueAtTime(
        0,
        this.audioContext.currentTime + 0.1,
      );
      this.outputNode = this.audioContext.createGain();
    }

    this.nextStartTime = 0;
  }

  public stop() {
    this.setPlaybackState("stopped");
    this.nextStartTime = 0;

    if (this.useNativeAudio && this.nativeAudio) {
      this.nativeAudio.stop().catch(() => {});
    }

    if (this.session) {
      if (!this.useNativeAudio) {
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
      } else {
        this.session.stop();
      }
    }
    this.session = null;
    this.sessionPromise = null;
  }

  public async forceSpeaker() {
    if (!this.useNativeAudio || !this.nativeAudio) return;
    return this.nativeAudio.forceSpeaker();
  }

  public async useDefaultRoute() {
    if (!this.useNativeAudio || !this.nativeAudio) return;
    return this.nativeAudio.useDefaultRoute();
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
