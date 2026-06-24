import { useState, useEffect, useMemo } from "react"
import {
  TabelaLancamentos, BarraRascunho, BarraAcoesLote, MenuContexto,
  useSelecao, CATS_NOME, fmt
} from "../components/TabelaLancamentos"
import MapaMental from "../components/MapaMental"

const API = "http://127.0.0.1:8000"

export default function Lancamentos({ filtroInicial = null, rascunhoApi, onDepurar }) {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mesSel, setMesSel] = useState("")
  const [catSel, setCatSel] = useState("")
  const [tipoSel, setTipoSel] = useState("")
  const [viagemSel, setViagemSel] = useState("")
  const [busca, setBusca] = useState("")
  const [grupoSel, setGrupoSel] = useState("")  // "despesas" — grupo derivado vindo do Dashboard
  const [ctxMenu, setCtxMenu] = useState(null)  // { x, y, filtro }
  const selecao = useSelecao()

  useEffect(() => { carregar() }, [rascunhoApi?.versaoDados])

  // Aplica filtro vindo da navegação (cards do Dashboard).
  useEffect(() => {
    if (!filtroInicial) return
    setMesSel(filtroInicial.mes || "")
    setCatSel(filtroInicial.categoria || "")
    setTipoSel(filtroInicial.tipo || "")
    setViagemSel(filtroInicial.viagem || "")
    setGrupoSel(filtroInicial.grupo || "")
    setBusca("")
  }, [filtroInicial?._ts])

  async function carregar() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/lancamentos`)
      const data = await res.json()
      setTodos(data)
      if (data.length > 0 && !filtroInicial) {
        const meses = [...new Set(data.map(l => l.mes))].sort(sortMes)
        setMesSel(prev => prev || meses[0] || "")
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

  const meses = useMemo(() => [...new Set(todos.map(l => l.mes))].sort(sortMes), [todos])

  const filtrados = useMemo(() => {
    return todos.filter(l => {
      if (mesSel && l.mes !== mesSel) return false
      if (catSel && l.categoria !== catSel) return false
      if (tipoSel && l.tipo !== tipoSel) return false
      if (viagemSel && l.viagem !== viagemSel) return false
      // Grupo "despesas": demais grupos, EXCETO Salário (SA), Investimento (I) e
      // Fatura (F). Sem filtro de sinal — estornos (positivos) da mesma categoria
      // aparecem e se subtraem das compras.
      if (grupoSel === "despesas" && ["SA", "I", "F"].includes(l.categoria)) return false
      if (busca) {
        const q = busca.toLowerCase()
        if (!l.descricao?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [todos, mesSel, catSel, tipoSel, viagemSel, grupoSel, busca])

  const { totalReceita, totalDespesas, totalInvestimentos } = useMemo(() => {
    let receita = 0, despesas = 0, investimentos = 0
    filtrados.forEach(l => {
      const c = l.categoria, v = l.valor || 0
      if (c === 'SA') receita += v               // Receita = soma do grupo Salário
      else if (c === 'I') investimentos += v      // Investimento: categoria à parte
      else if (c === 'F') return                  // Fatura: dupla contagem, fora
      else despesas += v                          // Demais grupos; estornos somam/subtraem
    })
    return {
      totalReceita: receita,
      totalDespesas: Math.abs(despesas),
      totalInvestimentos: Math.abs(investimentos),
    }
  }, [filtrados])

  const categoriasDisponiveis = useMemo(() =>
    [...new Set(todos.map(l => l.categoria).filter(Boolean))].sort(), [todos])
  const viagensDisponiveis = useMemo(() =>
    [...new Set(todos.map(l => l.viagem).filter(Boolean))].sort(), [todos])

  // Clique-direito numa linha → menu "Depurar" (abre pop-up do grupo mês+categoria)
  function onContextMenuLinha(e, l) {
    e.preventDefault()
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      filtro: {
        mes: l.mes,
        categoria: l.categoria || undefined,
        titulo: `${CATS_NOME[l.categoria] || l.categoria || "Sem categoria"} · ${l.mes}`
      }
    })
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>Carregando...</div>
  )

  if (!todos.length) return (
    <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
      <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>Sem lançamentos</p>
      <p style={{ fontSize: 13 }}>Vá para Upload e envie seus extratos.</p>
    </div>
  )

  const selectStyle = {
    padding: "6px 10px", fontSize: 12, cursor: "pointer",
    background: "var(--surface)", border: "1px solid var(--border-mid)",
    borderRadius: "var(--radius-md)", color: "var(--text)", outline: "none"
  }

  const saldo = totalReceita - totalDespesas

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* BARRA DE RASCUNHO */}
      {rascunhoApi && <BarraRascunho rascunhoApi={rascunhoApi} labelSalvar="Salvar na base" />}

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 4 }}>Filtros</span>

        <select value={mesSel} onChange={e => setMesSel(e.target.value)} style={selectStyle}>
          <option value="">Todos os meses</option>
          {meses.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select value={catSel} onChange={e => setCatSel(e.target.value)} style={selectStyle}>
          <option value="">Todas as categorias</option>
          {categoriasDisponiveis.map(c => <option key={c} value={c}>{CATS_NOME[c] || c}</option>)}
        </select>

        <select value={tipoSel} onChange={e => setTipoSel(e.target.value)} style={selectStyle}>
          <option value="">Débito e crédito</option>
          <option value="Débito">Débito</option>
          <option value="Crédito">Crédito</option>
        </select>

        {viagensDisponiveis.length > 0 && (
          <select value={viagemSel} onChange={e => setViagemSel(e.target.value)} style={selectStyle}>
            <option value="">Todas as viagens</option>
            {viagensDisponiveis.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}

        <input type="text" placeholder="Buscar descrição..." value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ ...selectStyle, minWidth: 180, flex: 1, cursor: "text" }} />

        {grupoSel === "despesas" && (
          <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "rgba(226,75,74,0.12)", color: "var(--danger)", border: "1px solid rgba(226,75,74,0.3)", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            Só despesas
            <button onClick={() => setGrupoSel("")} title="Remover filtro de despesas"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 0, fontSize: 12, lineHeight: 1 }}>✕</button>
          </span>
        )}

        {(mesSel || catSel || tipoSel || viagemSel || grupoSel || busca) && (
          <button onClick={() => { setMesSel(""); setCatSel(""); setTipoSel(""); setViagemSel(""); setGrupoSel(""); setBusca("") }}
            style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", background: "none", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-md)", color: "var(--text-muted)" }}>
            Limpar
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
          {filtrados.length} lançamento{filtrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* RESUMO */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {[
          ["Receitas", totalReceita, "var(--primary)"],
          ["Despesas", totalDespesas, "var(--danger)"],
          ["Investimentos", totalInvestimentos, "var(--gold)"],
          ["Saldo", Math.abs(saldo), saldo >= 0 ? "var(--primary)" : "var(--danger)"],
        ].map(([label, val, cor]) => (
          <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
            <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: cor }}>
              {label === "Saldo" && saldo < 0 ? "− " : ""}{fmt(val)}
            </p>
          </div>
        ))}
      </div>

      {/* MAPA MENTAL DO PERFIL (regras automáticas, editáveis) */}
      <MapaMental />

      {/* AÇÕES EM MASSA (cabeçalho da tabela: muda categoria / exclui os selecionados) */}
      {rascunhoApi && <BarraAcoesLote lancamentos={filtrados} rascunhoApi={rascunhoApi} selecao={selecao} viagensDisponiveis={viagensDisponiveis} />}

      {/* TABELA (editor compartilhado, alterações vão para o rascunho) */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        {rascunhoApi ? (
          <TabelaLancamentos
            lancamentos={filtrados}
            rascunho={rascunhoApi.rascunho}
            onEdit={rascunhoApi.editarRascunho}
            onToggleExcluir={rascunhoApi.toggleExcluir}
            viagensDisponiveis={viagensDisponiveis}
            onContextMenuLinha={onContextMenuLinha}
            selecao={selecao}
            mostrarTotal={true}
            onRenomearBase={rascunhoApi.renomearBase}
          />
        ) : (
          <p style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>—</p>
        )}
      </div>

      {ctxMenu && (
        <MenuContexto
          x={ctxMenu.x} y={ctxMenu.y}
          onDepurar={() => { onDepurar?.(ctxMenu.filtro); setCtxMenu(null) }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}
