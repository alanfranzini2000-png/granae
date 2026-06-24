import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import './index.css'
import { getUsuario } from "./usuario"

// Interceptor global: injeta o header X-Usuario em toda chamada à API, para que
// todos os fetch espalhados pelas páginas usem a base ativa sem alterar cada
// call site. Guard p/ não embrulhar duas vezes no hot-reload (HMR).
const API_BASE = "http://127.0.0.1:8000"
if (!window.__GRANAE_FETCH_PATCHED__) {
  const _fetch = window.fetch.bind(window)
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : (input && input.url) || ""
    if (url.startsWith(API_BASE)) {
      init = { ...init, headers: { ...(init.headers || {}), "X-Usuario": getUsuario() } }
    }
    return _fetch(input, init)
  }
  window.__GRANAE_FETCH_PATCHED__ = true
}

ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>)
