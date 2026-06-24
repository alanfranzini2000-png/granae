import { useState, useEffect, useId, useMemo } from "react"

const API = "http://127.0.0.1:8000"

export const CATS_NOME = {
  SA:"Salário", I:"Investimento", CA:"Casa", S:"Saúde", E:"Estudo",
  A:"Assinatura", T:"Transporte", M:"Mercado", C:"Comida",
  B:"Bens", R:"Roupa", L:"Lazer", O:"Outros", F:"Fatura"
}

export const CATS_COR = {
  CA:"#EF9F27", S:"#D4537E", L:"#1D9E75", C:"#9B59B6", T:"#7F77DD",
  E:"#5DCAA5", M:"#378ADD", B:"#888780", R:"#E24B4A", A:"#F0997B",
  O:"#5A8A78", SA:"#27AE60", I:"#EF9F27", F:"#888780"
}

const TODAS_CATS = Object.keys(CATS_NOME)

export function fmt(v) {
  return `R$ ${Math.abs(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })}`
}

// Converte texto digitado em número. Aceita "1.234,56", "1234,56" ou "1234.56".
export function parseValorBR(s) {
  if (typeof s === "number") return s
  const t = String(s ?? "").trim()
  if (!t) return NaN
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t
  return Number(norm)
}

// ── MENU DE CONTEXTO (clique-direito) ────────────────────────────────────────
export function MenuContexto({ x, y, onDepurar, onClose }) {
  useEffect(() => {
    const fecharClick = () => onClose()
    const fecharEsc = e => { if (e.key === "Escape") onClose() }
    window.addEventListener("click", fecharClick)
    window.addEventListener("keydown", fecharEsc)
    return () => {
      window.removeEventListener("click", fecharClick)
      window.removeEventListener("keydown", fecharEsc)
    }
  }, [onClose])

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "fixed", left: x, top: y, zIndex: 2000,
        background: "var(--surface)", border: "1px solid var(--border-mid)",
        borderRadius: 8, boxShadow: "0 6px 24px rgba(0,0,0,0.25)", padding: 4, minWidth: 150
      }}>
      <button onClick={onDepurar} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "8px 12px", fontSize: 13, cursor: "pointer", textAlign: "left",
        background: "none", border: "none", color: "var(--text)", borderRadius: 6
      }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
        onMouseLeave={e => e.currentTarget.style.background = "none"}>
        🔍 Depurar
      </button>
    </div>
  )
}

// ── GALERIA DE CARDS (reutilizável) ──────────────────────────────────────────
export function CardPicker({ value, onPick }) {
  const [cards, setCards] = useState([])
  useEffect(() => {
    fetch(`${API}/viagens/cards`).then(r => r.json()).then(d => setCards(d.cards || [])).catch(() => {})
  }, [])
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
      {cards.map(c => (
        <button key={c} onClick={() => onPick(value === c ? "" : c)} title={c}
          style={{ border: value === c ? "2px solid var(--primary)" : "2px solid var(--border-mid)", borderRadius: 10, padding: 0, cursor: "pointer", overflow: "hidden", background: "none" }}>
          <img src={`/viagens/${encodeURIComponent(c)}`} alt={c} style={{ width: "100%", height: 64, objectFit: "cover", display: "block" }}
            onError={e => { e.target.style.height = "0px" }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)", padding: "3px 4px", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.replace(/\.(png|jpe?g|webp)$/i, "")}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── MODAL: NOVA VIAGEM (com escolha de card) ─────────────────────────────────
function NovaViagemModal({ onSalvar, onClose }) {
  const [destino, setDestino] = useState("")
  const [inicio, setInicio] = useState("")
  const [fim, setFim] = useState("")
  const [card, setCard] = useState("")      // "" = automático pelo destino

  const pronto = destino.trim() && inicio && fim
  const inp = { padding: "9px 12px", fontSize: 13, borderRadius: 10, width: "100%",
    border: "1px solid var(--border-mid)", background: "var(--surface)", color: "var(--text)", outline: "none" }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1800, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, width: "min(560px,95vw)", maxHeight: "85vh", overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: 12, color: "var(--text)" }}>
        <p style={{ fontSize: 15, fontWeight: 600 }}>Nova viagem</p>
        <input autoFocus placeholder="Destino (ex.: Ubatuba)" value={destino} onChange={e => setDestino(e.target.value)} style={inp} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Início</p>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={inp} /></div>
          <div><p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Fim</p>
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} style={inp} /></div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Escolha um card (opcional — sem escolha, usamos um automático pelo destino):
        </p>
        <CardPicker value={card} onPick={setCard} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, background: "none", border: "1px solid var(--border-mid)", borderRadius: 10, cursor: "pointer", color: "var(--text-muted)" }}>Cancelar</button>
          <button disabled={!pronto} onClick={() => onSalvar({ destino: destino.trim(), inicio, fim, card })}
            style={{ padding: "8px 18px", fontSize: 13, fontWeight: 500, background: pronto ? "var(--primary)" : "var(--surface2)", color: pronto ? "#fff" : "var(--text-faint)", border: "none", borderRadius: 10, cursor: pronto ? "pointer" : "not-allowed" }}>
            Criar e atribuir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: DECIDIR APELIDO (este vs base toda) ───────────────────────────────
export function AliasModal({ pend, podeBase, onBaseToda, onSoEste, onClose }) {
  const ghost = { padding: "9px 14px", fontSize: 13, background: "none", border: "1px solid var(--border-mid)", borderRadius: 10, cursor: "pointer", color: "var(--text)", textAlign: "left" }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1800, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, width: "min(460px,95vw)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: 14, color: "var(--text)" }}>
        <p style={{ fontSize: 15, fontWeight: 600 }}>Renomear gasto</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          De <strong style={{ color: "var(--text)" }}>{pend.antigo}</strong> para <strong style={{ color: "var(--primary)" }}>{pend.novo}</strong>.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {podeBase && (
            <button onClick={onBaseToda} style={{ ...ghost, border: "1px solid var(--primary)", color: "var(--primary)", fontWeight: 500 }}>
              Trocar em toda a base e lembrar nos próximos uploads
            </button>
          )}
          <button onClick={onSoEste} style={ghost}>Só este lançamento</button>
          <button onClick={onClose} style={{ ...ghost, border: "none", color: "var(--text-muted)", textAlign: "center" }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── TABELA EDITÁVEL (compartilhada: aba Lançamentos + pop-up Depurar) ─────────
export function TabelaLancamentos({
  lancamentos, rascunho, onEdit, onToggleExcluir,
  viagensDisponiveis = [], onContextMenuLinha = null, editavelExtra = false,
  selecao = null, mostrarTotal = false, onRenomearBase = null
}) {
  const [edit, setEdit] = useState(null)  // { id, campo: 'categoria' | 'viagem' | 'descricao' }
  const [temp, setTemp] = useState("")
  const [apelidoPend, setApelidoPend] = useState(null)  // { id, real, antigo, novo }
  const [ordem, setOrdem] = useState({ key: null, dir: "asc" })  // ordenação por coluna
  const dlId = useId()

  function abrir(id, campo, valorAtual) {
    setEdit({ id, campo })
    setTemp(valorAtual === 0 ? "0" : (valorAtual || ""))
  }
  function cancelar() { setEdit(null); setTemp("") }
  function confirmar() {
    if (!edit) return
    // Descrição: abre o fluxo de apelido (este vs base toda) em vez de salvar direto.
    if (edit.campo === "descricao") {
      const l = lancamentos.find(x => x.id === edit.id)
      const novo = (temp || "").trim()
      if (l && novo && novo !== l.descricao) {
        setApelidoPend({ id: l.id, real: l.descricao_real || l.descricao, antigo: l.descricao, novo })
      }
      cancelar()
      return
    }
    onEdit(edit.id, { [edit.campo]: temp }); cancelar()
  }

  async function confirmarApelidoBase() {
    if (apelidoPend && onRenomearBase) await onRenomearBase(apelidoPend.real, apelidoPend.novo)
    setApelidoPend(null)
  }
  function confirmarApelidoEste() {
    if (apelidoPend) onEdit(apelidoPend.id, { descricao: apelidoPend.novo })
    setApelidoPend(null)
  }

  // Editor inline de texto reutilizável (data / mês / valor)
  function editorTexto(width, placeholder) {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input autoFocus value={temp} onChange={e => setTemp(e.target.value)} placeholder={placeholder}
          onKeyDown={e => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") cancelar() }}
          style={{ fontSize: 11, padding: "3px 6px", width, background: "var(--surface)", border: "1px solid var(--primary)", borderRadius: "var(--radius-sm)", color: "var(--text)", outline: "none" }} />
        <button onClick={confirmar} style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)" }}>OK</button>
        <button onClick={cancelar} style={{ fontSize: 11, padding: "3px 6px", cursor: "pointer", background: "none", color: "var(--text-muted)", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-sm)" }}>✕</button>
      </div>
    )
  }
  // Célula clicável que abre o editorTexto (rótulo + lápis)
  function celulaEditavel(l, campo, texto, largura, placeholder, excluido) {
    const editando = edit && edit.id === l.id && edit.campo === campo
    if (editando) return editorTexto(largura, placeholder)
    return (
      <button disabled={excluido} onClick={() => !excluido && abrir(l.id, campo, eff(l, campo))}
        title="Clique para editar"
        style={{ background: "none", border: "none", cursor: excluido ? "default" : "pointer", padding: 0, color: "inherit", display: "inline-flex", alignItems: "center", gap: 4, font: "inherit" }}>
        {texto}
        {!excluido && <span style={{ fontSize: 9, color: "var(--text-faint)", opacity: 0.6 }}>✎</span>}
      </button>
    )
  }

  function ordenarPor(key) {
    setOrdem(o => o.key === key ? { key, dir: o.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })
  }

  // valor efetivo: rascunho sobrepõe o valor do servidor
  const eff = (l, campo) => {
    const e = rascunho.edits[l.id]
    return e && campo in e ? e[campo] : l[campo]
  }
  const estaEditado = (l) => !!rascunho.edits[l.id]
  const estaExcluido = (l) => rascunho.exclusoes.includes(l.id)

  // Valor comparável de cada coluna para ordenação
  function valorOrdenacao(l, key) {
    switch (key) {
      case "data": {
        const [d, m, y] = (l.data || "").split("/")
        return Number(`${y || ""}${m || ""}${d || ""}`) || 0
      }
      case "valor":     return l.valor ?? 0
      case "mes": {
        const [m, y] = (eff(l, "mes") || "").split("/")
        return Number(`${y || ""}${String(m || "").padStart(2, "0")}`) || 0
      }
      case "descricao": return (l.descricao || "").toLowerCase()
      case "tipo":      return (l.tipo || "").toLowerCase()
      case "fonte":     return (l.fonte || "").toLowerCase()
      case "categoria": return (CATS_NOME[eff(l, "categoria")] || eff(l, "categoria") || "~").toLowerCase()
      case "viagem":    return (eff(l, "viagem") || "~").toLowerCase()
      default:          return ""
    }
  }

  const lancamentosOrdenados = useMemo(() => {
    if (!ordem.key) return lancamentos
    const arr = [...lancamentos]
    arr.sort((a, b) => {
      const va = valorOrdenacao(a, ordem.key)
      const vb = valorOrdenacao(b, ordem.key)
      if (va < vb) return ordem.dir === "asc" ? -1 : 1
      if (va > vb) return ordem.dir === "asc" ? 1 : -1
      return 0
    })
    return arr
  }, [lancamentos, ordem, rascunho])

  const COLUNAS = [
    { label: "Data", key: "data" },
    ...(editavelExtra ? [{ label: "Mês", key: "mes" }] : []),
    { label: "Descrição", key: "descricao" },
    { label: "Categoria", key: "categoria" },
    { label: "Tipo", key: "tipo" },
    { label: "Valor", key: "valor", align: "right" },
    { label: "Fonte", key: "fonte" },
    { label: "Viagem", key: "viagem" },
    { label: "", key: null, acao: true },
  ]

  // Seleção: ids visíveis e se todos estão marcados (para o "selecionar todos" do cabeçalho)
  const idsVisiveis = lancamentos.map(l => l.id)
  const todosSelecionados = selecao && idsVisiveis.length > 0 && idsVisiveis.every(id => selecao.tem(id))

  // Total (rodapé): soma dos valores efetivos (rascunho) dos itens NÃO excluídos.
  const itensNaoExcluidos = lancamentos.filter(l => !estaExcluido(l))
  const totalEfetivo = itensNaoExcluidos.reduce((soma, l) => {
    const vraw = eff(l, "valor")
    const v = typeof vraw === "number" ? vraw : parseValorBR(vraw)
    return Number.isNaN(v) ? soma : soma + v
  }, 0)

  return (
    <div style={{ overflowX: "auto" }}>
      <datalist id={dlId}>
        {viagensDisponiveis.map(v => <option key={v} value={v} />)}
      </datalist>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {COLUNAS.map((col, i) => {
              const ativo = ordem.key === col.key && col.key
              return (
                <th key={i} onClick={col.key ? () => ordenarPor(col.key) : undefined} style={{
                  padding: "8px 12px", textAlign: col.align === "right" ? "right" : "left",
                  fontSize: 10, fontWeight: 500,
                  color: ativo ? "var(--primary)" : "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
                  cursor: col.key ? "pointer" : "default", userSelect: "none"
                }} title={col.key ? "Clique para ordenar" : undefined}>
                  {col.acao && selecao ? (
                    <input type="checkbox" checked={!!todosSelecionados}
                      onChange={() => todosSelecionados ? selecao.limpar() : selecao.definir(idsVisiveis)}
                      title="Selecionar todos os visíveis"
                      style={{ cursor: "pointer", accentColor: "var(--primary)" }} />
                  ) : col.label}
                  {ativo && <span style={{ marginLeft: 4 }}>{ordem.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {lancamentosOrdenados.length === 0 ? (
            <tr><td colSpan={COLUNAS.length} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: 13 }}>
              Nenhum lançamento encontrado.
            </td></tr>
          ) : lancamentosOrdenados.map((l, i) => {
            const cat = eff(l, "categoria")
            const viagem = eff(l, "viagem")
            const valorRaw = eff(l, "valor")
            const valorNum = typeof valorRaw === "number" ? valorRaw : parseValorBR(valorRaw)
            const valorMostrar = Number.isNaN(valorNum) ? l.valor : valorNum
            const isReceita = valorMostrar > 0
            const cor = CATS_COR[cat] || "#888"
            const excluido = estaExcluido(l)
            const editado = estaEditado(l)
            const editandoCat = edit && edit.id === l.id && edit.campo === "categoria"
            const editandoViagem = edit && edit.id === l.id && edit.campo === "viagem"

            return (
              <tr key={l.id}
                onContextMenu={onContextMenuLinha ? (e => onContextMenuLinha(e, l)) : undefined}
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: excluido ? "rgba(226,75,74,0.08)" : i % 2 === 0 ? "transparent" : "var(--surface2)",
                  borderLeft: editado && !excluido ? "2px solid var(--primary)" : "2px solid transparent",
                  opacity: excluido ? 0.55 : 1,
                  textDecoration: excluido ? "line-through" : "none"
                }}>

                <td style={{ padding: "8px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {celulaEditavel(l, "data", eff(l, "data") || l.data || "—", 90, "dd/mm/aaaa", excluido)}
                </td>

                {editavelExtra && (
                  <td style={{ padding: "8px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {celulaEditavel(l, "mes", eff(l, "mes") || "—", 70, "m/aaaa", excluido)}
                  </td>
                )}

                <td style={{ padding: "8px 12px", color: "var(--text)", maxWidth: 260 }}
                  title={l.descricao_real && l.descricao_real !== l.descricao ? `veio como: ${l.descricao_real}` : l.descricao}>
                  {edit && edit.id === l.id && edit.campo === "descricao" ? (
                    editorTexto(180, "nome do gasto")
                  ) : (
                    <button disabled={excluido} onClick={() => !excluido && abrir(l.id, "descricao", l.descricao)}
                      title="Clique para renomear"
                      style={{ background: "none", border: "none", cursor: excluido ? "default" : "pointer", padding: 0, color: "inherit", font: "inherit", display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descricao}</span>
                      {l.descricao_real && l.descricao_real !== l.descricao && (
                        <span style={{ fontSize: 10, flexShrink: 0 }} title={`veio como: ${l.descricao_real}`}>🏷️</span>
                      )}
                      {!excluido && <span style={{ fontSize: 9, color: "var(--text-faint)", opacity: 0.6, flexShrink: 0 }}>✎</span>}
                    </button>
                  )}
                </td>

                {/* CATEGORIA */}
                <td style={{ padding: "6px 12px", minWidth: 140 }}>
                  {editavelExtra ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: cat ? cor : "transparent",
                        border: cat ? "none" : "1px solid var(--border-mid)" }} />
                      <select value={cat || ""} disabled={excluido}
                        onChange={e => onEdit(l.id, { categoria: e.target.value })}
                        title="Selecione a categoria (aplica na hora)"
                        style={{ fontSize: 11, padding: "3px 6px", background: "var(--surface)",
                          border: "1px solid var(--border-mid)", borderRadius: "var(--radius-sm)",
                          color: "var(--text)", outline: "none", cursor: excluido ? "default" : "pointer" }}>
                        <option value="">— sem categoria</option>
                        {TODAS_CATS.map(c => <option key={c} value={c}>{CATS_NOME[c]}</option>)}
                      </select>
                      {l.sugestao?.categoria && l.sugestao.categoria === cat && (
                        <span title={`Sugerido pela ${l.sugestao.fonte === "ia" ? "IA" : "regra"} (${l.sugestao.confianca})`}
                          style={{ fontSize: 10, color: "var(--text-faint)", cursor: "default" }}>✨</span>
                      )}
                    </div>
                  ) : editandoCat ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <select autoFocus value={temp} onChange={e => setTemp(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") cancelar() }}
                        style={{ fontSize: 11, padding: "3px 6px", background: "var(--surface)", border: "1px solid var(--primary)", borderRadius: "var(--radius-sm)", color: "var(--text)", outline: "none", cursor: "pointer" }}>
                        <option value="">— sem categoria</option>
                        {TODAS_CATS.map(c => <option key={c} value={c}>{CATS_NOME[c]}</option>)}
                      </select>
                      <button onClick={confirmar} style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)" }}>OK</button>
                      <button onClick={cancelar} style={{ fontSize: 11, padding: "3px 6px", cursor: "pointer", background: "none", color: "var(--text-muted)", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-sm)" }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => !excluido && abrir(l.id, "categoria", cat)} title="Clique para editar" disabled={excluido}
                      style={{ background: "none", border: "none", cursor: excluido ? "default" : "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {cat ? (
                        <span style={{ display: "inline-block", background: cor + "22", color: cor, border: `1px solid ${cor}44`, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap" }}>
                          {CATS_NOME[cat] || cat}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-faint)", fontSize: 11, border: "1px dashed var(--border-mid)", borderRadius: 20, padding: "2px 8px" }}>—</span>
                      )}
                      {!excluido && <span style={{ fontSize: 9, color: "var(--text-faint)", opacity: 0.6 }}>✎</span>}
                    </button>
                  )}
                </td>

                <td style={{ padding: "8px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{l.tipo}</td>

                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500, color: isReceita ? "var(--primary)" : "var(--text)", whiteSpace: "nowrap" }}>
                  {editavelExtra
                    ? celulaEditavel(l, "valor", <>{isReceita ? "+" : "−"}&nbsp;{fmt(valorMostrar)}</>, 90, "-123,45", excluido)
                    : <>{isReceita ? "+" : "−"}&nbsp;{fmt(l.valor)}</>}
                </td>

                <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                  {l.fonte === "ia" ? (
                    <span style={{ display: "inline-block", background: "rgba(55,138,221,0.12)", color: "#378ADD", border: "1px solid rgba(55,138,221,0.3)", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 500 }}>IA</span>
                  ) : l.fonte === "regra" ? (
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>regra</span>
                  ) : (
                    <span style={{ color: "var(--text-faint)", fontSize: 11 }}>—</span>
                  )}
                </td>

                {/* VIAGEM (texto livre + sugestões) */}
                <td style={{ padding: "6px 12px", minWidth: 140 }}>
                  {editandoViagem ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input autoFocus list={dlId} value={temp} onChange={e => setTemp(e.target.value)}
                        placeholder="(vazio)"
                        onKeyDown={e => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") cancelar() }}
                        style={{ fontSize: 11, padding: "3px 6px", width: 130, background: "var(--surface)", border: "1px solid var(--primary)", borderRadius: "var(--radius-sm)", color: "var(--text)", outline: "none" }} />
                      <button onClick={confirmar} style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)" }}>OK</button>
                      <button onClick={cancelar} style={{ fontSize: 11, padding: "3px 6px", cursor: "pointer", background: "none", color: "var(--text-muted)", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-sm)" }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => !excluido && abrir(l.id, "viagem", viagem)} title="Clique para editar a viagem" disabled={excluido}
                      style={{ background: "none", border: "none", cursor: excluido ? "default" : "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)" }}>
                      {viagem
                        ? <span style={{ fontSize: 11 }}>{viagem}</span>
                        : <span style={{ color: "var(--text-faint)", fontSize: 11 }}>—</span>}
                      {!excluido && <span style={{ fontSize: 9, color: "var(--text-faint)", opacity: 0.6 }}>✎</span>}
                    </button>
                  )}
                </td>

                {/* AÇÃO: caixa de seleção + marcar/desmarcar exclusão */}
                <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {selecao && (
                      <input type="checkbox" checked={selecao.tem(l.id)}
                        onChange={() => selecao.alternar(l.id)}
                        title="Selecionar este lançamento"
                        style={{ cursor: "pointer", accentColor: "var(--primary)" }} />
                    )}
                    {excluido ? (
                      <button onClick={() => onToggleExcluir(l.id)} style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer", background: "none", color: "var(--primary)", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-sm)" }}>
                        Desfazer
                      </button>
                    ) : (
                      <button onClick={() => onToggleExcluir(l.id)} title="Marcar para exclusão"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 13, padding: "2px 6px", borderRadius: "var(--radius-sm)", lineHeight: 1 }}
                        onMouseEnter={e => e.currentTarget.style.color = "var(--danger)"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--text-faint)"}>
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        {mostrarTotal && lancamentos.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={COLUNAS.length} style={{
                position: "sticky", bottom: 0, background: "var(--surface)",
                borderTop: "2px solid var(--border-mid)", padding: "10px 14px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Total · {itensNaoExcluidos.length} lançamento{itensNaoExcluidos.length !== 1 ? "s" : ""}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: totalEfetivo >= 0 ? "var(--primary)" : "var(--danger)" }}>
                    {totalEfetivo < 0 ? "− " : ""}{fmt(totalEfetivo)}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {apelidoPend && (
        <AliasModal
          pend={apelidoPend}
          podeBase={!!onRenomearBase}
          onBaseToda={confirmarApelidoBase}
          onSoEste={confirmarApelidoEste}
          onClose={() => setApelidoPend(null)}
        />
      )}
    </div>
  )
}

// ── BARRA DE RASCUNHO (Salvar / Descartar) ───────────────────────────────────
export function BarraRascunho({ rascunhoApi, labelSalvar = "Salvar na base", onSalvo = null }) {
  const [salvando, setSalvando] = useState(false)
  const n = rascunhoApi.totalPendentes
  if (n === 0) return null

  async function salvar() {
    setSalvando(true)
    try { await rascunhoApi.salvarRascunho(); if (onSalvo) onSalvo() }
    finally { setSalvando(false) }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
      background: "rgba(239,159,39,0.12)", border: "1px solid rgba(239,159,39,0.4)",
      borderRadius: "var(--radius-md)"
    }}>
      <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>
        {n} alteração{n !== 1 ? "ões" : ""} não salva{n !== 1 ? "s" : ""}
      </span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button onClick={rascunhoApi.descartarRascunho} disabled={salvando}
          style={{ fontSize: 12, padding: "5px 12px", cursor: "pointer", background: "none", color: "var(--text-muted)", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-md)" }}>
          Descartar
        </button>
        <button onClick={salvar} disabled={salvando}
          style={{ fontSize: 12, fontWeight: 500, padding: "5px 14px", cursor: "pointer", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)" }}>
          {salvando ? "Salvando…" : labelSalvar}
        </button>
      </div>
    </div>
  )
}

// ── SELEÇÃO DE LINHAS (checkboxes) ────────────────────────────────────────────
// Estado compartilhado entre a tabela (caixas de seleção) e a BarraAcoesLote.
export function useSelecao() {
  const [selecionados, setSelecionados] = useState(() => new Set())
  return useMemo(() => ({
    selecionados,
    tem: id => selecionados.has(id),
    alternar: id => setSelecionados(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    }),
    definir: ids => setSelecionados(new Set(ids)),
    limpar: () => setSelecionados(new Set()),
  }), [selecionados])
}

// ── BARRA DE AÇÕES EM MASSA (cabeçalho das telas de revisão) ──────────────────
// Atua sobre os lançamentos SELECIONADOS (marcados nas caixas de seleção da
// tabela). Permite mudar a categoria de todos os selecionados de uma vez ou
// marcá-los para exclusão. As mudanças vão para o rascunho (reversíveis até
// "Salvar"). "Selecionar todos" marca todos os visíveis.
export function BarraAcoesLote({ lancamentos, rascunhoApi, selecao, viagensDisponiveis = [] }) {
  const [cat, setCat] = useState("")
  const [via, setVia] = useState("")
  const [novaViagem, setNovaViagem] = useState(false)

  const idsVisiveis = useMemo(() => lancamentos.map(l => l.id), [lancamentos])
  const selecionados = useMemo(
    () => idsVisiveis.filter(id => selecao.tem(id)),
    [idsVisiveis, selecao.selecionados]
  )
  const n = selecionados.length
  const total = idsVisiveis.length
  const todosSelecionados = total > 0 && n === total

  if (total === 0) return null

  function aplicarCategoria() {
    if (!cat || n === 0) return
    rascunhoApi.aplicarCategoria(selecionados, cat)
    setCat("")
  }
  function excluirSelecionados() {
    if (n === 0) return
    if (!window.confirm(`Marcar os ${n} lançamentos selecionados para exclusão?\n\nNada é apagado de imediato — você ainda precisa clicar em Salvar.`)) return
    rascunhoApi.marcarExclusoes(selecionados, true)
  }
  function aplicarViagemSel() {
    if (n === 0 || via === "") return
    rascunhoApi.aplicarViagem(selecionados, via === "__none__" ? "" : via)
    setVia("")
  }
  async function criarViagemEAtribuir({ destino, inicio, fim, card }) {
    try {
      await fetch(`${API}/viagens`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destino, data_inicio: inicio, data_fim: fim, card: card || null })
      })
    } catch (e) { console.error(e) }
    rascunhoApi.aplicarViagem(selecionados, destino)
    setNovaViagem(false)
  }

  const btn = {
    fontSize: 11, padding: "5px 12px", cursor: "pointer", borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-mid)", background: "var(--surface)", color: "var(--text)", whiteSpace: "nowrap"
  }
  const habilitado = n > 0

  return (
    <div style={{
      display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
      background: "rgba(55,138,221,0.08)", border: "1px solid rgba(55,138,221,0.35)",
      borderRadius: "var(--radius-md)", padding: "8px 12px"
    }}>
      {/* Selecionar todos / limpar */}
      <button onClick={() => todosSelecionados ? selecao.limpar() : selecao.definir(idsVisiveis)}
        style={{ ...btn, fontWeight: 500 }}>
        {todosSelecionados ? "Limpar seleção" : `Selecionar todos (${total})`}
      </button>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {n} selecionado{n !== 1 ? "s" : ""}
      </span>

      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border-mid)", margin: "0 2px" }} />

      {/* Mudar categoria dos selecionados */}
      <select value={cat} onChange={e => setCat(e.target.value)} disabled={!habilitado}
        title={habilitado ? "Categoria a aplicar nos selecionados" : "Selecione lançamentos primeiro"}
        style={{ ...btn, cursor: habilitado ? "pointer" : "default", opacity: habilitado ? 1 : 0.5,
          borderColor: cat && habilitado ? "var(--primary)" : "var(--border-mid)" }}>
        <option value="">Mudar categoria…</option>
        {TODAS_CATS.map(c => <option key={c} value={c}>{CATS_NOME[c]}</option>)}
      </select>
      <button onClick={aplicarCategoria} disabled={!cat || !habilitado}
        style={{ ...btn, fontWeight: 500,
          background: cat && habilitado ? "var(--primary)" : "var(--surface)",
          color: cat && habilitado ? "#fff" : "var(--text-faint)",
          borderColor: cat && habilitado ? "var(--primary)" : "var(--border-mid)",
          cursor: cat && habilitado ? "pointer" : "default" }}>
        Aplicar aos {n}
      </button>

      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border-mid)", margin: "0 2px" }} />

      {/* Atribuir viagem aos selecionados */}
      <select value={via} disabled={!habilitado}
        onChange={e => { if (e.target.value === "__nova__") setNovaViagem(true); else setVia(e.target.value) }}
        title={habilitado ? "Viagem a atribuir aos selecionados" : "Selecione lançamentos primeiro"}
        style={{ ...btn, cursor: habilitado ? "pointer" : "default", opacity: habilitado ? 1 : 0.5,
          borderColor: via && habilitado ? "var(--primary)" : "var(--border-mid)" }}>
        <option value="">Atribuir viagem…</option>
        {viagensDisponiveis.map(v => <option key={v} value={v}>{v}</option>)}
        <option value="__none__">(remover viagem)</option>
        <option value="__nova__">＋ Nova viagem…</option>
      </select>
      <button onClick={aplicarViagemSel} disabled={!habilitado || via === ""}
        style={{ ...btn, fontWeight: 500,
          background: via && habilitado ? "var(--primary)" : "var(--surface)",
          color: via && habilitado ? "#fff" : "var(--text-faint)",
          borderColor: via && habilitado ? "var(--primary)" : "var(--border-mid)",
          cursor: via && habilitado ? "pointer" : "default" }}>
        Aplicar viagem
      </button>

      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border-mid)", margin: "0 2px" }} />

      {/* Excluir selecionados */}
      <button onClick={excluirSelecionados} disabled={!habilitado}
        style={{ ...btn, fontWeight: 500,
          borderColor: habilitado ? "var(--danger)" : "var(--border-mid)",
          color: habilitado ? "var(--danger)" : "var(--text-faint)",
          cursor: habilitado ? "pointer" : "default", opacity: habilitado ? 1 : 0.6 }}>
        Excluir selecionados ({n})
      </button>

      {novaViagem && <NovaViagemModal onSalvar={criarViagemEAtribuir} onClose={() => setNovaViagem(false)} />}
    </div>
  )
}

// ── MODAL DEPURAR ─────────────────────────────────────────────────────────────
export function ModalDepurar({ filtro, rascunhoApi, onClose }) {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const selecao = useSelecao()
  // Gerenciamento da viagem (só quando o pop-up é de uma viagem)
  const [viagemObj, setViagemObj] = useState(null)
  const [editCard, setEditCard] = useState(false)
  const [cardSel, setCardSel] = useState("")

  async function carregarViagem() {
    if (!filtro.viagem) return
    try {
      const r = await fetch(`${API}/viagens`)
      const vs = await r.json()
      const v = vs.find(x => x.destino === filtro.viagem) || null
      setViagemObj(v); setCardSel(v?.card || "")
    } catch (e) { console.error(e) }
  }
  useEffect(() => { carregarViagem() }, [filtro.viagem, rascunhoApi.versaoDados])

  async function salvarCard() {
    if (!viagemObj) return
    try {
      await fetch(`${API}/viagens`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destino: viagemObj.destino, data_inicio: viagemObj.data_inicio, data_fim: viagemObj.data_fim, card: cardSel || null })
      })
    } catch (e) { console.error(e) }
    setEditCard(false)
    await carregarViagem()
    rascunhoApi.recarregarDados?.()
  }
  async function apagarViagem() {
    if (!viagemObj) return
    if (!window.confirm(`Apagar a viagem "${viagemObj.destino}"?\n\nOs gastos marcados continuam na base, mas sem a tag de viagem.`)) return
    try {
      await fetch(`${API}/viagens/${encodeURIComponent(viagemObj.destino)}`, { method: "DELETE" })
    } catch (e) { console.error(e) }
    rascunhoApi.recarregarDados?.()
    onClose()
  }

  useEffect(() => { carregar() }, [rascunhoApi.versaoDados])
  useEffect(() => {
    const esc = e => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onClose])

  async function carregar() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/lancamentos`)
      setTodos(await r.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const lancs = todos.filter(l => {
    if (filtro.mes && l.mes !== filtro.mes) return false
    if (filtro.categoria && l.categoria !== filtro.categoria) return false
    if (filtro.tipo && l.tipo !== filtro.tipo) return false
    if (filtro.viagem && l.viagem !== filtro.viagem) return false
    // Grupo "despesas": demais grupos, EXCETO Salário (SA), Investimento (I) e
    // Fatura (F). Sem filtro de sinal — estornos (positivos) da mesma categoria
    // aparecem e se subtraem das compras.
    if (filtro.grupo === "despesas" && ["SA", "I", "F"].includes(l.categoria)) return false
    return true
  })
  const viagensDisp = [...new Set(todos.map(l => l.viagem).filter(Boolean))].sort()
  // Total líquido do grupo (soma com sinal) — só os itens que compõem o grupo depurado.
  const total = lancs.reduce((s, l) => s + (l.valor || 0), 0)

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1500, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14,
        width: "100%", maxWidth: 920, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              Depurar — {filtro.titulo || "Lançamentos"}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {lancs.length} lançamento{lancs.length !== 1 ? "s" : ""} · Total {total < 0 ? "− " : ""}{fmt(total)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-muted)", lineHeight: 1 }}>✕</button>
        </div>

        {/* Gerenciamento da viagem (card + apagar) */}
        {filtro.viagem && viagemObj && (
          <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 76, height: 48, borderRadius: 8, overflow: "hidden", background: "var(--surface2)", flexShrink: 0 }}>
                {(cardSel || viagemObj.card) && (
                  <img src={`/viagens/${encodeURIComponent(cardSel || viagemObj.card)}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none" }} />
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <div style={{ color: "var(--text)", fontWeight: 500 }}>✈ {viagemObj.destino}</div>
                <div>{viagemObj.data_inicio} – {viagemObj.data_fim}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => setEditCard(v => !v)} style={{ fontSize: 11, padding: "5px 12px", cursor: "pointer", borderRadius: "var(--radius-md)", border: "1px solid var(--border-mid)", background: "var(--surface)", color: "var(--text)" }}>
                  {editCard ? "Fechar" : "Trocar card"}
                </button>
                <button onClick={apagarViagem} style={{ fontSize: 11, padding: "5px 12px", cursor: "pointer", borderRadius: "var(--radius-md)", border: "1px solid var(--danger)", background: "none", color: "var(--danger)", fontWeight: 500 }}>
                  🗑 Apagar viagem
                </button>
              </div>
            </div>
            {editCard && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <CardPicker value={cardSel} onPick={setCardSel} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => { setCardSel(viagemObj.card || ""); setEditCard(false) }} style={{ fontSize: 11, padding: "5px 12px", cursor: "pointer", borderRadius: "var(--radius-md)", border: "1px solid var(--border-mid)", background: "none", color: "var(--text-muted)" }}>Cancelar</button>
                  <button onClick={salvarCard} style={{ fontSize: 11, fontWeight: 500, padding: "5px 14px", cursor: "pointer", borderRadius: "var(--radius-md)", border: "none", background: "var(--primary)", color: "#fff" }}>Salvar card</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Corpo */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
          {loading ? (
            <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>Carregando...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <BarraAcoesLote lancamentos={lancs} rascunhoApi={rascunhoApi} selecao={selecao} viagensDisponiveis={viagensDisp} />
              <TabelaLancamentos
                lancamentos={lancs}
                rascunho={rascunhoApi.rascunho}
                onEdit={rascunhoApi.editarRascunho}
                onToggleExcluir={rascunhoApi.toggleExcluir}
                viagensDisponiveis={viagensDisp}
                selecao={selecao}
                mostrarTotal={true}
                onRenomearBase={rascunhoApi.renomearBase}
              />
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
          <BarraRascunho rascunhoApi={rascunhoApi} labelSalvar="Salvar dados" />
          {rascunhoApi.totalPendentes === 0 && (
            <p style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "right" }}>
              Edite categoria, viagem ou marque exclusões — depois salve.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MODAL VERIFICAR BASE ──────────────────────────────────────────────────────
// Roda GET /verificar, agrupa os lançamentos problemáticos por tipo de problema
// e deixa corrigir tudo (categoria, viagem, data, mês, valor ou excluir) usando o
// mesmo rascunho global; "Incorporar na base" grava as pendências.
export function ModalVerificar({ rascunhoApi, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/verificar`)
      const json = await r.json()
      setData(json)
      // Pré-seleciona no rascunho as categorias sugeridas pela regra/IA
      const pares = []
      json.problemas?.forEach(p => p.itens?.forEach(l => {
        if (l.sugestao?.categoria) pares.push({ id: l.id, categoria: l.sugestao.categoria })
      }))
      if (pares.length) rascunhoApi.semearCategorias(pares)
    } catch (e) {
      console.error(e)
      setData({ ok: false, total_problemas: 0, problemas: [] })
    }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [rascunhoApi.versaoDados])
  useEffect(() => {
    const esc = e => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onClose])

  // Sugestões de viagem reunindo todas as linhas problemáticas
  const viagensDisp = useMemo(() => {
    const s = new Set()
    data?.problemas?.forEach(p => p.itens?.forEach(l => { if (l.viagem) s.add(l.viagem) }))
    return [...s].sort()
  }, [data])

  // Duplicatas: agrupa por (data|descrição|valor) e devolve os ids EXTRAS
  // (todos menos o de menor id de cada grupo), para remover mantendo 1 de cada.
  function idsDuplicatasExtras(itens) {
    const grupos = {}
    itens.forEach(l => {
      const k = `${l.data}||${l.descricao}||${l.valor}`
      ;(grupos[k] = grupos[k] || []).push(l)
    })
    const extras = []
    Object.values(grupos).forEach(g => {
      [...g].sort((a, b) => a.id - b.id).slice(1).forEach(l => extras.push(l.id))
    })
    return extras
  }

  const btnAcao = {
    fontSize: 11, padding: "4px 10px", cursor: "pointer", borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-mid)", background: "var(--surface)", color: "var(--text)", whiteSpace: "nowrap"
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1500, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14,
        width: "100%", maxWidth: 1000, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>🔍 Verificar base</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {loading ? "Analisando…" : data?.ok ? "Nenhum problema encontrado" : `${data?.total_problemas} tipo(s) de problema`}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-muted)", lineHeight: 1 }}>✕</button>
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
          {loading ? (
            <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>Carregando…</p>
          ) : data?.ok ? (
            <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>✅ Base limpa — nenhum problema encontrado.</p>
          ) : (
            data.problemas.map((p, i) => {
              const ids = p.itens.map(l => l.id)
              const extras = p.tipo === "duplicatas" ? idsDuplicatasExtras(p.itens) : []
              return (
              <div key={p.tipo} style={{ marginBottom: i < data.problemas.length - 1 ? 24 : 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "rgba(226,75,74,0.12)", color: "var(--danger)", border: "1px solid rgba(226,75,74,0.3)", borderRadius: 20, padding: "1px 8px", fontSize: 10 }}>{p.quantidade}</span>
                    {p.descricao}
                  </p>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {p.tipo === "duplicatas" && extras.length > 0 && (
                      <button style={{ ...btnAcao, borderColor: "var(--danger)", color: "var(--danger)", fontWeight: 600 }}
                        title="Mantém 1 lançamento de cada grupo e marca os demais para exclusão"
                        onClick={() => rascunhoApi.marcarExclusoes(extras, true)}>
                        Remover duplicatas (manter 1 de cada) · {extras.length}
                      </button>
                    )}
                    <button style={btnAcao} onClick={() => rascunhoApi.marcarExclusoes(ids, true)}>Excluir todos</button>
                    <button style={btnAcao} onClick={() => rascunhoApi.marcarExclusoes(ids, false)}>Limpar marcações</button>
                  </div>
                </div>
                <TabelaLancamentos
                  lancamentos={p.itens}
                  rascunho={rascunhoApi.rascunho}
                  onEdit={rascunhoApi.editarRascunho}
                  onToggleExcluir={rascunhoApi.toggleExcluir}
                  viagensDisponiveis={viagensDisp}
                  editavelExtra={true}
                  onRenomearBase={rascunhoApi.renomearBase}
                />
              </div>
              )
            })
          )}
        </div>

        {/* Rodapé */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
          <BarraRascunho rascunhoApi={rascunhoApi} labelSalvar="Incorporar na base" />
          {rascunhoApi.totalPendentes === 0 && !loading && !data?.ok && (
            <p style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "right" }}>
              Corrija categoria, data, mês, valor ou marque exclusões — depois incorpore na base.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
