import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { WidgetApp } from './widget-app';

// @ts-expect-error — injected at build time by esbuild define
declare const __WIDGET_CSS__: string;

class KycWidgetElement extends HTMLElement {
  static observedAttributes = ['token', 'api', 'locale', 'config'];

  private root: Root | null = null;
  private mountPoint: HTMLDivElement | null = null;

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });

    // Inject scoped styles into shadow root
    const style = document.createElement('style');
    style.textContent = typeof __WIDGET_CSS__ === 'string' ? __WIDGET_CSS__ : '';
    shadow.appendChild(style);

    // Create mount point
    this.mountPoint = document.createElement('div');
    this.mountPoint.setAttribute('id', 'kyc-widget-root');
    this.mountPoint.style.display = 'flex';
    this.mountPoint.style.flexDirection = 'column';
    this.mountPoint.style.width = '100%';
    this.mountPoint.style.minHeight = '500px';
    shadow.appendChild(this.mountPoint);

    this.root = createRoot(this.mountPoint);
    this.renderApp();

    this.dispatchEvent(new CustomEvent('kyc:ready', {
      bubbles: true,
      detail: { version: '1.0' },
    }));
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  attributeChangedCallback() {
    this.renderApp();
  }

  private emitEvent = (name: string, detail: Record<string, unknown>) => {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  };

  private renderApp() {
    if (!this.root) return;

    const token = this.getAttribute('token') || '';
    const api = this.getAttribute('api') || '';
    const locale = this.getAttribute('locale') || 'es';
    let config: Record<string, unknown> | undefined;
    try {
      const configAttr = this.getAttribute('config');
      if (configAttr) config = JSON.parse(configAttr);
    } catch { /* ignore */ }

    this.root.render(
      <WidgetApp
        token={token}
        api={api}
        locale={locale}
        config={config}
        onEvent={this.emitEvent}
      />
    );
  }
}

if (!customElements.get('kyc-widget')) {
  customElements.define('kyc-widget', KycWidgetElement);
}

// ── SDK ──

interface KycWidgetOptions {
  apiKey?: string;
  token?: string;
  api?: string;
  userId: string;
  idData: {
    firstName?: string | null;
    lastName?: string | null;
    dniNumber?: string | null;
    birthDate?: string | null;
    gender?: string | null;
  };
  container: string | HTMLElement;
  locale?: string;
  callbackUrl?: string;
  callbackSecret?: string;
  onCompleted?: (result: { sessionId: string }) => void;
  onError?: (err: { message: string; code?: string; data?: Record<string, unknown> }) => void;
  onReady?: () => void;
}

interface KycWidgetInstance {
  destroy: () => void;
}

function detectApiUrl(): string {
  if (typeof document !== 'undefined' && document.currentScript) {
    const src = (document.currentScript as HTMLScriptElement).src;
    if (src) {
      const url = new URL(src);
      return url.origin;
    }
  }
  return '';
}

const detectedApiUrl = detectApiUrl();

function initWidget(options: KycWidgetOptions): KycWidgetInstance {
  const api = options.api || detectedApiUrl;
  if (!api) {
    throw new Error('KycWidget: api URL is required');
  }
  if (!options.apiKey && !options.token) {
    throw new Error('KycWidget: either apiKey or token is required');
  }
  if (!options.userId) {
    throw new Error('KycWidget: userId is required');
  }
  if (!options.idData) {
    throw new Error('KycWidget: idData is required — identity verification requires data to compare the scanned ID against');
  }
  if (!options.idData.dniNumber && !options.idData.firstName && !options.idData.lastName) {
    throw new Error('KycWidget: idData must contain at least dniNumber, firstName, or lastName');
  }

  const containerEl = typeof options.container === 'string'
    ? document.querySelector(options.container)
    : options.container;
  if (!containerEl) {
    throw new Error(`KycWidget: container "${options.container}" not found`);
  }

  // Pass config as attributes — session is created when the user starts the flow
  const widget = document.createElement('kyc-widget');
  widget.setAttribute('api', api);
  widget.setAttribute('locale', options.locale || 'es');
  widget.setAttribute('config', JSON.stringify({
    apiKey: options.apiKey,
    token: options.token,
    userId: options.userId,
    idData: options.idData || null,
    callbackUrl: options.callbackUrl || null,
    callbackSecret: options.callbackSecret || null,
  }));

  if (options.onCompleted) {
    widget.addEventListener('kyc:completed', ((e: CustomEvent) => {
      options.onCompleted!(e.detail as { sessionId: string });
    }) as EventListener);
  }

  if (options.onError) {
    widget.addEventListener('kyc:error', ((e: CustomEvent) => {
      options.onError!(e.detail as { message: string; code?: string });
    }) as EventListener);
  }

  if (options.onReady) {
    widget.addEventListener('kyc:ready', () => {
      options.onReady!();
    });
  }

  containerEl.appendChild(widget);

  return {
    destroy() {
      if (widget.parentNode) {
        widget.parentNode.removeChild(widget);
      }
    },
  };
}

// Expose global SDK
(window as any).KycWidget = { init: initWidget };
