/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export default css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    position: relative;
    background: #000;
    -webkit-font-smoothing: antialiased;
  }

  .material-icons-outlined {
    font-family: "Material Icons Outlined";
  }
  .material-icons-round {
    font-family: "Material Icons Round";
  }
  .material-icons-outlined,
  .material-icons-round {
    font-weight: normal;
    font-style: normal;
    font-size: 24px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: "liga";
    -webkit-font-smoothing: antialiased;
    /* prevents fout jumping */
    width: 1.2rem;
  }

  #video-container {
    background: #000;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  :host(.screenshare) video {
    object-fit: contain;
  }

  button {
    cursor: pointer;
  }

  #overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    background: transparent;
    transition: background-image 0.5s ease;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    justify-content: flex-end;
    background: linear-gradient(
      rgba(0, 0, 0, 0.7) 50px,
      rgba(0, 0, 0, 0) 27%,
      rgba(0, 0, 0, 0) 81.7%,
      rgba(0, 0, 0, 0.933) 100%
    );
  }

  :host(.screenshare) #overlay {
    background: radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0.8) 100%
    );
  }

  .more-link {
    font-size: 13px;
  }
  .more-link a {
    opacity: 0.5;
    text-decoration: none;
  }

  #controls-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    z-index: 6;
  }

  #prompts-container {
    position: absolute;
    top: 15px;
    left: 15px;
    right: 55px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    z-index: 4;
  }

  .prompt-tag {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    padding: 0.5rem 1rem;
    border-radius: 2rem;
    font-size: 14px;
    font-weight: 400;
    transition: all 0.3s ease;
  }

  @keyframes prompt-intro {
    from {
      transform: translateY(-20%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes pulse-opacity {
    0%,
    100% {
      color: #fff;
    }
    50% {
      color: #fff5;
    }
  }

  .prompt-tag.stale {
    animation: pulse-opacity 1s ease-in-out infinite forwards;
  }

  .prompt-tag.new {
    animation: prompt-intro 0.5s ease-out both;
  }

  #controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  #control-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  #main-controls {
    display: none;
  }

  .playpause-button {
    width: 80px;
    height: 80px;
    border: none;
    background: transparent;
    padding: 0;
    border-radius: 50%;
    position: relative;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .playpause-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .playpause-visual {
    position: absolute;
    inset: 0;
    transition: transform 0.2s cubic-bezier(0.44, 1.71, 1, 1);
  }

  .playpause-button:active .playpause-visual {
    transition: transform 0.3s ease-out;
    transform: scale(0.9);
    transition: none;
  }

  .playpause-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid #fff;
    background: rgba(0, 0, 0, 0.125);
  }

  .playpause-inner {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    aspect-ratio: 1;
    background: #ff2d2d;
    border-radius: 50%;
    transition:
      border-radius 150ms ease,
      width 150ms ease,
      height 150ms ease;
  }

  .playpause-inner.square {
    border-radius: 8px;
    width: 40px;
    height: 40px;
  }

  .playpause-play-icon {
    position: absolute;
    inset: 0;
    width: 100%;
    font-size: 80px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-button {
    background: rgba(30, 30, 30, 0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 2rem;
    font-size: 1rem;
    transition:
      background-color 0.2s,
      opacity 0.2s;
    font-family: "Google Sans", sans-serif;
    font-weight: 500;
    -webkit-tap-highlight-color: transparent;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .control-button .material-icons-round,
  .control-button .material-icons-outlined {
    font-size: 1.2em;
  }

  .control-button:hover:not(:disabled) {
    background: rgba(30, 30, 30, 0.5);
  }

  .control-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .control-button.start-button {
    margin: 1rem 0;
  }

  a.control-button {
    text-decoration: none;
  }

  #splash {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    gap: 10px;
  }

  #splash p {
    margin: 0;
    max-width: 400px;
    margin-top: 1rem;
    text-align: center;
    line-height: 1.5;
    text-wrap: balance;
  }

  #splash a {
    color: white;
    font-weight: bold;
  }

  #status-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    height: 1.2em;
  }

  #status-text.shimmer {
    position: relative;
    color: transparent;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.5) 20%,
      rgba(255, 255, 255, 1) 50%,
      rgba(255, 255, 255, 0.5) 80%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    animation: shimmer-slide 2.25s linear infinite;
  }

  @keyframes shimmer-slide {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* reserve space for the capture button so the play/pause doesn't move */
  #capture-wrapper {
    height: 54px;
    display: flex;
    align-items: center;
  }

  #capture-wrapper.hidden {
    visibility: hidden;
  }

  #pip-container {
    position: absolute;
    bottom: 5px;
    left: 5px;
    width: clamp(60px, 22vw, 140px);
    overflow: hidden;
    border-radius: 4px;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
    background: #111;
    transition: opacity 0.5s ease;
    border: 1px solid rgba(255, 255, 255, 0.2);
    opacity: 0;
    pointer-events: none;
    z-index: 3;
  }

  #pip-container.visible {
    opacity: 1;
  }

  #pip-container img {
    width: 100%;
    height: auto;
    object-fit: contain;
    display: block;
  }

  .pip-loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pip-spinner {
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    width: 30px;
    height: 30px;
    box-sizing: border-box;
    transform-origin: center center;
    will-change: transform;
    animation: spin 1s linear infinite;
  }

  #camera-switch-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: transparent;
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 6;
  }

  #route-picker-button {
    position: absolute;
    bottom: 58px;
    right: 10px;
    width: 48px;
    height: 48px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    background: transparent;
    border: none;
    color: #fff;
    z-index: 6;
    opacity: 0.8;
  }

  #interval-button {
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 48px;
    height: 48px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    background: transparent;
    border: none;
    color: #fff;
    z-index: 6;
  }

  #interval-sheet-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 5;
  }

  #interval-sheet {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 12px;
    outline: 1px solid red;
    color: #fff;
    z-index: 6;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.55),
      rgba(0, 0, 0, 0.85)
    );
    user-select: none;
  }
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 10px;
  }
  .sheet-title {
    font-size: 16px;
  }
  .sheet-close {
    background: transparent;
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 66px;
    height: 66px;
    cursor: pointer;
    font-size: 36px;
  }
  .interval-options {
    height: 100%;
    align-items: center;
    justify-content: center;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  @media (max-height: 600px) {
    .interval-options {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      padding: 0 1rem;
    }
  }
  .interval-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    color: #fff;
    text-align: center;
    cursor: pointer;
  }
  .interval-option .circle {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 3px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    font-size: 1.8rem;
  }
  .interval-option .circle .value {
    line-height: 1;
    font-weight: 400;
  }
  .interval-option .circle.selected {
    border-color: #fff;
  }
  .interval-option .sub {
    letter-spacing: 0.3em;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.9);
  }

  #volume-control {
    position: absolute;
    bottom: 14px;
    right: 56px;
    display: flex;
    align-items: center;
    gap: 4px;
    z-index: 6;
  }

  .volume-icon {
    color: rgba(255, 255, 255, 0.8);
    font-size: 20px;
    width: 20px;
  }

  #volume-control input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 80px;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      rgba(255, 255, 255, 0.8) 0%,
      rgba(255, 255, 255, 0.8) var(--volume-pct, 100%),
      rgba(255, 255, 255, 0.2) var(--volume-pct, 100%),
      rgba(255, 255, 255, 0.2) 100%
    );
    outline: none;
    cursor: pointer;
  }

  #volume-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  #volume-control input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: none;
    cursor: pointer;
  }

  #splash .control-button {
    background: rgb(0, 119, 57);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;
