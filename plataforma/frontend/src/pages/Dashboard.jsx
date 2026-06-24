import { useState, useEffect, useRef } from "react"
import { MenuContexto } from "../components/TabelaLancamentos"
import Metas from "../components/Metas"
import Insights from "../components/Insights"

const API = "http://127.0.0.1:8000"

const CATS_NOME = {
  SA:"Salário", I:"Investimento", CA:"Casa", S:"Saúde", E:"Estudo",
  A:"Assinatura", T:"Transporte", M:"Mercado", C:"Comida",
  B:"Bens", R:"Roupa", L:"Lazer", O:"Outros"
}

const CATS_COR = {
  CA:"#EF9F27", S:"#D4537E", L:"#1D9E75", C:"#9B59B6", T:"#7F77DD",
  E:"#5DCAA5", M:"#378ADD", B:"#888780", R:"#E24B4A", A:"#F0997B",
  O:"#5A8A78", SA:"#27AE60", I:"#EF9F27"
}

const SERIES_BASE = [
  { key: "receita",       label: "Receita",       cor: "#1D9E75" },
  { key: "despesas",      label: "Despesas",      cor: "#E24B4A" },
  { key: "superavit",     label: "Superávit",     cor: "#378ADD" },
  { key: "investimentos", label: "Investimentos", cor: "#EF9F27" },
]

// Categorias de gasto (empilháveis / consideradas em insights e composição)
const CATS_GRAFICO = ["CA","S","L","C","T","M","E","A","B","R","O"]
const PERIODOS = ["6m","12m","18m","24m","YTD","Max"]

// Mínimo de meses no período para um insight estatístico ser confiável
const MIN_MESES_INSIGHT = 3

// Nomes normalizados para match com imagens de viagem
const VIAGEM_IMAGENS = {
  "florianopolis": "florianopolis.png",
  "floripa": "florianopolis.png",
  "praia do rosa": "florianopolis.png",
  "ilhabela": "ilhabela.png",
  "chapada diamantina": "chapada-diamantina.png",
  "chapada": "chapada-diamantina.png",
  "ubatuba": "ubatuba.png",
  "itacara": "itacara.png",
  "itacare": "itacara.png",
  "itaunas": "itaunas.png",
  "petar": "petar.png",
  "camburi": "camburi.png",
  "rio de janeiro": "rio-de-janeiro.png",
  "carnaval rio": "rio-de-janeiro.png",
}

function getImagemViagem(destino) {
  const norm = destino.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[+]/g, " ").trim()

  for (const [key, img] of Object.entries(VIAGEM_IMAGENS)) {
    if (norm.includes(key)) return `/viagens/${img}`
  }
  return null
}

function sortearGG(familia) {
  const vars = { surpreso: 9, ostentando: 4, poupando: 2 }
  const n = vars[familia] || 1
  const idx = Math.floor(Math.random() * n)
  const sufixo = idx === 0 ? "" : `.${idx + 1}`
  return `/gogo/GG.${familia}${sufixo}.PNG`
}

function fmt(v) {
  return `R$ ${Math.abs(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`
}

function filtrarMesesFuturos(metricas) {
  const hoje = new Date()
  const limiteAno = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear()
  const limiteMes = hoje.getMonth() === 0 ? 12 : hoje.getMonth()

  return (metricas || []).filter(m => {
    const [mes, ano] = m.mes.split("/").map(Number)
    return ano < limiteAno || (ano === limiteAno && mes <= limiteMes)
  })
}

// Média e desvio padrão (populacional) de um array de valores
function mediaStd(vals) {
  const n = vals.length
  if (!n) return { n: 0, media: 0, std: 0 }
  const media = vals.reduce((s, v) => s + v, 0) / n
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - media) ** 2, 0) / n)
  return { n, media, std }
}

export default function Dashboard({ onNavegar, onDepurar, versaoDados = 0 }) {
  const [dados, setDados] = useState(null)
  const [metricasFull, setMetricasFull] = useState([])  // histórico completo p/ insights
  const [metasDash, setMetasDash] = useState([])         // metas p/ insights (gatilho 7)
  const [metaPrefill, setMetaPrefill] = useState(null)   // abre modal de meta pré-preenchido
  const [viagens, setViagens] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState("6m")
  const [seriesSelecionadas, setSeriesSelecionadas] = useState(["receita", "despesas", "superavit"])
  const [empilhar, setEmpilhar] = useState(false)
  const [mostrarMedias, setMostrarMedias] = useState(false)  // linha pontilhada na média
  const [acumular, setAcumular] = useState(false)            // soma corrida (Invest./Superávit)
  const [emAndamento, setEmAndamento] = useState(false)
  const [mesFoco, setMesFoco] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)  // { x, y, filtro } — menu Depurar do gráfico

  const [ggSuperavit] = useState(() => sortearGG("ostentando"))
  const [ggDeficit]   = useState(() => sortearGG("surpreso"))
  const [ggVazio]     = useState(() => sortearGG("surpreso"))

  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    if (window.Chart) { carregar(); return }

    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"
    script.onload = () => carregar()
    document.head.appendChild(script)

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
        chartInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (window.Chart) carregar()
  }, [periodo, emAndamento, versaoDados])

  useEffect(() => {
    if (dados) renderChart()
  }, [dados, seriesSelecionadas, empilhar, mesFoco, mostrarMedias, acumular])

  function mesesDoPeriodo() {
    if (periodo === "Max") return 999
    if (periodo === "YTD") return null
    return parseInt(periodo)
  }

  async function carregar() {
    setLoading(true)
    setMesFoco(null)
    try {
      const meses = mesesDoPeriodo()
      let url = meses ? `${API}/dashboard?meses=${meses}` : `${API}/dashboard?ytd=true`
      if (emAndamento) url += "&em_andamento=true"

      const [d, v, dFull, ms] = await Promise.all([
        fetch(url).then(r => r.json()),
        fetch(`${API}/viagens`).then(r => r.json()),
        fetch(`${API}/dashboard?meses=999`).then(r => r.json()),  // todos os meses fechados
        fetch(`${API}/metas`).then(r => r.json()),
      ])

      setDados(d)
      setViagens(v || [])
      setMetricasFull(dFull?.metricas_mensais || [])
      setMetasDash(Array.isArray(ms) ? ms : [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  function toggleSerie(key) {
    setSeriesSelecionadas(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  // Gatilho 7 (Insights): abre o modal de meta já com a categoria e tipo "redução".
  function onCriarMeta(categoria) {
    setMetaPrefill({ categoria, tipo: "reducao", _ts: Date.now() })
  }
  function recarregarMetas() {
    fetch(`${API}/metas`).then(r => r.json()).then(ms => setMetasDash(Array.isArray(ms) ? ms : [])).catch(() => {})
  }

  // Lista de meses exibidos: com "mês em andamento" o backend já inclui o mês
  // corrente; sem ele, mantemos a guarda que esconde meses futuros/incompletos.
  function metricasExibidas() {
    const raw = dados?.metricas_mensais || []
    return emAndamento ? raw : filtrarMesesFuturos(raw)
  }

  function totalGastosMes(m) {
    return CATS_GRAFICO.reduce((s, c) => s + Math.abs(m.categorias?.[c] || 0), 0)
  }

  // Clique-direito num ponto do gráfico → menu "Depurar"
  function onCanvasContext(e) {
    e.preventDefault()
    const chart = chartInstance.current
    if (!chart) return
    const els = chart.getElementsAtEventForMode(e.nativeEvent, "nearest", { intersect: true }, true)
    if (!els.length) return
    const { datasetIndex, index } = els[0]
    const serie = chart.data.datasets[datasetIndex]?._serie
    const metricas = metricasExibidas()
    const mes = metricas[index]?.mes
    if (!mes || !serie || serie.tipo === "media") return

    let filtro
    if (serie.tipo === "cat") {
      filtro = { mes, categoria: serie.cat, titulo: `${CATS_NOME[serie.cat] || serie.cat} · ${mes}` }
    } else if (serie.key === "receita") {
      filtro = { mes, categoria: "SA", titulo: `Receita · ${mes}` }
    } else if (serie.key === "despesas") {
      filtro = { mes, grupo: "despesas", titulo: `Despesas · ${mes}` }
    } else if (serie.key === "investimentos") {
      filtro = { mes, categoria: "I", titulo: `Investimentos · ${mes}` }
    } else {
      filtro = { mes, titulo: `Superávit · ${mes}` }
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, filtro })
  }

  function renderChart() {
    if (!chartRef.current || !window.Chart) return

    const metricas = metricasExibidas()
    if (!metricas.length) return

    if (chartInstance.current) {
      chartInstance.current.destroy()
      chartInstance.current = null
    }

    const idxUltimo = metricas.length - 1
    const idxFoco = mesFoco ? metricas.findIndex(m => m.mes === mesFoco) : idxUltimo
    const idxFocoOk = idxFoco >= 0 ? idxFoco : idxUltimo

    const isDark = matchMedia("(prefers-color-scheme: dark)").matches
    const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"
    const tickColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)"
    // Linha do zero destacada (theme-aware: clara no escuro, escura no claro)
    const corZero = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.55)"
    const gridY = {
      color: ctx => ctx.tick?.value === 0 ? corZero : gridColor,
      lineWidth: ctx => ctx.tick?.value === 0 ? 2 : 1,
    }

    const datasets = []

    // Séries base (receita/despesa/superávit/investimentos): NUNCA empilham.
    if (!empilhar) {
      SERIES_BASE.filter(s => seriesSelecionadas.includes(s.key)).forEach(s => {
        let serieData = metricas.map(m => {
          if (s.key === "superavit") return Math.round((m.receita || 0) - (m.despesas || 0))
          if (s.key === "investimentos") return Math.round(m.investimentos || 0)
          return Math.round(m[s.key] || 0)
        })
        const acum = acumular
        if (acum) {
          let run = 0
          serieData = serieData.map(v => (run += v))
        }
        datasets.push({
          label: acum ? `${s.label} (acum.)` : s.label,
          data: serieData,
          borderColor: s.cor,
          borderWidth: 2,
          borderDash: [],
          pointRadius: ctx => ctx.dataIndex === idxFocoOk ? 5 : 3,
          pointBackgroundColor: s.cor,
          tension: 0.3,
          fill: false,
          _serie: { tipo: "base", key: s.key },
        })
      })
    }

    // Categorias de gasto
    CATS_GRAFICO.filter(c => seriesSelecionadas.includes(c)).forEach(cat => {
      let serieData = metricas.map(m => {
        const val = Math.abs(m.categorias?.[cat] || 0)
        if (empilhar) {
          const tot = totalGastosMes(m)
          return tot > 0 ? (val / tot) * 100 : 0
        }
        return Math.round(val)
      })
      const acum = acumular && !empilhar
      if (acum) {
        let run = 0
        serieData = serieData.map(v => (run += v))
      }
      datasets.push({
        label: acum ? `${CATS_NOME[cat] || cat} (acum.)` : (CATS_NOME[cat] || cat),
        data: serieData,
        borderColor: CATS_COR[cat] || "#888",
        backgroundColor: empilhar ? (CATS_COR[cat] || "#888") + "55" : undefined,
        borderWidth: 2,
        borderDash: [],
        pointRadius: empilhar ? 0 : (ctx => ctx.dataIndex === idxFocoOk ? 4 : 2),
        pointBackgroundColor: CATS_COR[cat] || "#888",
        tension: 0.3,
        fill: empilhar ? true : false,
        stack: empilhar ? "gastos" : undefined,
        _serie: { tipo: "cat", cat },
      })
    })

    // Médias do período: para cada série nominal selecionada, uma linha
    // pontilhada da MESMA cor, no nível da média do período.
    if (mostrarMedias && !empilhar) {
      datasets.slice().forEach(ds => {
        const vals = ds.data || []
        const media = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
        datasets.push({
          label: `Média ${ds.label}`,
          data: vals.map(() => media),
          borderColor: ds.borderColor,
          borderWidth: 1.5,
          borderDash: [2, 4],
          pointRadius: 0,
          tension: 0,
          fill: false,
          _serie: { tipo: "media" },
        })
      })
    }

    chartInstance.current = new window.Chart(chartRef.current, {
      type: "line",
      data: { labels: metricas.map(m => m.mes), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (evt, els, chart) => {
          const pts = chart.getElementsAtEventForMode(evt, "index", { intersect: false }, true)
          if (!pts.length) return
          const mesClicado = metricas[pts[0].index]?.mes
          if (mesClicado) setMesFoco(prev => (prev === mesClicado ? null : mesClicado))
        },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            filter: item => item.dataset?._serie?.tipo !== "media",
            callbacks: {
              label: ctx => empilhar
                ? `${ctx.dataset.label}: ${(ctx.raw || 0).toFixed(1)}%`
                : `${ctx.dataset.label}: ${fmt(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 10 }, autoSkip: true, maxTicksLimit: 12 }
          },
          y: empilhar
            ? {
                stacked: true, min: 0, max: 100,
                grid: gridY,
                ticks: { color: tickColor, font: { size: 10 }, callback: v => v + "%" }
              }
            : {
                grid: gridY,
                ticks: { color: tickColor, font: { size: 10 }, callback: v => "R$" + (v / 1000).toFixed(0) + "k" }
              }
        }
      }
    })
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
      Carregando...
    </div>
  )

  const metricas = metricasExibidas()

  if (!metricas.length) return (
    <div style={{
      textAlign: "center", padding: "4rem", display: "flex",
      flexDirection: "column", alignItems: "center", gap: 16
    }}>
      <img src={ggVazio} style={{ height: 160 }} onError={e => e.target.style.display = "none"} />
      <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text)" }}>Sem dados ainda</p>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Vá para Upload e envie seus extratos.</p>
    </div>
  )

  // ── MÊS DE FOCO ───────────────────────────────────────────────────────────
  const idxUltimo = metricas.length - 1
  const idxFocoRaw = mesFoco ? metricas.findIndex(m => m.mes === mesFoco) : idxUltimo
  const idxFoco = idxFocoRaw >= 0 ? idxFocoRaw : idxUltimo
  const foco = metricas[idxFoco]
  const prev = idxFoco > 0 ? metricas[idxFoco - 1] : null

  const eaInfo = dados.em_andamento || null
  const focoEmAndamento = !!(emAndamento && eaInfo && foco.mes === eaInfo.mes)

  // ── CARDS DO TOPO ─────────────────────────────────────────────────────────
  let cRec, cDesp, cInv, pRec, pDesp, labelComp
  if (focoEmAndamento) {
    cRec = eaInfo.corrente.receita
    cDesp = eaInfo.corrente.despesas
    cInv = eaInfo.corrente.investimentos
    pRec = eaInfo.anterior_corrido.receita
    pDesp = eaInfo.anterior_corrido.despesas
    labelComp = `vs ${eaInfo.mes_anterior} até dia ${eaInfo.dia_corte}`
  } else {
    cRec = foco.receita
    cDesp = foco.despesas
    cInv = foco.investimentos
    pRec = prev?.receita ?? null
    pDesp = prev?.despesas ?? null
    labelComp = prev ? `vs ${prev.mes}` : null
  }
  const superavit = Math.round((cRec || 0) - (cDesp || 0))

  // ── TOTAIS AGREGADOS DO PERÍODO (somatório dos meses do filtro) ────────────
  const periodoTotais = metricas.reduce((acc, m) => {
    acc.receita += m.receita || 0
    acc.despesas += m.despesas || 0
    acc.investimentos += m.investimentos || 0
    return acc
  }, { receita: 0, despesas: 0, investimentos: 0 })
  const superavitPeriodo = periodoTotais.receita - periodoTotais.despesas
  const labelPeriodo = periodo === "Max" ? "máx" : periodo

  const indice = dados.indice_saude
  const corIdx = indice >= 70 ? "#1D9E75" : indice >= 40 ? "#BA7517" : "#C0392B"

  const navTo = (filtro) => { if (onNavegar) onNavegar(filtro) }

  const cards = [
    { label: "Receita", val: cRec, prev: pRec, periodo: periodoTotais.receita, cor: "var(--primary)", onClick: () => navTo({ mes: foco.mes, categoria: "SA" }) },
    { label: "Despesas", val: cDesp, prev: pDesp, periodo: periodoTotais.despesas, cor: "var(--text)", onClick: () => navTo({ mes: foco.mes, grupo: "despesas" }) },
    { label: superavit >= 0 ? "Superávit" : "Déficit", val: Math.abs(superavit), prev: null, periodo: superavitPeriodo, cor: superavit >= 0 ? "var(--primary)" : "var(--danger)", onClick: null },
    { label: "Investimentos", val: cInv, prev: null, periodo: periodoTotais.investimentos, cor: "var(--gold)", onClick: () => navTo({ mes: foco.mes, categoria: "I" }) },
  ]

  // ── COMPOSIÇÃO DO MÊS FOCADO ──────────────────────────────────────────────
  const cats_desp = Object.entries(foco.categorias || {})
    .filter(([k, v]) => !["SA", "I", "F"].includes(k) && v < 0)
    .map(([k, v]) => ({ cat: k, val: Math.abs(v) }))
    .sort((a, b) => b.val - a.val)

  const total_desp = cats_desp.reduce((s, c) => s + c.val, 0)

  // Stats por categoria no período (não muda com o mês de foco).
  // Exclui o mês em andamento (incompleto) para não contaminar média/desvio.
  const metricasFechadas = eaInfo ? metricas.filter(m => m.mes !== eaInfo.mes) : metricas
  const statsPorCat = {}
  CATS_GRAFICO.forEach(cat => {
    const vals = metricasFechadas.map(m => Math.abs(m.categorias?.[cat] || 0))
    statsPorCat[cat] = mediaStd(vals)
  })

  // Alvo "a ser completada" (modo em andamento): gasto da MESMA categoria no mês anterior fechado
  const alvoMesAnterior = (cat) => prev ? Math.abs(prev.categorias?.[cat] || 0) : 0

  // Rótulo do mês focado
  const labelFoco = focoEmAndamento
    ? `${foco.mes} — em andamento (até dia ${eaInfo.dia_corte})`
    : (idxFoco === idxUltimo && !mesFoco ? `${foco.mes} — último mês` : `${foco.mes} — em foco`)

  const cardClicavelStyle = {
    cursor: "pointer", transition: "transform 0.1s, box-shadow 0.15s",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ÍNDICE */}
      <div style={{ background: corIdx, borderRadius: 14, padding: "1.25rem 1.5rem", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Índice de saúde financeira
            </p>
            <p style={{ fontSize: 48, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
              {indice}<span style={{ fontSize: 20, fontWeight: 400 }}>/100</span>
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 8 }}>
              {indice >= 70 ? "Bom ritmo! Maioria dos meses com superávit."
               : indice >= 40 ? "Atenção — alguns meses com déficit."
               : "Despesas acima da receita na maioria dos meses."}
            </p>
          </div>

          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>{foco.mes}</p>
              <div style={{ width: 100, height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3 }}>
                <div style={{ width: `${indice}%`, height: "100%", background: "#fff", borderRadius: 3 }} />
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                Invest. no mês: {fmt(cInv)}
              </p>
            </div>

            <img src={superavit >= 0 ? ggSuperavit : ggDeficit}
              style={{ height: 90, objectFit: "contain" }}
              onError={e => e.target.style.display = "none"} />
          </div>
        </div>
      </div>

      {/* CARDS MÊS */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {labelFoco}
          </p>

          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {/* Toggle: mês em andamento */}
            <button onClick={() => setEmAndamento(v => !v)} style={{
              padding: "3px 10px", fontSize: 11, cursor: "pointer",
              background: emAndamento ? "var(--gold)" : "var(--surface)",
              border: `1px solid ${emAndamento ? "var(--gold)" : "var(--border-mid)"}`,
              borderRadius: 8, color: emAndamento ? "#fff" : "var(--text-muted)",
              fontWeight: emAndamento ? 500 : 400
            }}>
              + Mês em andamento
            </button>

            <div style={{ width: 1, background: "var(--border-mid)", alignSelf: "stretch", margin: "0 2px" }} />

            {PERIODOS.map(p => (
              <button key={p} onClick={() => setPeriodo(p)} style={{
                padding: "3px 10px", fontSize: 11, cursor: "pointer",
                background: periodo === p ? "var(--primary)" : "var(--surface)",
                border: `1px solid ${periodo === p ? "var(--primary)" : "var(--border-mid)"}`,
                borderRadius: 8, color: periodo === p ? "#fff" : "var(--text-muted)",
                fontWeight: periodo === p ? 500 : 400
              }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {cards.map(c => (
            <div key={c.label}
              onClick={c.onClick || undefined}
              title={c.onClick ? "Ver lançamentos" : undefined}
              style={{
                background: "var(--surface)", borderRadius: 10, padding: "14px",
                ...(c.onClick ? cardClicavelStyle : {})
              }}
              onMouseEnter={c.onClick ? e => { e.currentTarget.style.boxShadow = "0 0 0 1px var(--primary)" } : undefined}
              onMouseLeave={c.onClick ? e => { e.currentTarget.style.boxShadow = "none" } : undefined}
            >
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
                {c.label}
              </p>
              <p style={{ fontSize: 22, fontWeight: 600, color: c.cor, marginBottom: 4 }}>{fmt(c.val)}</p>

              {/* Total agregado no período selecionado (somatório dos meses do filtro) */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}
                title={`Soma de ${c.label} nos ${metricas.length} meses do período`}>
                <span style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
                  Σ {labelPeriodo}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {c.periodo < 0 ? "− " : ""}{fmt(c.periodo)}
                </span>
              </div>

              {c.prev != null && labelComp && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--surface2)", color: "var(--text-muted)" }}>
                  {c.val >= (c.prev || 0) ? "▲" : "▼"} {labelComp}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* GRÁFICO */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Evolução histórica {mesFoco && <span style={{ color: "var(--primary)" }}>· foco {mesFoco}</span>}
          </p>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setMostrarMedias(v => !v)} disabled={empilhar}
              title="Mostra a média do período de cada série como linha pontilhada da mesma cor"
              style={{
                padding: "3px 10px", fontSize: 11, cursor: empilhar ? "not-allowed" : "pointer",
                opacity: empilhar ? 0.4 : 1,
                background: mostrarMedias && !empilhar ? "var(--primary)" : "var(--surface2)",
                border: `1px solid ${mostrarMedias && !empilhar ? "var(--primary)" : "var(--border-mid)"}`,
                borderRadius: 8, color: mostrarMedias && !empilhar ? "#fff" : "var(--text-muted)",
                fontWeight: mostrarMedias ? 500 : 400
              }}>
              ┈ Médias
            </button>
            <button onClick={() => setAcumular(v => !v)} disabled={empilhar}
              title="Soma corrida no período (todas as séries selecionadas)"
              style={{
                padding: "3px 10px", fontSize: 11, cursor: empilhar ? "not-allowed" : "pointer",
                opacity: empilhar ? 0.4 : 1,
                background: acumular && !empilhar ? "var(--primary)" : "var(--surface2)",
                border: `1px solid ${acumular && !empilhar ? "var(--primary)" : "var(--border-mid)"}`,
                borderRadius: 8, color: acumular && !empilhar ? "#fff" : "var(--text-muted)",
                fontWeight: acumular ? 500 : 400
              }}>
              Σ Acumular
            </button>
            <button onClick={() => setEmpilhar(v => !v)} style={{
              padding: "3px 10px", fontSize: 11, cursor: "pointer",
              background: empilhar ? "var(--primary)" : "var(--surface2)",
              border: `1px solid ${empilhar ? "var(--primary)" : "var(--border-mid)"}`,
              borderRadius: 8, color: empilhar ? "#fff" : "var(--text-muted)",
              fontWeight: empilhar ? 500 : 400
            }}>
              Empilhar (%)
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {SERIES_BASE.map(s => {
            const ativo = seriesSelecionadas.includes(s.key)
            return (
              <button key={s.key} onClick={() => !empilhar && toggleSerie(s.key)}
                disabled={empilhar}
                title={empilhar ? "Indisponível no modo empilhado" : undefined}
                style={{
                  padding: "3px 10px", fontSize: 11,
                  cursor: empilhar ? "not-allowed" : "pointer",
                  opacity: empilhar ? 0.4 : 1,
                  background: ativo && !empilhar ? s.cor : "var(--surface2)",
                  border: `1px solid ${ativo && !empilhar ? s.cor : "var(--border-mid)"}`,
                  borderRadius: 8, color: ativo && !empilhar ? "#fff" : "var(--text-muted)",
                  fontWeight: ativo ? 500 : 400, transition: "all 0.15s"
                }}>
                {s.label}
              </button>
            )
          })}

          <div style={{ width: "1px", background: "var(--border-mid)", margin: "0 4px" }} />

          {CATS_GRAFICO.map(cat => {
            const ativo = seriesSelecionadas.includes(cat)
            const cor = CATS_COR[cat] || "#888"
            return (
              <button key={cat} onClick={() => toggleSerie(cat)} style={{
                padding: "3px 10px", fontSize: 11, cursor: "pointer",
                background: ativo ? cor : "var(--surface2)",
                border: `1px solid ${ativo ? cor : "var(--border-mid)"}`,
                borderRadius: 8, color: ativo ? "#fff" : "var(--text-muted)",
                fontWeight: ativo ? 500 : 400, transition: "all 0.15s"
              }}>
                {CATS_NOME[cat] || cat}
              </button>
            )
          })}
        </div>

        <div style={{ position: "relative", width: "100%", height: 190 }}>
          <canvas ref={chartRef} role="img" aria-label="Gráfico de evolução histórica"
            onContextMenu={onCanvasContext}>
            Gráfico de evolução financeira mensal.
          </canvas>
        </div>
        <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>
          Clique num mês para focar o painel · clique-direito num ponto para depurar os lançamentos.
        </p>
      </div>

      {/* COMPOSIÇÃO (com média e desvio) + INSIGHTS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

        {/* COMPOSIÇÃO + MÉDIA + DESVIO */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem 1.25rem" }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Composição — {foco.mes}
          </p>
          <p style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 12 }}>
            {focoEmAndamento
              ? `Barra preenche rumo ao gasto de ${eaInfo.mes_anterior} (mês fechado)`
              : `Barra = % do gasto do mês · média e desvio sobre o período (${periodo})`}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {cats_desp.slice(0, 8).map(({ cat, val }) => {
              const st = statsPorCat[cat] || { media: 0, std: 0 }
              const desvioPct = st.media > 0 ? ((val - st.media) / st.media) * 100 : 0
              const foraSigma = st.std > 0.01 && Math.abs((val - st.media) / st.std) > 1

              // Largura da barra
              let pct, overflow = false
              if (focoEmAndamento) {
                const alvo = alvoMesAnterior(cat)
                pct = alvo > 0 ? (val / alvo) * 100 : (val > 0 ? 100 : 0)
                overflow = pct > 100
              } else {
                pct = total_desp > 0 ? (val / total_desp) * 100 : 0
              }
              const barCor = overflow ? "var(--danger)" : (CATS_COR[cat] || "#888")

              return (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: CATS_COR[cat] || "#888", flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)", width: 70, flexShrink: 0 }}>{CATS_NOME[cat] || cat}</p>

                  <div style={{ flex: 1, height: 6, background: "var(--surface2)", borderRadius: 3, position: "relative", minWidth: 30 }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: barCor, borderRadius: 3 }} />
                  </div>

                  {/* Valor do mês */}
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", minWidth: 56, textAlign: "right" }}>
                    {fmt(val)}
                  </p>

                  {/* Média do período */}
                  <p style={{ fontSize: 10, color: "var(--text-faint)", minWidth: 54, textAlign: "right" }}
                    title="Média no período">
                    μ {fmt(st.media)}
                  </p>

                  {/* Desvio % vs média (oculto no modo parcial) */}
                  {!focoEmAndamento ? (
                    <span style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: 20, minWidth: 46, textAlign: "center",
                      background: foraSigma ? (desvioPct > 0 ? "rgba(226,75,74,0.15)" : "rgba(29,158,117,0.15)") : "var(--surface2)",
                      color: foraSigma ? (desvioPct > 0 ? "var(--danger)" : "var(--primary)") : "var(--text-faint)",
                      fontWeight: foraSigma ? 600 : 400
                    }} title={foraSigma ? "Acima de 1 desvio padrão" : "Dentro do padrão"}>
                      {desvioPct > 0 ? "+" : ""}{desvioPct.toFixed(0)}%{foraSigma ? " ⚠" : ""}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: overflow ? "var(--danger)" : "var(--text-faint)", minWidth: 46, textAlign: "right" }}>
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              )
            })}
            {cats_desp.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Sem gastos neste mês.</p>
            )}
          </div>
        </div>

        {/* METAS */}
        <Metas
          foco={foco}
          metricas={metricas}
          statsPorCat={statsPorCat}
          periodo={periodo}
          prefill={metaPrefill}
          onPrefillUsado={() => setMetaPrefill(null)}
          onChange={recarregarMetas}
        />
      </div>

      {/* INSIGHTS AUTOMÁTICOS (faixa de largura cheia) */}
      <Insights
        metricas={metricasFull}
        mesFoco={mesFoco}
        metas={metasDash}
        onCriarMeta={onCriarMeta}
        emAndamento={emAndamento}
        eaInfo={eaInfo}
      />

      {/* VIAGENS */}
      {viagens.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Viagens
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {viagens.map(v => {
              // Card escolhido manualmente tem prioridade; senão, automático pelo destino.
              const imgSrc = v.card ? `/viagens/${encodeURIComponent(v.card)}` : getImagemViagem(v.destino)
              return (
                <div key={v.id}
                  onClick={() => onDepurar?.({ viagem: v.destino, titulo: `Viagem: ${v.destino}` })}
                  title="Depurar os gastos desta viagem"
                  style={{
                    position: "relative", borderRadius: 14, overflow: "hidden", height: 180,
                    background: imgSrc ? "var(--surface)" : "var(--primary)", cursor: "pointer"
                  }}>
                  {imgSrc && (
                    <img src={imgSrc} alt={v.destino}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={e => { e.target.style.display = "none" }} />
                  )}

                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)" }} />

                  <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 20, padding: "3px 10px", fontSize: 10, color: "#fff", fontWeight: 500 }}>
                    {v.data_inicio} → {v.data_fim}
                  </div>

                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 14px" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{v.destino}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
                      {v.num_lancamentos} lançamentos
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                      {fmt(v.total)}
                    </p>

                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {Object.entries(v.por_categoria || {}).slice(0, 3).map(([cat, val]) => (
                        <span key={cat} style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 20, padding: "2px 8px", fontSize: 10, color: "#fff" }}>
                          {CATS_NOME[cat] || cat} {fmt(val)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
