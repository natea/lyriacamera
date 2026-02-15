/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

import { html, LitElement, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { when } from "lit/directives/when.js";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { urlargs } from "../utils/urlargs";
import { defineSystemPrompt } from "../utils/define_system_prompt";
import { LiveMusicHelper } from "../utils/live_music_helper";

import {
  DEFAULT_INTERVAL_PRESET,
  GEMINI_MODEL,
  IMAGE_MIME_TYPE,
  INTERVAL_PRESETS,
  MAX_CAPTURE_DIM,
  PREFERRED_STREAM_PARAMS,
} from "../utils/constants";

import styles from "./lyria_camera_styles";

import type { ToastMessage } from "./toast_message";
import "./toast_message";

import type {
  PlaybackState,
  Prompt,
  AppState,
  FacingMode,
  IntervalPreset,
  StreamSource,
  Page,
} from "../utils/types";

defineSystemPrompt();

@customElement("lyria-camera")
export class LyriaCamera extends LitElement {
  static override styles = styles;

  private liveMusicHelper!: LiveMusicHelper;
  private ai!: GoogleGenAI;

  @state() private page: Page = "splash";
  @state() private appState: AppState = "idle";
  @state() private playbackState: PlaybackState = "stopped";

  @state() private prompts: Prompt[] = [];
  @state() private promptsStale = false;
  @state() private promptsLoading = false;

  // tracks whether or not we've received audio. dictates whether the countdown
  // timer should restart immediately or if we should wait for first play
  @state() private hasAudioChunks = false;

  @state() private supportsScreenShare = false;
  @state() private hasMultipleCameras = false;

  @state() private isVideoFlipped = false;

  @state() private lastCapturedImage: string | null = null;
  @state() private currentFacingMode: FacingMode = "environment";
  @state() private currentSource: StreamSource = "none";
  @state() private intervalPreset = DEFAULT_INTERVAL_PRESET;
  @state() private captureCountdown = 0;
  @state() private volume = 1;

  @query("video") private videoElement!: HTMLVideoElement;
  @query("toast-message") private toastMessageElement!: ToastMessage;

  private canvasElement: HTMLCanvasElement = document.createElement("canvas");

  private nextCaptureTime = 0;
  private timerRafId: number | null = null;
  private crossfadeIntervalId: number | null = null;

  // manages crossfading prompts
  private currentWeightedPrompts: Prompt[] = [];

  override async connectedCallback() {
    super.connectedCallback();

    this.ai = new GoogleGenAI({
      apiKey: process.env.API_KEY,
      apiVersion: "v1alpha",
    });

    const nativeAudio = Capacitor.isNativePlatform()
      ? registerPlugin("NativeAudio")
      : undefined;
    this.liveMusicHelper = new LiveMusicHelper(
      this.ai,
      "lyria-realtime-exp",
      nativeAudio,
    );

    this.liveMusicHelper.addEventListener(
      "playback-state-changed",
      (e: CustomEvent<PlaybackState>) => this.handlePlaybackStateChange(e),
    );

    this.liveMusicHelper.addEventListener(
      "prompts-fresh",
      () => (this.promptsStale = false),
    );

    this.liveMusicHelper.addEventListener("error", (e: CustomEvent<string>) => {
      this.dispatchError(e.detail);
    });

    if (urlargs.debugPrompts) {
      this.prompts = [
        { text: "Ambient synth pads", weight: 1.0 },
        { text: "Lofi hip hop drums", weight: 1.0 },
        { text: "Jazzy piano chords", weight: 1.0 },
      ];
    }

    this.supportsScreenShare = !!navigator.mediaDevices?.getDisplayMedia;
    void this.updateCameraCapabilities();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.stopTimer();
    this.stopCurrentStream();
    this.liveMusicHelper.removeEventListener(
      "playback-state-changed",
      this.handlePlaybackStateChange.bind(this),
    );
    this.liveMusicHelper.removeEventListener(
      "prompts-fresh",
      () => (this.promptsStale = false),
    );
  }

  private stopCurrentStream() {
    if (!this.videoElement.srcObject) return;
    (this.videoElement.srcObject as MediaStream)
      .getTracks()
      .forEach((track) => track.stop());
  }

  private async updateCameraCapabilities() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === "videoinput");
    this.hasMultipleCameras = videoDevices.length > 1;
  }

  private async setupCamera() {
    this.stopCurrentStream();

    const facingModesToTry: FacingMode[] = [
      this.currentFacingMode,
      this.currentFacingMode === "user" ? "environment" : "user",
    ];

    let stream: MediaStream | null = null;
    for (const facingMode of facingModesToTry) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...PREFERRED_STREAM_PARAMS,
            facingMode,
          },
          audio: false, // Explicitly disable audio to prevent mic from activating
        });
        this.currentFacingMode = facingMode;
        break; // Success!
      } catch (e) {
        console.warn(`Could not get ${facingMode} camera.`, e);
      }
    }

    if (!stream) {
      console.error("Error accessing webcam: no camera found.");
      this.dispatchError(
        "Could not access webcam. Please grant camera permission.",
      );
      return;
    }

    // flip the front facing camera
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const flipped = settings.facingMode !== "environment";
    this.setStream(stream, "camera", flipped);
  }

  private async switchCamera() {
    this.currentFacingMode =
      this.currentFacingMode === "user" ? "environment" : "user";
    await this.setupCamera();
  }

  private async setupScreenShare() {
    try {
      this.stopCurrentStream();
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      this.setStream(stream, "screen", false);
    } catch (err) {
      console.error("Error starting screen share:", err);
      this.dispatchError("Could not start screen sharing.");
    }
  }

  private setStream(
    stream: MediaStream,
    source: StreamSource,
    flipped: boolean,
  ) {
    if (!stream) return;
    this.isVideoFlipped = flipped;
    this.videoElement.srcObject = stream;
    this.videoElement.onloadedmetadata = async () => {
      await this.videoElement.play();
      this.currentSource = source;
      this.page = "main";
      void this.updateCameraCapabilities();
    };

    // Listen for stream end (e.g., user stops screen share or camera disconnects)
    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => this.handleStreamEnded());
    });
  }

  private async handleStreamEnded() {
    console.log("Stream ended");
    await this.requestStop();
    this.currentSource = "none";
    this.page = "splash";
  }

  private startTimer() {
    console.log("start timer");
    this.stopTimer();
    this.nextCaptureTime =
      performance.now() + this.intervalPreset.captureSeconds * 1000;
    this.tick();
  }

  private tick = () => {
    const remainingMs = this.nextCaptureTime - performance.now();
    this.captureCountdown = Math.max(0, Math.ceil(remainingMs / 1000));

    if (remainingMs <= 0) {
      void this.captureAndGenerate();
    } else {
      this.timerRafId = requestAnimationFrame(this.tick);
    }
  };

  private stopTimer() {
    if (!this.timerRafId) return;
    cancelAnimationFrame(this.timerRafId);
    this.timerRafId = null;
  }

  private async captureAndGenerate() {
    if (this.promptsLoading || !["main", "interval"].includes(this.page))
      return;

    this.promptsLoading = true;

    const snapshotDataUrl = this.getStreamSnapshot();
    this.lastCapturedImage = snapshotDataUrl;
    const base64ImageData = snapshotDataUrl.split(",")[1];

    try {
      console.time("get prompts");
      const response = await this.ai.models.generateContent(
        this.getGenerateContentParams(base64ImageData),
      );
      console.timeEnd("get prompts");

      const json = JSON.parse(response.text);
      const newPromptTexts: string[] = json.prompts;

      // if the user has paused since requesting, don't send prompts.
      if (this.appState === "idle") return;

      this.prompts = newPromptTexts.map((text) => ({
        text: text,
        weight: 1.0,
        isNew: true,
      }));

      // remove the isNew flag after the animation completes
      setTimeout(() => {
        this.prompts = this.prompts.map((p) => ({ ...p, isNew: false }));
      }, 1000);

      this.startCrossfade(newPromptTexts);

      if (this.appState === "pendingStart") {
        console.log("[LyriaCamera] Starting music playback");
        await this.liveMusicHelper.play();
        this.appState = "playing";
        console.log("[LyriaCamera] State changed to playing");
      }
    } catch (e) {
      console.error(e);
      this.dispatchError("Failed to generate prompts from image.");
    } finally {
      this.promptsLoading = false;
      if (this.appState === "pendingStart") {
        this.appState = "idle";
      }
      if (this.hasAudioChunks) {
        this.startTimer();
      }
    }
  }

  private getStreamSnapshot() {
    const { videoWidth, videoHeight } = this.videoElement;
    let drawWidth = videoWidth;
    let drawHeight = videoHeight;

    if (drawWidth > MAX_CAPTURE_DIM || drawHeight > MAX_CAPTURE_DIM) {
      const aspectRatio = drawWidth / drawHeight;
      if (drawWidth > drawHeight) {
        drawWidth = MAX_CAPTURE_DIM;
        drawHeight = MAX_CAPTURE_DIM / aspectRatio;
      } else {
        drawHeight = MAX_CAPTURE_DIM;
        drawWidth = MAX_CAPTURE_DIM * aspectRatio;
      }
    }

    this.canvasElement.width = drawWidth;
    this.canvasElement.height = drawHeight;

    const context = this.canvasElement.getContext("2d");
    context.drawImage(this.videoElement, 0, 0, drawWidth, drawHeight);

    return this.canvasElement.toDataURL(IMAGE_MIME_TYPE);
  }

  private getGenerateContentParams(base64ImageData: string) {
    return {
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: IMAGE_MIME_TYPE,
              data: base64ImageData,
            },
          },
          {
            text: window.systemPrompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              description: "A list of 3 creative music prompts.",
              items: {
                type: Type.STRING,
              },
            },
          },
        },
      },
    };
  }

  private sendWeightedPrompts(weighted: Prompt[]) {
    // don't send if we don't have any prompts >0 weight
    const hasActive = weighted.some((p) => p.weight > 0);
    if (!hasActive) return;
    this.promptsStale = true;
    void this.liveMusicHelper.setWeightedPrompts(weighted);
  }

  private startCrossfade(newPromptTexts: string[]) {
    let crossfadeSeconds = this.intervalPreset.crossfadeSeconds;
    if (this.currentWeightedPrompts.length === 0) {
      crossfadeSeconds = 0;
    }
    console.log("[prompts] update", { newPromptTexts, crossfadeSeconds });

    this.stopCrossfade();

    const targetPrompts = newPromptTexts.map((text) => ({
      text,
      weight: 0,
    }));

    const fromPrompts = [...this.currentWeightedPrompts];
    const startTime = performance.now();
    const durationMs = crossfadeSeconds * 1000;

    const update = () =>
      this.updateCrossfade(fromPrompts, targetPrompts, startTime, durationMs);

    update();

    if (crossfadeSeconds > 0) {
      this.crossfadeIntervalId = window.setInterval(update, 2000);
    }
  }

  private stopCrossfade() {
    if (this.crossfadeIntervalId) {
      clearInterval(this.crossfadeIntervalId);
      this.crossfadeIntervalId = null;
    }
  }

  private updateCrossfade(
    fromPrompts: Prompt[],
    targetPrompts: Prompt[],
    startTime: number,
    durationMs: number,
  ) {
    const now = performance.now();
    const t = durationMs > 0 ? Math.min(1, (now - startTime) / durationMs) : 1;

    const fadedOut = fromPrompts.map((p) => ({
      ...p,
      weight: p.weight * (1 - t),
    }));
    const fadedIn = targetPrompts.map((p) => ({ ...p, weight: t }));

    const blended = [...fadedOut, ...fadedIn];
    this.currentWeightedPrompts = blended;
    this.sendWeightedPrompts(blended);

    const displayWeights = blended.map((p) => ({
      text: p.text,
      weight: Number(p.weight.toFixed(3)),
    }));

    console.log("[weights] step", t.toFixed(2), displayWeights);

    if (t >= 1 || this.appState === "idle") {
      this.stopCrossfade();
      console.log("[weights] crossfade complete");
    }
  }

  private handlePlaybackStateChange(e: CustomEvent<PlaybackState>) {
    this.playbackState = e.detail;

    if (this.playbackState === "playing" && !this.hasAudioChunks) {
      this.hasAudioChunks = true;
      this.startTimer();
    }

    if (this.playbackState === "paused") {
      this.stopTimer();
      this.captureCountdown = 0;
    }
  }

  private async handlePlayPause() {
    console.log("[LyriaCamera] handlePlayPause called, appState:", this.appState);
    if (this.page !== "main") return;
    switch (this.appState) {
      case "idle": {
        // Resume AudioContext immediately from the user gesture.
        // iOS WKWebView requires this to happen synchronously in the
        // tap handler — awaiting any async work first breaks the chain.
        console.log("[LyriaCamera] Resuming AudioContext from user gesture");
        void this.liveMusicHelper.audioContext.resume();
        this.appState = "pendingStart";
        console.log("[LyriaCamera] State changed to pendingStart");

        await this.captureAndGenerate();
        return;
      }
      case "pendingStart":
      case "playing": {
        console.log("[LyriaCamera] Requesting stop");
        await this.requestStop();
        return;
      }
    }
  }

  private async requestStop() {
    console.log("requestStop");
    this.stopTimer();
    this.prompts = [];
    this.liveMusicHelper.stop();
    this.appState = "idle";
    this.hasAudioChunks = false;
    this.currentWeightedPrompts = [];
    this.lastCapturedImage = null;
    this.promptsLoading = false;
    this.promptsStale = false;
  }

  private captureNow() {
    if (this.promptsLoading || this.page !== "main") return;
    this.nextCaptureTime = performance.now();
  }

  private openIntervalSheet = () => {
    this.page = "interval";
  };

  private closeIntervalSheet = () => {
    this.page = "main";
  };

  private setIntervalPreset(preset: IntervalPreset) {
    this.intervalPreset = preset;
    if (this.appState !== "idle") this.startTimer();
  }

  private formatCountdown(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  private handleVolumeChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.volume = parseFloat(input.value);
    this.liveMusicHelper.setVolume(this.volume);
  }

  private isForcedSpeaker = false;

  private async showRoutePicker() {
    try {
      if (this.isForcedSpeaker) {
        console.log("[AudioRoute] Restoring default route...");
        await this.liveMusicHelper.useDefaultRoute();
        this.isForcedSpeaker = false;
        console.log("[AudioRoute] Default route restored");
      } else {
        console.log("[AudioRoute] Forcing speaker output...");
        await this.liveMusicHelper.forceSpeaker();
        this.isForcedSpeaker = true;
        console.log("[AudioRoute] Speaker output forced");
      }
    } catch (e) {
      console.warn("[AudioRoute] Failed:", e);
    }
  }

  private dispatchError(message: string) {
    this.toastMessageElement.show(message);
  }

  override render() {
    this.classList.toggle("screenshare", this.currentSource === "screen");
    return html`
      <div id="video-container">
        <video
          playsinline
          muted
          style=${styleMap({
            transform: this.isVideoFlipped ? "scaleX(-1)" : "none",
          })}
        ></video>
      </div>
      <div
        id="overlay"
        class=${classMap({
          "has-played": this.hasAudioChunks,
        })}
      >
        ${this.renderPage()}
      </div>
      <toast-message></toast-message>
    `;
  }

  private renderPage() {
    switch (this.page) {
      case "splash":
        return this.renderSplash();
      case "main":
        return this.renderMain();
      case "interval":
        return this.renderIntervalSheet();
      default:
        return nothing;
    }
  }

  private renderSplash() {
    return html`
      <div id="splash">
        <button class="control-button" @click=${this.setupCamera}>
          <span class="material-icons-round">videocam</span>
          Start Camera
        </button>
        ${when(
          this.supportsScreenShare,
          () => html`
            <button class="control-button" @click=${this.setupScreenShare}>
              <span class="material-icons-round">screen_share</span>
              Share Screen
            </button>
          `,
        )}
        <p>
          Turn your world into music with
          <a
            href="https://deepmind.google/models/lyria/lyria-realtime/"
            target="_blank"
            >Lyria RealTime</a
          >.
        </p>
        <p class="more-link">
          <a
            href="https://magenta.withgoogle.com/lyria-camera-announce"
            target="_blank"
            >Watch a demo video</a
          >
        </p>
      </div>
    `;
  }

  private renderMain() {
    const videoStyles = {
      transform: this.isVideoFlipped ? "scaleX(-1)" : "none",
    };

    return html`
      ${when(
        this.hasMultipleCameras && this.currentSource === "camera",
        () => html`
          <button id="camera-switch-button" @click=${this.switchCamera}>
            <span class="material-icons-outlined">flip_camera_android</span>
          </button>
        `,
      )}
      <div id="prompts-container">
        ${this.prompts.map((prompt, i) => {
          const promptClasses = {
            "prompt-tag": true,
            new: prompt.isNew || false,
            stale: this.promptsStale,
          };
          const promptStyles = {
            "animation-delay": `${i * 100}ms`,
          };
          return html`
            <div
              class=${classMap(promptClasses)}
              style=${styleMap(promptStyles)}
            >
              ${prompt.text}
            </div>
          `;
        })}
      </div>
      <div id="controls-container">
        <div id="controls">
          <div id="control-stack">
            ${this.renderPlayPauseButton()}
            <div
              id="capture-wrapper"
              class=${classMap({
                hidden: this.playbackState !== "playing",
              })}
            >
              ${this.renderCaptureNowButton()}
            </div>
            ${this.renderStatusText()}
          </div>
        </div>
      </div>
      <div
        id="pip-container"
        class=${classMap({
          visible: !!this.lastCapturedImage,
        })}
        @click=${this.openIntervalSheet}
        title="Capture Interval"
      >
        ${when(
          this.lastCapturedImage,
          () => html`
            <img
              src=${this.lastCapturedImage}
              alt="Last captured frame for analysis"
              style=${styleMap(videoStyles)}
            />
          `,
        )}
        ${when(
          this.promptsLoading ||
            this.playbackState === "loading" ||
            this.promptsStale,
          () => html`
            <div class="pip-loading-overlay">
              <div class="pip-spinner"></div>
            </div>
          `,
        )}
      </div>

      <div id="volume-control">
        <span class="material-icons-round volume-icon">
          ${this.volume === 0
            ? "volume_off"
            : this.volume < 0.5
              ? "volume_down"
              : "volume_up"}
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          .value=${String(this.volume)}
          @input=${this.handleVolumeChange}
          aria-label="Music volume"
          style="--volume-pct: ${this.volume * 100}%"
        />
      </div>

      <button
        id="route-picker-button"
        @click=${this.showRoutePicker}
        title="Audio Output"
      >
        <span class="material-icons-round">speaker</span>
      </button>

      <button
        id="interval-button"
        @click=${this.openIntervalSheet}
        title="Capture Interval"
      >
        <span class="material-icons-outlined">timer</span>
      </button>
    `;
  }

  private renderStatusText() {
    const classes = {
      shimmer:
        this.promptsLoading ||
        this.playbackState === "loading" ||
        this.promptsStale,
    };

    let text = "";
    if (this.promptsLoading) {
      text = "Getting prompts...";
    } else if (this.playbackState === "loading" || this.promptsStale) {
      text = "Generating music...";
    } else if (this.captureCountdown > 0 && this.playbackState === "playing") {
      text = `Next capture in ${this.formatCountdown(this.captureCountdown)}`;
    } else if (this.appState === "idle") {
      text = "Press play to generate";
    }

    return html`<div id="status-text" class=${classMap(classes)}>${text}</div>`;
  }

  private renderIntervalSheet() {
    return html`<div
        id="interval-sheet-backdrop"
        @click=${this.closeIntervalSheet}
      ></div>
      <div id="interval-sheet">
        <div class="sheet-header">
          <div class="sheet-title">Capture Interval</div>
          <button class="sheet-close" @click=${this.closeIntervalSheet}>
            ✕
          </button>
        </div>
        <div class="interval-options">
          ${INTERVAL_PRESETS.map(
            (p) => html`
              <div
                class="interval-option"
                @click=${() => this.setIntervalPreset(p)}
              >
                <div
                  class=${classMap({
                    circle: true,
                    selected: this.intervalPreset === p,
                  })}
                >
                  <div class="value">${p.labelValue}</div>
                  <div class="sub">${p.labelSub}</div>
                </div>
              </div>
            `,
          )}
        </div>
      </div>`;
  }

  private renderPlayPauseButton() {
    const isPlaying =
      this.appState === "pendingStart" ||
      this.appState === "playing" ||
      this.playbackState === "loading" ||
      this.playbackState === "playing" ||
      this.timerRafId !== null;

    return html`<button
      class="playpause-button"
      @click=${this.handlePlayPause}
      aria-label=${isPlaying ? "Stop" : "Play"}
    >
      <div class="playpause-visual">
        <div class="playpause-ring"></div>
        ${isPlaying
          ? html`<div class="playpause-inner square"></div>`
          : html`<span class="material-icons-round playpause-play-icon"
              >play_arrow</span
            >`}
      </div>
    </button>`;
  }

  private renderCaptureNowButton() {
    if (this.playbackState === "playing") {
      return html`
        <button
          class="control-button"
          @click=${this.captureNow}
          ?disabled=${this.promptsLoading}
        >
          <span class="material-icons-outlined" aria-hidden="true"
            >photo_camera</span
          >
          Capture Now
        </button>
      `;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lyria-camera": LyriaCamera;
  }
}
