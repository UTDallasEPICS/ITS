import { defineCustomElement } from 'vue'
import WidgetRoot from './WidgetRoot.ce.vue'

// Must be read right away; it becomes null once this script finishes
const script = document.currentScript as HTMLScriptElement | null

// Same as widget-test.js: read the site tag and the ITS origin from our own <script> tag
const siteTag = script?.dataset.siteTag ?? ''
const apiBase = script?.src ? new URL(script.src).origin : ''

// Register <its-widget> once. Re-including this script must not throw.
if (!customElements.get('its-widget')) {
  customElements.define('its-widget', defineCustomElement(WidgetRoot))
}

// Mount once. A duplicate embed reuses the element that is already on the page.
if (!document.querySelector('its-widget[data-its-widget]')) {
  if (!apiBase) {
    console.warn('[ITS widget] load this script with a src attribute to determine the API origin')
  } else {
    const el = document.createElement('its-widget')
    el.setAttribute('data-its-widget', '')
    el.setAttribute('site-tag', siteTag)
    el.setAttribute('api-base', apiBase)

    if (document.body) {
      document.body.appendChild(el)
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el), { once: true })
    }
  }
}
