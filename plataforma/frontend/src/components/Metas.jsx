import { useState, useEffect, useMemo } from "react"

const API = "http://127.0.0.1:8000"

const CATS_NOME = {
  CA:"Casa", S:"Saúde", E:"Estudo", A:"Assinatura", T:"Transporte",
  M:"Mercado", C:"Comida", B:"Bens", R:"Roupa", L:"Lazer", O:"Outros"
}
const CATS_COR = {
  CA:"#EF9F27", S:"#D4537E", L:"#1D9E75", C:"#9B59B6", T:"#7F77DD",
  E:"#5DCAA5", M:"#378ADD", B:"#888780", R:"#E24B4A", A:"#F0997B", O:"#5A8A78"
}
// Categorias de gasto disponíveis para limite/redução (exclui SA, I, F)
const CATS_GASTO = ["CA","S","E","A","T","M","C","B","R","L","O"]

const TIPOS = [
  { v:"limite",    label:"Limite de categoria" },
  { v:"reducao",   label:"Redução de categoria" },
  { v:"superavit", label:"Meta de superávit" },
  { v:"acumulo",   label:"Acúmulo em N meses" },
]

function fmt(v) {
  return `R$ ${Math.abs(Math.round(v || 0)).toLocaleString("pt-BR")}`
}

// data "dd/mm/aaaa" → Date
function parseData(s) {
  const [d, m, y] = (s || "").split("/").map(Number)
  if (!d || !m || !y) return null
  return new Date(y, m - 1, d)
}

// Gera os N meses do período fixo terminando em mesFim ("M/AAAA"), voltando no tempo
function mesesDoPeriodo(mesFim, n) {
  const [m, y] = (mesFim || "").split("/").map(Number)
  if (!m || !y) return []
  const out = []
  let mm = m, yy = y
  for (let i = 0; i < n; i++) {
    out.push(`${mm}/${yy}`)
    mm--; if (mm < 1) { mm = 12; yy-- }
  }
  return out
}

const COR = { verde:"var(--primary)", ambar:"var(--gold)", vermelho:"var(--danger)" }

// ── CÁLCULO DE PROGRESSO POR TIPO ───────────────────────────────────────────
// Retorna { pct, cor, texto, overflow, aviso, corIcone }
// Metas SEM conclusão (limite/reducao/superavit) usam a `janela` de 31 dias a
// partir do gasto catalogado mais recente. Só o `acumulo` (período fixo) usa
// os meses fechados de `metricas`.
function calcular(meta, { metricas, statsPorCat, janela }) {
  const corIcone = meta.categoria ? (CATS_COR[meta.categoria] || "#888") : "var(--primary)"

  if (meta.tipo !== "acumulo" && !janela) {
    return { pct: 0, cor: COR.ambar, corIcone, texto: "Carregando lançamentos…" }
  }

  if (meta.tipo === "limite") {
    const atual = Math.abs(janela.gastoPorCat[meta.categoria] || 0)
    const alvo = meta.valor_alvo
    const pct = alvo > 0 ? (atual / alvo) * 100 : 0
    const cor = pct < 80 ? COR.verde : pct < 100 ? COR.ambar : COR.vermelho
    return { pct, cor, corIcone, overflow: pct > 100,
      texto: `${fmt(atual)} de ${fmt(alvo)} · 31 dias` }
  }

  if (meta.tipo === "reducao") {
    const mu = statsPorCat?.[meta.categoria]?.media || 0
    if (mu <= 0) return { pct: 0, cor: COR.ambar, corIcone, texto: "Sem histórico para a média", aviso: true }
    const alvoRs = meta.reducao_modo === "percentual"
      ? mu * (1 - meta.valor_alvo / 100)
      : mu - meta.valor_alvo
    const atual = Math.abs(janela.gastoPorCat[meta.categoria] || 0)
    const denom = mu - alvoRs
    let pct
    if (denom <= 0) pct = atual <= alvoRs ? 100 : 0   // alvo >= média (meta trivial/inválida)
    else pct = ((mu - atual) / denom) * 100
    pct = Math.max(0, pct)
    const cor = pct < 50 ? COR.vermelho : pct < 80 ? COR.ambar : COR.verde
    return { pct, cor, corIcone, overflow: pct > 100,
      texto: `μ ${fmt(mu)} → meta ${fmt(alvoRs)} · atual ${fmt(atual)} (31d)` }
  }

  if (meta.tipo === "superavit") {
    const atual = janela.superavit || 0
    const alvo = meta.valor_alvo
    const pct = alvo > 0 ? (atual / alvo) * 100 : 0
    const cor = pct < 50 ? COR.vermelho : pct < 100 ? COR.ambar : COR.verde
    return { pct, cor, corIcone, overflow: pct > 100,
      texto: `${fmt(atual)} de meta ${fmt(alvo)} · 31 dias` }
  }

  // acumulo — período fixo terminando em acumulo_mes_fim. A data PODE ser futura:
  // os meses que ainda não aconteceram contam 0 e a barra preenche conforme cada
  // mês do período vai fechando. Só os gastos dos meses do período entram (param
  // de somar após o fim).
  const meses = mesesDoPeriodo(meta.acumulo_mes_fim, meta.acumulo_meses)
  const refHoje = (() => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth() })()
  const idxMes = ms => { const [mm, yy] = ms.split("/").map(Number); return yy * 12 + (mm - 1) }
  let soma = 0, faltandoPassado = 0, futuros = 0
  meses.forEach(ms => {
    const m = metricas.find(x => x.mes === ms)
    if (m) soma += (m.superavit || 0)
    else if (idxMes(ms) >= refHoje) futuros++      // mês atual/futuro: ainda vai acontecer
    else faltandoPassado++                         // mês passado sem dado carregado
  })
  const alvo = meta.valor_alvo
  const pct = alvo > 0 ? (soma / alvo) * 100 : 0
  const cor = pct < 50 ? COR.vermelho : pct < 100 ? COR.ambar : COR.verde
  return { pct, cor, corIcone, overflow: pct > 100,
    texto: `${fmt(soma)} de ${fmt(alvo)} · até ${meta.acumulo_mes_fim}${futuros > 0 ? ` · faltam ${futuros} mês(es)` : ""}`,
    aviso: faltandoPassado > 0 ? `${faltandoPassado} mês(es) do período fora do histórico carregado (use período Máx.)` : null }
}

// Acúmulo some 15 dias após o fim do período; os demais tipos ficam sempre visíveis.
function metaVisivel(meta) {
  if (meta.tipo !== "acumulo" || !meta.acumulo_mes_fim) return true
  const [m, y] = meta.acumulo_mes_fim.split("/").map(Number)
  if (!m || !y) return true
  const fimMes = new Date(y, m, 0)                 // último dia do mês fim
  const limite = new Date(fimMes); limite.setDate(limite.getDate() + 15)
  return new Date() <= limite
}

function nomeMeta(meta) {
  if (meta.tipo === "limite")    return `Limite · ${CATS_NOME[meta.categoria] || meta.categoria}`
  if (meta.tipo === "reducao")   return `Redução · ${CATS_NOME[meta.categoria] || meta.categoria}`
  if (meta.tipo === "superavit") return "Superávit mensal"
  return `Acúmulo · ${meta.acumulo_meses} meses`
}

// ── BARRA DE PROGRESSO ──────────────────────────────────────────────────────
function Barra({ pct, cor, overflow }) {
  return (
    <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 4, transition: "width 0.4s ease",
        width: `${Math.min(Math.max(pct, 0), 100)}%`, background: cor,
        animation: overflow ? "meta-pulso 1.6s ease-in-out infinite" : "none"
      }} />
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function Metas({ foco, metricas = [], statsPorCat = {}, periodo, prefill, onPrefillUsado, onChange }) {
  const [metas, setMetas] = useState([])
  const [lancs, setLancs] = useState([])
  const [expandido, setExpandido] = useState(false)
  const [modal, setModal] = useState(false)
  const [modalInicial, setModalInicial] = useState(null)  // {tipo, categoria} p/ pré-preencher

  async function carregar() {
    try {
      const r = await fetch(`${API}/metas`)
      setMetas(await r.json())
    } catch (e) { console.error(e) }
  }
  useEffect(() => { carregar() }, [])

  // Gatilho 7 (Insights): abre o modal já preenchido quando chega um prefill novo.
  useEffect(() => {
    if (prefill && prefill._ts) {
      setModalInicial({ tipo: prefill.tipo || "limite", categoria: prefill.categoria || "C" })
      setModal(true)
    }
  }, [prefill?._ts])

  function fecharModal() {
    setModal(false); setModalInicial(null); onPrefillUsado?.()
  }

  // Lançamentos para a janela de 31 dias (metas sem conclusão)
  useEffect(() => {
    fetch(`${API}/lancamentos`)
      .then(r => r.json())
      .then(d => setLancs(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // Janela de 31 dias para trás desde o gasto catalogado mais recente.
  const janela = useMemo(() => {
    if (!lancs.length) return null
    let recente = null
    for (const l of lancs) {
      const dt = parseData(l.data)
      if (dt && (!recente || dt > recente)) recente = dt
    }
    if (!recente) return null
    const inicio = new Date(recente); inicio.setDate(inicio.getDate() - 31)
    const gastoPorCat = {}
    let receita = 0, despesas = 0
    for (const l of lancs) {
      const dt = parseData(l.data)
      if (!dt || dt < inicio || dt > recente) continue
      const cat = l.categoria, v = l.valor || 0
      if (cat) gastoPorCat[cat] = (gastoPorCat[cat] || 0) + v
      if (cat === "SA") receita += v
      else if (cat && cat !== "I" && cat !== "F" && v < 0) despesas += v
    }
    return { gastoPorCat, superavit: receita + despesas, recente }
  }, [lancs])

  async function remover(id) {
    await fetch(`${API}/metas/${id}`, { method: "DELETE" })
    setMetas(ms => ms.filter(m => m.id !== id))
    onChange?.()
  }

  const ctx = { foco, metricas, statsPorCat, janela }
  const metasAtivas = metas.filter(metaVisivel)
  const visiveis = expandido ? metasAtivas : metasAtivas.slice(0, 4)

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem 1.25rem" }}>
      <style>{`@keyframes meta-pulso { 0%,100%{opacity:1} 50%{opacity:0.55} }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Metas
        </p>
        <button onClick={() => { setModalInicial(null); setModal(true) }} style={{
          padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: 500,
          background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8
        }}>+ Nova</button>
      </div>

      {metasAtivas.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-faint)", padding: "8px 0" }}>
          Nenhuma meta ainda. Crie uma para acompanhar (janela de 31 dias).
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {visiveis.map(meta => {
            const c = calcular(meta, ctx)
            return (
              <div key={meta.id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c.corIcone, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {nomeMeta(meta)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.cor }}>{Math.round(c.pct)}%</span>
                  <button onClick={() => remover(meta.id)} title="Remover meta"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 12, padding: "0 2px", lineHeight: 1 }}>✕</button>
                </div>
                <Barra pct={c.pct} cor={c.cor} overflow={c.overflow} />
                <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{c.texto}</span>
                {c.aviso && typeof c.aviso === "string" && (
                  <span style={{ fontSize: 10, color: "var(--gold)" }}>⚠ {c.aviso}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {metasAtivas.length > 4 && (
        <button onClick={() => setExpandido(e => !e)} style={{
          marginTop: 12, fontSize: 11, cursor: "pointer", background: "none",
          border: "none", color: "var(--primary)", padding: 0
        }}>
          {expandido ? "ver menos" : `ver mais ${metasAtivas.length - 4} meta(s)…`}
        </button>
      )}

      {modal && (
        <ModalNovaMeta
          ctx={ctx} periodo={periodo} inicial={modalInicial}
          onClose={fecharModal}
          onCriada={(m) => { setMetas(ms => [m, ...ms]); fecharModal(); onChange?.() }}
        />
      )}
    </div>
  )
}

// ── MODAL DE CRIAÇÃO ────────────────────────────────────────────────────────
function ModalNovaMeta({ ctx, onClose, onCriada, inicial }) {
  const [tipo, setTipo] = useState(inicial?.tipo || "limite")
  const [categoria, setCategoria] = useState(inicial?.categoria || "C")
  const [reducaoModo, setReducaoModo] = useState("percentual")
  const [valorAlvo, setValorAlvo] = useState("")
  const [acMeses, setAcMeses] = useState(6)
  // Mês fim no formato nativo "AAAA-MM" (o seletor permite datas futuras).
  const hojeYM = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])
  const [acMesFim, setAcMesFim] = useState(hojeYM)
  const mesFimBR = acMesFim ? `${Number(acMesFim.split("-")[1])}/${acMesFim.split("-")[0]}` : ""
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    const esc = e => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [onClose])

  const precisaCategoria = tipo === "limite" || tipo === "reducao"
  const valorNum = parseFloat(String(valorAlvo).replace(",", "."))

  const valido =
    Number.isFinite(valorNum) && valorNum > 0 &&
    (!precisaCategoria || !!categoria) &&
    (tipo !== "acumulo" || (acMeses >= 2 && !!acMesFim))

  const labelValor = {
    limite: "Teto mensal (R$)",
    superavit: "Superávit mínimo mensal (R$)",
    acumulo: "Valor total a acumular (R$)",
  }[tipo] || (reducaoModo === "percentual" ? "Reduzir em (%)" : "Reduzir em (R$)")

  // Meta "fantasma" para o preview ao vivo
  const metaPreview = {
    tipo, categoria: precisaCategoria ? categoria : null,
    valor_alvo: Number.isFinite(valorNum) ? valorNum : 0,
    reducao_modo: tipo === "reducao" ? reducaoModo : null,
    acumulo_meses: tipo === "acumulo" ? Number(acMeses) : null,
    acumulo_mes_fim: tipo === "acumulo" ? mesFimBR : null,
  }
  const prev = valido ? calcular(metaPreview, ctx) : null

  async function criar() {
    setSalvando(true); setErro(null)
    try {
      const body = {
        tipo,
        categoria: precisaCategoria ? categoria : null,
        valor_alvo: valorNum,
        reducao_modo: tipo === "reducao" ? reducaoModo : null,
        acumulo_meses: tipo === "acumulo" ? Number(acMeses) : null,
        acumulo_mes_fim: tipo === "acumulo" ? mesFimBR : null,
      }
      const r = await fetch(`${API}/metas`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || "Erro ao criar meta")
      onCriada(data)
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  const campo = {
    padding: "8px 10px", fontSize: 13, borderRadius: 10, width: "100%", boxSizing: "border-box",
    border: "1px solid var(--popup-border)", background: "#fff", color: "var(--popup-text)", outline: "none"
  }
  const rotulo = { fontSize: 11, color: "var(--popup-muted)", marginBottom: 4 }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1600, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--popup-bg)", color: "var(--popup-text)", borderRadius: 16,
        border: "1px solid var(--popup-border)", padding: "1.5rem", width: "min(460px, 95vw)",
        display: "flex", flexDirection: "column", gap: 14
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Nova meta</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--popup-muted)" }}>✕</button>
        </div>

        {/* Tipo */}
        <div>
          <p style={rotulo}>Tipo</p>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...campo, cursor: "pointer" }}>
            {TIPOS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </div>

        {/* Categoria */}
        {precisaCategoria && (
          <div>
            <p style={rotulo}>Categoria</p>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{ ...campo, cursor: "pointer" }}>
              {CATS_GASTO.map(c => <option key={c} value={c}>{c} — {CATS_NOME[c]}</option>)}
            </select>
          </div>
        )}

        {/* Modo de redução */}
        {tipo === "reducao" && (
          <div>
            <p style={rotulo}>Modo de redução</p>
            <div style={{ display: "flex", gap: 14 }}>
              {[["percentual", "Em %"], ["absoluto", "Em R$"]].map(([v, l]) => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" checked={reducaoModo === v} onChange={() => setReducaoModo(v)} style={{ accentColor: "var(--primary)" }} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Valor alvo */}
        <div>
          <p style={rotulo}>{labelValor}</p>
          <input type="number" min="0" value={valorAlvo} onChange={e => setValorAlvo(e.target.value)}
            placeholder="0" style={campo} />
        </div>

        {/* Acúmulo: meses + mês fim */}
        {tipo === "acumulo" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <p style={rotulo}>Nº de meses</p>
              <input type="number" min="2" value={acMeses}
                onChange={e => setAcMeses(Math.max(2, Number(e.target.value) || 2))} style={campo} />
            </div>
            <div>
              <p style={rotulo}>Mês final do período</p>
              <input type="month" value={acMesFim} min={hojeYM}
                onChange={e => setAcMesFim(e.target.value)} style={campo} />
            </div>
          </div>
        )}

        {/* Preview ao vivo */}
        {prev && (
          <div style={{ background: "var(--popup-surface)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "var(--popup-muted)" }}>Prévia (últimos 31 dias)</span>
              <span style={{ fontWeight: 600, color: prev.cor }}>{Math.round(prev.pct)}%</span>
            </div>
            <Barra pct={prev.pct} cor={prev.cor} overflow={prev.overflow} />
            <span style={{ fontSize: 10, color: "var(--popup-muted)" }}>{prev.texto}</span>
            {prev.aviso && typeof prev.aviso === "string" && (
              <span style={{ fontSize: 10, color: "var(--gold)" }}>⚠ {prev.aviso}</span>
            )}
          </div>
        )}

        {erro && <p style={{ fontSize: 12, color: "var(--danger)" }}>⚠ {erro}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, background: "transparent", border: "1px solid var(--popup-border)", borderRadius: 10, cursor: "pointer", color: "var(--popup-muted)" }}>
            Cancelar
          </button>
          <button onClick={criar} disabled={!valido || salvando} style={{
            padding: "8px 20px", fontSize: 13, fontWeight: 500, border: "none", borderRadius: 10,
            background: valido ? "var(--primary)" : "#ccc", color: "#fff",
            cursor: valido && !salvando ? "pointer" : "not-allowed"
          }}>
            {salvando ? "Criando…" : "Criar meta"}
          </button>
        </div>
      </div>
    </div>
  )
}
