/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("toast-message")
export class ToastMessage extends LitElement {
  static override styles = css`
    .toast {
      line-height: 1.6;
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      width: min(450px, 80vw);
      transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      z-index: 100;
    }
    button {
      border-radius: 50%;
      width: 24px;
      height: 24px;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      cursor: pointer;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .toast:not(.showing) {
      transition-duration: 1s;
      transform: translate(-50%, -200%);
    }
    a {
      color: #a7c5ff;
      text-decoration: underline;
    }
  `;

  @property({ type: String }) message = "";
  @property({ type: Boolean }) showing = false;

  private renderMessageWithLinks() {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = this.message.split(urlRegex);
    return parts.map((part, i) => {
      if (i % 2 === 0) return part;
      return html`<a href=${part} target="_blank" rel="noopener">${part}</a>`;
    });
  }

  override render() {
    return html`<div class=${classMap({ showing: this.showing, toast: true })}>
      <div class="message">${this.renderMessageWithLinks()}</div>
      <button @click=${this.hide}>✕</button>
    </div>`;
  }

  show(message: string) {
    this.showing = true;
    this.message = message;
  }

  hide() {
    this.showing = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "toast-message": ToastMessage;
  }
}
