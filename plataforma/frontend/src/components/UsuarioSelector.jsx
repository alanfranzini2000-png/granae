import { useState, useEffect, useRef } from "react"
import { USUARIO_PADRAO } from "../usuario"

const API = "http://127.0.0.1:8000"

export default function UsuarioSelector({ base, onTrocar, onRecarregar }) {
  const [aberto, setAberto] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [padrao, setPadrao] = useState(USUARIO_PADRAO)
  const [busy, setBusy] = useState(false)
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState("")
  const [origem, setOrigem] = useState("")   // "" = vazia; senão clona dessa base
  const [confirma, setConfirma] = useState(null)  // null | "zerar" | "apagar"
  const [erro, setErro] = useState(null)
  const ref = useRef(null)
  const atual = base

  async function carregar() {
    try {
      const r = await fetch(`${API}/usuarios`)
      const d = await r.json()
      setUsuarios(d.usuarios || [])
      setPadrao(d.padrao || USUARIO_PADRAO)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { carregar() }, [])
  // Fecha ao clicar fora / Esc — registrado SÓ enquanto o menu está aberto.
  // Se ficasse sempre ativo, o mesmo clique que abre o menu podia ser capturado
  // aqui e fechá-lo no mesmo instante (o botão "não fazia efeito").
  useEffect(() => {
    if (!aberto) return
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) fechar() }
    const esc = e => { if (e.key === "Escape") fechar() }
    document.addEventListener("mousedown", fora)
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc) }
  }, [aberto])

  function fechar() {
    setAberto(false); setCriando(false); setConfirma(null); setNome(""); setOrigem(""); setErro(null)
  }

  function trocar(u) {
    if (u === atual) { fechar(); return }
    fechar()
    onTrocar(u)
  }

  async function criar() {
    const n = nome.trim()
    if (!n) return
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`${API}/usuarios`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: n, origem: origem || null })
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(d.detail || `Erro ${r.status}`); return }
      if (d.usuario) { await carregar(); fechar(); onTrocar(d.usuario) }
      else setErro("Falha ao criar")
    } catch (e) { console.error(e); setErro("Erro ao criar base") }
    finally { setBusy(false) }
  }

  async function zerar() {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`${API}/usuarios/${encodeURIComponent(atual)}/zerar`, { method: "POST" })
      if (!r.ok) throw new Error()
      fechar()
      onRecarregar()
    } catch (e) { console.error(e); setErro("Erro ao zerar") }
    finally { setBusy(false) }
  }

  async function apagar() {
    if (atual === padrao) return
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`${API}/usuarios/${encodeURIComponent(atual)}`, { method: "DELETE" })
      if (!r.ok) throw new Error()
      await carregar()
      fechar()
      onTrocar(padrao)
    } catch (e) { console.error(e); setErro("Erro ao apagar") }
    finally { setBusy(false) }
  }

  const itemMenu = {
    display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
    fontSize: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text)"
  }
  const hover = {
    onMouseEnter: e => e.currentTarget.style.background = "var(--surface2)",
    onMouseLeave: e => e.currentTarget.style.background = "none",
  }
  const inputStyle = {
    fontSize: 12, padding: "5px 8px", flex: 1, minWidth: 0, background: "var(--surface)",
    border: "1px solid var(--primary)", borderRadius: "var(--radius-sm)", color: "var(--text)", outline: "none"
  }
  const btnSm = {
    fontSize: 11, padding: "5px 10px", cursor: "pointer", border: "none",
    borderRadius: "var(--radius-sm)", background: "var(--primary)", color: "#fff", whiteSpace: "nowrap"
  }
  const btnSmGhost = { ...btnSm, background: "none", color: "var(--text-muted)", border: "1px solid var(--border-mid)" }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={e => { e.stopPropagation(); aberto ? fechar() : setAberto(true) }} disabled={busy}
        title="Trocar / gerenciar base"
        style={{
          fontSize: 11, padding: "3px 10px", display: "flex", alignItems: "center", gap: 6,
          background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-md)", cursor: "pointer", color: "var(--color-text-secondary)"
        }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)" }} />
        Base: <strong style={{ fontWeight: 600 }}>{atual}</strong> ▾
      </button>

      {aberto && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 1000, minWidth: 230,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
          boxShadow: "0 8px 28px rgba(0,0,0,0.22)", overflow: "hidden", padding: "4px 0"
        }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "6px 12px 4px" }}>
            Bases
          </p>
          {usuarios.map(u => (
            <button key={u} onClick={() => trocar(u)} {...hover} style={{
              ...itemMenu, display: "flex", alignItems: "center", gap: 8,
              fontWeight: u === atual ? 600 : 400, color: u === atual ? "var(--primary)" : "var(--text)"
            }}>
              <span style={{ width: 14 }}>{u === atual ? "✓" : ""}</span>
              {u}{u === padrao ? <span style={{ fontSize: 10, color: "var(--text-faint)" }}> (padrão)</span> : null}
            </button>
          ))}

          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />

          {/* Criar nova base — input inline (sem prompt do navegador).
              Escolhe na hora: começar vazia OU clonar de uma base mestre. */}
          {criando ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px" }}>
              <input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="nome do perfil"
                onKeyDown={e => { if (e.key === "Enter") criar(); if (e.key === "Escape") fechar() }}
                disabled={busy} style={inputStyle} />
              <select value={origem} onChange={e => setOrigem(e.target.value)} disabled={busy} style={inputStyle}>
                <option value="">Começar vazia</option>
                {usuarios.map(u => <option key={u} value={u}>Copiar de: {u}</option>)}
              </select>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => { setCriando(false); setNome(""); setOrigem(""); setErro(null) }}
                  disabled={busy} style={btnSmGhost}>Cancelar</button>
                <button onClick={criar} disabled={busy || !nome.trim()} style={btnSm}>Criar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setCriando(true); setConfirma(null) }} {...hover} style={itemMenu}>
              ＋ Novo perfil / base
            </button>
          )}

          {/* Zerar base atual — confirmação inline */}
          {confirma === "zerar" ? (
            <div style={{ display: "flex", gap: 6, padding: "6px 12px", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>Esvaziar “{atual}”?</span>
              <button onClick={zerar} disabled={busy} style={{ ...btnSm, background: "var(--danger)" }}>Sim</button>
              <button onClick={() => setConfirma(null)} disabled={busy} style={btnSmGhost}>Não</button>
            </div>
          ) : (
            <button onClick={() => { setConfirma("zerar"); setCriando(false) }} {...hover} style={itemMenu}>
              ⟳ Zerar base atual
            </button>
          )}

          {/* Apagar base atual — confirmação inline (exceto padrão) */}
          {atual !== padrao && (
            confirma === "apagar" ? (
              <div style={{ display: "flex", gap: 6, padding: "6px 12px", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>Apagar “{atual}”?</span>
                <button onClick={apagar} disabled={busy} style={{ ...btnSm, background: "var(--danger)" }}>Sim</button>
                <button onClick={() => setConfirma(null)} disabled={busy} style={btnSmGhost}>Não</button>
              </div>
            ) : (
              <button onClick={() => { setConfirma("apagar"); setCriando(false) }} {...hover} style={{ ...itemMenu, color: "var(--danger)" }}>
                🗑 Apagar base atual
              </button>
            )
          )}

          {erro && <p style={{ fontSize: 11, color: "var(--danger)", padding: "4px 12px" }}>{erro}</p>}
        </div>
      )}
    </div>
  )
}
