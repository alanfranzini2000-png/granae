import { useState, useEffect } from "react"
import { CATS_NOME, CATS_COR } from "./TabelaLancamentos"

const API = "http://127.0.0.1:8000"

// Mapa mental do perfil: mostra, por categoria, os padrões do sistema (só leitura)
// e as regras do próprio usuário (editáveis). As regras do usuário são consultadas
// no momento do upload e têm prioridade sobre os padrões.
export default function MapaMental() {
  const [aberto, setAberto] = useState(false)
  const [cats, setCats] = useState([])
  const [novo, setNovo] = useState({})   // { [cat]: textoInput }
  const [busy, setBusy] = useState(false)

  async function carregar() {
    try {
      const r = await fetch(`${API}/mapa`)
      const d = await r.json()
      setCats(d.categorias || [])
    } catch (e) { console.error(e) }
  }
  useEffect(() => { if (aberto && cats.length === 0) carregar() }, [aberto])

  async function adicionar(cat) {
    const palavra = (novo[cat] || "").trim()
    if (!palavra) return
    setBusy(true)
    try {
      await fetch(`${API}/regras`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palavra_chave: palavra, categoria: cat })
      })
      setNovo(n => ({ ...n, [cat]: "" }))
      await carregar()
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }
  async function remover(palavra) {
    setBusy(true)
    try {
      await fetch(`${API}/regras/${encodeURIComponent(palavra)}`, { method: "DELETE" })
      await carregar()
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  const totalUser = cats.reduce((s, c) => s + c.usuario.length, 0)

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
      <button onClick={() => setAberto(a => !a)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", color: "var(--text)" }}>
        <span style={{ fontSize: 14 }}>🧠</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Mapa mental do perfil</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          — o que é catalogado automaticamente{aberto ? ` (${totalUser} regra${totalUser !== 1 ? "s" : ""} sua${totalUser !== 1 ? "s" : ""})` : ""}
        </span>
        <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>{aberto ? "▲" : "▼"}</span>
      </button>

      {aberto && (
        <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
          {cats.map(c => {
            const cor = CATS_COR[c.cat] || "#888"
            return (
              <div key={c.cat} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--surface2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{CATS_NOME[c.cat] || c.cat}</span>
                </div>

                {/* Minhas regras (editáveis) */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                  {c.usuario.map(p => (
                    <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 6px", borderRadius: 20, background: cor + "22", color: cor, border: `1px solid ${cor}55` }}>
                      {p}
                      <button onClick={() => remover(p)} disabled={busy} title="Remover regra"
                        style={{ background: "none", border: "none", cursor: "pointer", color: cor, padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                  {c.usuario.length === 0 && <span style={{ fontSize: 10, color: "var(--text-faint)" }}>nenhuma regra sua ainda</span>}
                </div>

                {/* Adicionar */}
                <div style={{ display: "flex", gap: 4 }}>
                  <input value={novo[c.cat] || ""} onChange={e => setNovo(n => ({ ...n, [c.cat]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") adicionar(c.cat) }}
                    placeholder="+ palavra-chave"
                    style={{ fontSize: 11, padding: "4px 6px", flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--border-mid)", borderRadius: 6, color: "var(--text)", outline: "none" }} />
                  <button onClick={() => adicionar(c.cat)} disabled={busy || !(novo[c.cat] || "").trim()}
                    style={{ fontSize: 11, padding: "4px 9px", cursor: "pointer", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 6 }}>+</button>
                </div>

                {/* Padrões do sistema (só leitura) */}
                {c.padroes.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer" }}>padrões do sistema ({c.padroes.length})</summary>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {c.padroes.map(p => (
                        <span key={p} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 20, background: "var(--surface)", color: "var(--text-faint)", border: "1px solid var(--border-mid)" }}>{p}</span>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
