import { useEffect, useState } from "react"

const API = "http://127.0.0.1:8000"

// Botão (ícone de engrenagem) + modal de configuração da chave da Anthropic.
// BYOK: cada pessoa que recebe o app cola a própria chave aqui (ou a chave
// que o distribuidor mandou); fica salva localmente, fora do código-fonte.
export default function Configuracoes() {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button onClick={() => setAberto(true)} title="Configurações"
        style={{ fontSize:14, padding:"4px 8px", background:"none",
          border:"1px solid var(--border-mid)", borderRadius:"var(--radius-md)",
          cursor:"pointer", color:"var(--text-muted)" }}>
        ⚙️
      </button>
      {aberto && <ModalConfiguracoes onClose={() => setAberto(false)} />}
    </>
  )
}

function ModalConfiguracoes({ onClose }) {
  const [status, setStatus] = useState(null)   // {configurada, fonte}
  const [chave, setChave] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  async function carregar() {
    try {
      const r = await fetch(`${API}/config/api-key`)
      setStatus(await r.json())
    } catch { setStatus({ configurada: false, fonte: null }) }
  }
  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!chave.trim()) return
    setSalvando(true); setMsg(null)
    try {
      const r = await fetch(`${API}/config/api-key`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave: chave.trim() })
      })
      if (!r.ok) throw new Error()
      setChave("")
      setMsg({ tipo: "ok", texto: "Chave salva." })
      await carregar()
    } catch { setMsg({ tipo: "erro", texto: "Não foi possível salvar a chave." }) }
    setSalvando(false)
  }

  async function remover() {
    setSalvando(true); setMsg(null)
    try {
      await fetch(`${API}/config/api-key`, { method: "DELETE" })
      setMsg({ tipo: "ok", texto: "Chave removida. A categorização volta a usar só regras fixas." })
      await carregar()
    } catch { setMsg({ tipo: "erro", texto: "Não foi possível remover a chave." }) }
    setSalvando(false)
  }

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"var(--surface)", borderRadius:"var(--radius-md)",
        padding:"1.5rem", width:420, maxWidth:"90vw",
        boxShadow:"0 10px 40px rgba(0,0,0,0.25)"
      }}>
        <h3 style={{ margin:0, marginBottom:12, fontSize:16, color:"var(--text)" }}>Configurações</h3>

        <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:10 }}>
          Chave da Anthropic (categorização por IA). Sem chave configurada, o app
          continua funcionando normalmente — só com categorização por regras fixas,
          sem sugestão automática via IA para lançamentos não reconhecidos.
        </div>

        {status && (
          <div style={{
            fontSize:12, marginBottom:12, padding:"6px 10px", borderRadius:"var(--radius-md)",
            background: status.configurada ? "rgba(29,158,117,0.12)" : "rgba(153,153,153,0.12)",
            color: status.configurada ? "#1D9E75" : "var(--text-muted)"
          }}>
            {status.configurada
              ? `✓ Chave configurada (${status.fonte === "local" ? "definida aqui" : "ambiente/.env"})`
              : "○ Nenhuma chave configurada"}
          </div>
        )}

        <input
          type="password"
          placeholder="sk-ant-..."
          value={chave}
          onChange={e => setChave(e.target.value)}
          style={{
            width:"100%", boxSizing:"border-box", padding:"8px 10px", fontSize:13,
            border:"1px solid var(--border-mid)", borderRadius:"var(--radius-md)",
            marginBottom:10, background:"var(--bg)", color:"var(--text)"
          }}
        />

        {msg && (
          <div style={{ fontSize:12, marginBottom:10, color: msg.tipo === "ok" ? "#1D9E75" : "var(--danger)" }}>
            {msg.texto}
          </div>
        )}

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          {status?.configurada && status.fonte === "local" && (
            <button onClick={remover} disabled={salvando} style={{
              fontSize:12, padding:"6px 12px", cursor:"pointer",
              background:"none", border:"1px solid var(--border-mid)",
              borderRadius:"var(--radius-md)", color:"var(--danger)"
            }}>Remover</button>
          )}
          <button onClick={onClose} style={{
            fontSize:12, padding:"6px 12px", cursor:"pointer",
            background:"none", border:"1px solid var(--border-mid)",
            borderRadius:"var(--radius-md)", color:"var(--text)"
          }}>Fechar</button>
          <button onClick={salvar} disabled={salvando || !chave.trim()} style={{
            fontSize:12, padding:"6px 12px", cursor:"pointer",
            background:"var(--primary)", border:"none",
            borderRadius:"var(--radius-md)", color:"#fff",
            opacity: (!chave.trim() || salvando) ? 0.6 : 1
          }}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  )
}
