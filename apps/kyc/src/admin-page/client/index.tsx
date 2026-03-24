import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AdminApp } from './admin-app';

// @ts-expect-error — injected at build time by esbuild define
declare const __ADMIN_CSS__: string;

class KycAdminElement extends HTMLElement {
  static observedAttributes = ['api', 'auth-token', 'locale'];

  private root: Root | null = null;
  private mountPoint: HTMLDivElement | null = null;

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = typeof __ADMIN_CSS__ === 'string' ? __ADMIN_CSS__ : '';
    shadow.appendChild(style);

    this.mountPoint = document.createElement('div');
    this.mountPoint.setAttribute('id', 'kyc-admin-root');
    this.mountPoint.style.width = '100%';
    shadow.appendChild(this.mountPoint);

    this.root = createRoot(this.mountPoint);
    this.renderApp();
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

    const api = this.getAttribute('api') || '';
    const authToken = this.getAttribute('auth-token') || '';
    const locale = this.getAttribute('locale') || 'es';

    this.root.render(
      <AdminApp
        api={api}
        authToken={authToken}
        locale={locale}
        onEvent={this.emitEvent}
      />
    );
  }
}

if (!customElements.get('kyc-admin')) {
  customElements.define('kyc-admin', KycAdminElement);
}
