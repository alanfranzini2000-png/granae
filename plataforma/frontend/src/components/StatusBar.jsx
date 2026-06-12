import { useState } from "react"

const API = "http://127.0.0.1:8000"

export default function StatusBar({ statusUploads }) {
  const [verificando, setVerificando] = useState(false)
  const [resultado,   setResultado]   = useState(null)

  const debito  = statusUploads?.ultimo_dado_debito  || null
  const credito = statusUploads?.ultimo_dado_credito || null
  // Alerta só quando um dos dois NUNCA teve dado
  const temAlerta = !debito || !credito

  function fmtData(d) {
    if (!d) return null
    if (d.includes('/')) return d
    try {
      const [a,m,dia] = d.split('-')
      return `${dia}/${m}/${a}`
    } catch { return d }
  }

  async function verificarBase() {
    setVerificando(true); setResultado(null)
    try {
      const res  = await fetch(`${API}/verificar`)
      const data = await res.json()
      setResultado(data)
    } catch(e) {
      setResultado({ ok:false, total_problemas:1, problemas:[{ descricao:"Erro ao conectar com o backend" }] })
    } finally {
      setVerificando(false)
    }
  }

  const dDeb = fmtData(debito)
  const dCred = fmtData(credito)

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"1rem", fontSize:12 }}>

      {/* Resultado da verificação */}
      {resultado && (
        <div style={{
          position:"fixed", top:52, right:16, zIndex:500,
          background:"#ffffff",
          border:"1px solid #e0e0e0",
          borderRadius:"var(--border-radius-lg)", padding:"1rem 1.25rem",
          minWidth:300, boxShadow:"0 4px 20px rgba(0,0,0,0.15)"
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <p style={{ fontSize:13, fontWeight:600, color:"#1a1a1a" }}>
              {resultado.ok ? "✅ Base limpa" : `⚠ ${resultado.total_problemas} problema(s)`}
            </p>
            <button onClick={() => setResultado(null)}
              style={{ fontSize:16, background:"none", border:"none", cursor:"pointer", color:"#666" }}>✕</button>
          </div>
          {resultado.problemas?.map((p,i) => (
            <div key={i} style={{ fontSize:12, color:"#555",
              padding:"6px 0", borderTop:"1px solid #f0f0f0" }}>
              {p.descricao}
            </div>
          ))}
        </div>
      )}

      {/* Alerta dados incompletos — só se nunca houve dado */}
      {temAlerta && (
        <span style={{ background:"#FFF8E5", color:"#B7791F",
          padding:"3px 10px", borderRadius:"var(--border-radius-md)", fontWeight:500 }}>
          ⚠ Dados incompletos
        </span>
      )}

      {/* Status débito/crédito */}
      <div style={{ display:"flex", gap:"0.75rem" }}>
        <span style={{ color: dDeb ? "#1D9E75" : "#999" }}>
          {dDeb ? "✓" : "○"} Débito: {dDeb || "sem dados ainda"}
        </span>
        <span style={{ color: dCred ? "#1D9E75" : "#999" }}>
          {dCred ? "✓" : "○"} Crédito: {dCred || "sem dados ainda"}
        </span>
      </div>

      {/* Botão verificar base */}
      <button onClick={verificarBase} disabled={verificando}
        style={{ fontSize:11, padding:"3px 10px",
          background:"var(--color-background-secondary)",
          border:"0.5px solid var(--color-border-tertiary)",
          borderRadius:"var(--border-radius-md)", cursor:"pointer",
          color:"var(--color-text-secondary)" }}>
        {verificando ? "Verificando..." : "🔍 Verificar base"}
      </button>

      {/* Link exportar */}
      <a href={`${API}/exportar`} style={{ fontSize:11, color:"var(--color-text-secondary)", textDecoration:"none" }}>
        ↓ Exportar XLS
      </a>
    </div>
  )
}
