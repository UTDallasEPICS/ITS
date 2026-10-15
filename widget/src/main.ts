import { defineCustomElement } from 'vue'
import WidgetRoot from './WidgetRoot.ce.vue'

// Must be read right away; it becomes null once this script finishes
const script = document.currentScript as HTMLScriptElement | null

// Same as widget-test.js: read the site tag and the ITS origin from our own <script> tag
const siteTag = script?.dataset.siteTag ?? ''
const apiBase = script ? new URL(script.src).origin : ''

// Register <its-widget> as a custom element; Vue renders it inside a Shadow DOM
customElements.define('its-widget', defineCustomElement(WidgetRoot))

// Create the element, pass the values in, and attach it to the host page
const el = document.createElement('its-widget')
el.setAttribute('site-tag', siteTag)
el.setAttribute('api-base', apiBase)
document.body.appendChild(el)
