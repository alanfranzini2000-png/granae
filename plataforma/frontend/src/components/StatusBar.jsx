import { comUsuario } from "../usuario"

const API = "http://127.0.0.1:8000"

export default function StatusBar({ statusUploads, onVerificar }) {
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

  const dDeb = fmtData(debito)
  const dCred = fmtData(credito)

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"1rem", fontSize:12 }}>

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

      {/* Botão verificar base — abre o pop-up de correção */}
      <button onClick={onVerificar}
        style={{ fontSize:11, padding:"3px 10px",
          background:"var(--color-background-secondary)",
          border:"0.5px solid var(--color-border-tertiary)",
          borderRadius:"var(--border-radius-md)", cursor:"pointer",
          color:"var(--color-text-secondary)" }}>
        🔍 Verificar base
      </button>

      {/* Link exportar */}
      <a href={comUsuario(`${API}/exportar`)} style={{ fontSize:11, color:"var(--color-text-secondary)", textDecoration:"none" }}>
        ↓ Exportar XLS
      </a>
    </div>
  )
}
