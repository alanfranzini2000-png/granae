// Usuário/base ativa no frontend (sem login: simples seletor).
//
// Fonte da verdade = window.__GRANAE_USER__ (global estável: sobrevive ao HMR
// e NÃO depende de localStorage funcionar — importante no Simple Browser do
// VSCode, onde storage/prompt podem estar bloqueados). localStorage é só um
// espelho "best effort" para lembrar a base entre sessões.

const CHAVE = "usuario"
export const USUARIO_PADRAO = "principal"

function ler() {
  if (typeof window === "undefined") return USUARIO_PADRAO
  if (!window.__GRANAE_USER__) {
    let v = USUARIO_PADRAO
    try { v = localStorage.getItem(CHAVE) || USUARIO_PADRAO } catch {}
    window.__GRANAE_USER__ = v
  }
  return window.__GRANAE_USER__
}

export function getUsuario() {
  return ler()
}

export function setUsuario(u) {
  const v = u || USUARIO_PADRAO
  if (typeof window !== "undefined") window.__GRANAE_USER__ = v
  try { localStorage.setItem(CHAVE, v) } catch {}
  return v
}

// Acrescenta ?usuario= a uma URL (para EventSource / <a href>).
export function comUsuario(url) {
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}usuario=${encodeURIComponent(getUsuario())}`
}
