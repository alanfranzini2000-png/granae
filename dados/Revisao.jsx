import { useState, useEffect } from "react"

const API = "http://localhost:8000"
const CATS = ["SA","I","CA","S","E","A","T","M","C","B","R","L","O","F"]
const CATS_NOME = {
  SA:"Salário", I:"Investimento", F:"Fatura", CA:"Casa", S:"Saúde",
  E:"Estudo", A:"Assinatura", T:"Transporte", M:"Mercado", C:"Comida",
  B:"Bens", R:"Roupa", L:"Lazer", O:"Outros"
}
const FONTE_CONFIG = {
  regra:    { label: "Regra",   color: "#1D9E75", bg: "#E8F8F2" },
  ia_alta:  { label: "IA ✓",   color: "#378ADD", bg: "#EEF5FF" },
  ia_media: { label: "IA ?",   color: "#E67E22", bg: "#FFF4E5" },
  manual:   { label: "Manual", color: "#888",    bg: "#F5F5F5" },
}

export default function Revisao({ onRevisado }) {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState("pendentes") // pendentes | todos

  useEffect(() => { carregar() }, [filtro])

  async function carregar() {
    setLoading(true)
    const url = filtro === "pendentes"
      ? `${API}/lancamentos?revisado=0`
      : `${API}/lancamentos`
    const res = await fetch(url)
    const data = await res.json()
    setItens(data)
    setLoading(false)
  }

  async function aprovar(id, categoria) {
    await fetch(`${API}/lancamentos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoria, revisado: 1 })
    })
    setItens(it => it.filter(i => i.id !== id))
    onRevisado()
  }

  if (loading) return (
    <p style={{ color: "var(--color-text-secondary)", padding: "2rem" }}>Carregando...</p>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Revisão de lançamentos</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {itens.length} {itens.length === 1 ? "item" : "itens"} {filtro === "pendentes" ? "aguardando revisão" : "no total"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["pendentes","todos"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: "4px 12px", fontSize: 12, cursor: "pointer",
              background: filtro === f ? "var(--color-background-secondary)" : "transparent",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-md)",
              color: "var(--color-text-secondary)"
            }}>{f === "pendentes" ? "Pendentes" : "Todos"}</button>
          ))}
        </div>
      </div>

      {itens.length === 0 && filtro === "pendentes" ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>✓</p>
          <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>Tudo revisado!</p>
          <p style={{ fontSize: 13 }}>Nenhum lançamento aguardando categorização.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {itens.map(item => {
            const fonte = FONTE_CONFIG[item.fonte] || FONTE_CONFIG.manual
            const pendente = item.revisado === 0
            return (
              <div key={item.id} style={{
                background: "var(--color-background-primary)",
                border: `0.5px solid ${pendente ? "#E24B4A44" : "var(--color-border-tertiary)"}`,
                borderRadius: "var(--border-radius-lg)",
                padding: "0.75rem 1.25rem",
                display: "flex", alignItems: "center", gap: "1rem",
                opacity: pendente ? 1 : 0.7
              }}>
                {/* Data */}
                <p style={{ fontSize: 11, color: "var(--color-text-secondary)", minWidth: 70 }}>
                  {item.data}
                </p>

                {/* Fonte */}
                <span style={{
                  fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 500,
                  background: fonte.bg, color: fonte.color, minWidth: 48, textAlign: "center"
                }}>
                  {fonte.label}
                </span>

                {/* Descrição */}
                <p style={{
                  flex: 1, fontSize: 13, fontWeight: 500,
                  color: "var(--color-text-primary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                  {item.descricao}
                </p>

                {/* Valor */}
                <p style={{
                  fontSize: 13, fontWeight: 500, minWidth: 90, textAlign: "right",
                  color: item.valor > 0 ? "var(--color-text-success)" : "var(--color-text-primary)"
                }}>
                  {item.valor > 0 ? "+" : ""}R$ {Math.abs(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>

                {/* Categoria atual */}
                {item.categoria && !pendente && (
                  <span style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 4,
                    background: "var(--color-background-secondary)",
                    color: "var(--color-text-secondary)", fontWeight: 500
                  }}>
                    {item.categoria}
                  </span>
                )}

                {/* Seletor — só para pendentes */}
                {pendente && (
                  <select
                    defaultValue={item.categoria || ""}
                    onChange={e => { if (e.target.value) aprovar(item.id, e.target.value) }}
                    style={{
                      padding: "0.4rem 0.6rem", fontSize: 12,
                      borderRadius: "var(--border-radius-md)",
                      border: "0.5px solid var(--color-border-secondary)",
                      background: "var(--color-background-secondary)",
                      cursor: "pointer", minWidth: 140
                    }}>
                    <option value="" disabled>
                      {item.categoria ? `${item.categoria} — confirmar?` : "Selecionar categoria"}
                    </option>
                    {CATS.map(c => (
                      <option key={c} value={c}>{c} — {CATS_NOME[c]}</option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
