import { useState, useEffect, useMemo } from "react"

const API = "http://127.0.0.1:8000"

const CATS_NOME = {
  SA:"Salário", I:"Investimento", CA:"Casa", S:"Saúde", E:"Estudo",
  A:"Assinatura", T:"Transporte", M:"Mercado", C:"Comida",
  B:"Bens", R:"Roupa", L:"Lazer", O:"Outros", F:"Fatura"
}

const CATS_COR = {
  CA:"#EF9F27", S:"#D4537E", L:"#1D9E75", C:"#9B59B6", T:"#7F77DD",
  E:"#5DCAA5", M:"#378ADD", B:"#888780", R:"#E24B4A", A:"#F0997B",
  O:"#5A8A78", SA:"#27AE60", I:"#EF9F27", F:"#888780"
}

const TODAS_CATS = Object.keys(CATS_NOME)

function fmt(v) {
  return `R$ ${Math.abs(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export default function Lancamentos() {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mesSel, setMesSel] = useState("")
  const [catSel, setCatSel] = useState("")
  const [tipoSel, setTipoSel] = useState("")
  const [busca, setBusca] = useState("")

  // edição inline de categoria
  const [editandoId, setEditandoId] = useState(null)
  const [editCat, setEditCat] = useState("")
  const [salvando, setSalvando] = useState(false)

  // exclusão com confirmação
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/lancamentos`)
      const data = await res.json()
      setTodos(data)
      if (data.length > 0) {
        const meses = [...new Set(data.map(l => l.mes))].sort(sortMes)
        setMesSel(meses[0] || "")
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  function sortMes(a, b) {
    const [ma, aa] = a.split("/").map(Number)
    const [mb, ab] = b.split("/").map(Number)
    return aa !== ab ? ab - aa : mb - ma
  }

  function abrirEdicao(l) {
    setEditandoId(l.id)
    setEditCat(l.categoria || "")
    setConfirmandoId(null)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditCat("")
  }

  async function salvarCategoria(id) {
    setSalvando(true)
    try {
      await fetch(`${API}/lancamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria: editCat || null })
      })
      setTodos(prev => prev.map(l => l.id === id ? { ...l, categoria: editCat || null } : l))
      setEditandoId(null)
    } catch (e) {
      console.error(e)
    }
    setSalvando(false)
  }

  async function excluir(id) {
    setExcluindo(true)
    try {
      await fetch(`${API}/lancamentos/${id}`, { method: "DELETE" })
      setTodos(prev => prev.filter(l => l.id !== id))
      setConfirmandoId(null)
    } catch (e) {
      console.error(e)
    }
    setExcluindo(false)
  }

  const meses = useMemo(() => {
    return [...new Set(todos.map(l => l.mes))].sort(sortMes)
  }, [todos])

  const filtrados = useMemo(() => {
    return todos.filter(l => {
      if (mesSel && l.mes !== mesSel) return false
      if (catSel && l.categoria !== catSel) return false
      if (tipoSel && l.tipo !== tipoSel) return false
      if (busca) {
        const q = busca.toLowerCase()
        if (!l.descricao?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [todos, mesSel, catSel, tipoSel, busca])

  const { totalReceita, totalDespesas } = useMemo(() => {
    let totalReceita = 0, totalDespesas = 0
    filtrados.forEach(l => {
      if (l.valor > 0) totalReceita += l.valor
      else totalDespesas += Math.abs(l.valor)
    })
    return { totalReceita, totalDespesas }
  }, [filtrados])

  const categoriasDisponiveis = useMemo(() => {
    return [...new Set(todos.map(l => l.categoria).filter(Boolean))].sort()
  }, [todos])

  if (loading) return (
    <div style={{ textAlign:"center", padding:"4rem", color:"var(--text-muted)" }}>
      Carregando...
    </div>
  )

  if (!todos.length) return (
    <div style={{ textAlign:"center", padding:"4rem", color:"var(--text-muted)" }}>
      <p style={{ fontSize:16, fontWeight:500, color:"var(--text)", marginBottom:8 }}>Sem lançamentos</p>
      <p style={{ fontSize:13 }}>Vá para Upload e envie seus extratos.</p>
    </div>
  )

  const selectStyle = {
    padding:"6px 10px", fontSize:12, cursor:"pointer",
    background:"var(--surface)", border:"1px solid var(--border-mid)",
    borderRadius:"var(--radius-md)", color:"var(--text)",
    outline:"none"
  }

  const saldo = totalReceita - totalDespesas

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>

      {/* FILTROS */}
      <div style={{
        display:"flex", gap:8, flexWrap:"wrap", alignItems:"center",
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--radius-md)", padding:"10px 14px"
      }}>
        <span style={{ fontSize:11, fontWeight:500, color:"var(--text-muted)",
          textTransform:"uppercase", letterSpacing:"0.05em", marginRight:4 }}>
          Filtros
        </span>

        <select value={mesSel} onChange={e => setMesSel(e.target.value)} style={selectStyle}>
          <option value="">Todos os meses</option>
          {meses.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select value={catSel} onChange={e => setCatSel(e.target.value)} style={selectStyle}>
          <option value="">Todas as categorias</option>
          {categoriasDisponiveis.map(c => (
            <option key={c} value={c}>{CATS_NOME[c] || c}</option>
          ))}
        </select>

        <select value={tipoSel} onChange={e => setTipoSel(e.target.value)} style={selectStyle}>
          <option value="">Débito e crédito</option>
          <option value="Débito">Débito</option>
          <option value="Crédito">Crédito</option>
        </select>

        <input
          type="text"
          placeholder="Buscar descrição..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...selectStyle, minWidth:180, flex:1, cursor:"text" }}
        />

        {(mesSel || catSel || tipoSel || busca) && (
          <button
            onClick={() => { setMesSel(""); setCatSel(""); setTipoSel(""); setBusca("") }}
            style={{
              padding:"6px 10px", fontSize:11, cursor:"pointer",
              background:"none", border:"1px solid var(--border-mid)",
              borderRadius:"var(--radius-md)", color:"var(--text-muted)"
            }}>
            Limpar
          </button>
        )}

        <span style={{ marginLeft:"auto", fontSize:11, color:"var(--text-muted)" }}>
          {filtrados.length} lançamento{filtrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* RESUMO */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
        {[
          ["Receitas", totalReceita, "var(--primary)"],
          ["Despesas", totalDespesas, "var(--danger)"],
          ["Saldo", Math.abs(saldo), saldo >= 0 ? "var(--primary)" : "var(--danger)"],
        ].map(([label, val, cor]) => (
          <div key={label} style={{
            background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--radius-md)", padding:"12px 14px"
          }}>
            <p style={{ fontSize:10, color:"var(--text-muted)", textTransform:"uppercase",
              letterSpacing:"0.05em", fontWeight:500, marginBottom:4 }}>
              {label}
            </p>
            <p style={{ fontSize:18, fontWeight:600, color: cor }}>
              {label === "Saldo" && saldo < 0 ? "− " : ""}{fmt(val)}
            </p>
          </div>
        ))}
      </div>

      {/* TABELA */}
      <div style={{
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--radius-md)", overflow:"hidden"
      }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Data","Descrição","Categoria","Tipo","Valor","Fonte","Viagem",""].map((col, i) => (
                  <th key={i} style={{
                    padding:"8px 12px", textAlign: col === "Valor" ? "right" : "left",
                    fontSize:10, fontWeight:500, color:"var(--text-muted)",
                    textTransform:"uppercase", letterSpacing:"0.05em",
                    whiteSpace:"nowrap"
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{
                    textAlign:"center", padding:"2rem",
                    color:"var(--text-muted)", fontSize:13
                  }}>
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtrados.map((l, i) => {
                  const isReceita = l.valor > 0
                  const cor = CATS_COR[l.categoria] || "#888"
                  const editando = editandoId === l.id
                  const confirmando = confirmandoId === l.id

                  return (
                    <tr key={l.id} style={{
                      borderBottom:"1px solid var(--border)",
                      background: editando || confirmando
                        ? "var(--surface2)"
                        : i % 2 === 0 ? "transparent" : "var(--surface2)",
                    }}>

                      {/* DATA */}
                      <td style={{ padding:"8px 12px", color:"var(--text-muted)", whiteSpace:"nowrap" }}>
                        {l.data}
                      </td>

                      {/* DESCRIÇÃO */}
                      <td style={{
                        padding:"8px 12px", color:"var(--text)",
                        maxWidth:260, overflow:"hidden",
                        textOverflow:"ellipsis", whiteSpace:"nowrap"
                      }} title={l.descricao}>
                        {l.descricao}
                      </td>

                      {/* CATEGORIA — inline edit */}
                      <td style={{ padding:"6px 12px", minWidth:140 }}>
                        {editando ? (
                          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                            <select
                              autoFocus
                              value={editCat}
                              onChange={e => setEditCat(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") salvarCategoria(l.id)
                                if (e.key === "Escape") cancelarEdicao()
                              }}
                              style={{
                                fontSize:11, padding:"3px 6px",
                                background:"var(--surface)", border:"1px solid var(--primary)",
                                borderRadius:"var(--radius-sm)", color:"var(--text)",
                                outline:"none", cursor:"pointer"
                              }}>
                              <option value="">— sem categoria</option>
                              {TODAS_CATS.map(c => (
                                <option key={c} value={c}>{CATS_NOME[c]}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => salvarCategoria(l.id)}
                              disabled={salvando}
                              style={{
                                fontSize:11, padding:"3px 8px", cursor:"pointer",
                                background:"var(--primary)", color:"#fff",
                                border:"none", borderRadius:"var(--radius-sm)"
                              }}>
                              {salvando ? "…" : "OK"}
                            </button>
                            <button
                              onClick={cancelarEdicao}
                              style={{
                                fontSize:11, padding:"3px 6px", cursor:"pointer",
                                background:"none", color:"var(--text-muted)",
                                border:"1px solid var(--border-mid)", borderRadius:"var(--radius-sm)"
                              }}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => abrirEdicao(l)}
                            title="Clique para editar"
                            style={{
                              background:"none", border:"none", cursor:"pointer",
                              padding:0, display:"inline-flex", alignItems:"center", gap:4
                            }}>
                            {l.categoria ? (
                              <span style={{
                                display:"inline-block",
                                background: cor + "22",
                                color: cor,
                                border:`1px solid ${cor}44`,
                                borderRadius:20, padding:"2px 8px",
                                fontSize:10, fontWeight:500, whiteSpace:"nowrap"
                              }}>
                                {CATS_NOME[l.categoria] || l.categoria}
                              </span>
                            ) : (
                              <span style={{
                                color:"var(--text-faint)", fontSize:11,
                                border:"1px dashed var(--border-mid)",
                                borderRadius:20, padding:"2px 8px"
                              }}>—</span>
                            )}
                            <span style={{ fontSize:9, color:"var(--text-faint)", opacity:0.6 }}>✎</span>
                          </button>
                        )}
                      </td>

                      {/* TIPO */}
                      <td style={{ padding:"8px 12px", color:"var(--text-muted)", whiteSpace:"nowrap" }}>
                        {l.tipo}
                      </td>

                      {/* VALOR */}
                      <td style={{
                        padding:"8px 12px", textAlign:"right", fontWeight:500,
                        color: isReceita ? "var(--primary)" : "var(--text)",
                        whiteSpace:"nowrap"
                      }}>
                        {isReceita ? "+" : "−"}&nbsp;{fmt(l.valor)}
                      </td>

                      {/* FONTE */}
                      <td style={{ padding:"8px 12px", whiteSpace:"nowrap" }}>
                        {l.fonte === "ia" ? (
                          <span style={{
                            display:"inline-block",
                            background:"rgba(55,138,221,0.12)",
                            color:"#378ADD",
                            border:"1px solid rgba(55,138,221,0.3)",
                            borderRadius:20, padding:"2px 8px",
                            fontSize:10, fontWeight:500
                          }}>IA</span>
                        ) : l.fonte === "regra" ? (
                          <span style={{ color:"var(--text-muted)", fontSize:11 }}>regra</span>
                        ) : (
                          <span style={{ color:"var(--text-faint)", fontSize:11 }}>—</span>
                        )}
                      </td>

                      {/* VIAGEM */}
                      <td style={{ padding:"8px 12px", color:"var(--text-muted)", whiteSpace:"nowrap" }}>
                        {l.viagem || <span style={{ color:"var(--text-faint)", fontSize:11 }}>—</span>}
                      </td>

                      {/* AÇÕES */}
                      <td style={{ padding:"8px 12px", whiteSpace:"nowrap" }}>
                        {confirmando ? (
                          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                            <span style={{ fontSize:11, color:"var(--danger)", marginRight:2 }}>Excluir?</span>
                            <button
                              onClick={() => excluir(l.id)}
                              disabled={excluindo}
                              style={{
                                fontSize:11, padding:"3px 8px", cursor:"pointer",
                                background:"var(--danger)", color:"#fff",
                                border:"none", borderRadius:"var(--radius-sm)"
                              }}>
                              {excluindo ? "…" : "Sim"}
                            </button>
                            <button
                              onClick={() => setConfirmandoId(null)}
                              style={{
                                fontSize:11, padding:"3px 6px", cursor:"pointer",
                                background:"none", color:"var(--text-muted)",
                                border:"1px solid var(--border-mid)", borderRadius:"var(--radius-sm)"
                              }}>
                              Não
                            </button>
                          </div>
                        ) : (
                          !editando && (
                            <button
                              onClick={() => { setConfirmandoId(l.id); cancelarEdicao() }}
                              title="Excluir lançamento"
                              style={{
                                background:"none", border:"none", cursor:"pointer",
                                color:"var(--text-faint)", fontSize:13, padding:"2px 6px",
                                borderRadius:"var(--radius-sm)", lineHeight:1
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = "var(--danger)"}
                              onMouseLeave={e => e.currentTarget.style.color = "var(--text-faint)"}
                            >
                              ✕
                            </button>
                          )
                        )}
                      </td>

                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
