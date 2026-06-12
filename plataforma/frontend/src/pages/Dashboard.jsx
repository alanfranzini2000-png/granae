import { useState, useEffect, useRef } from "react"

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
  { key: "receita",  label: "Receita",  cor: "#1D9E75", dash: [] },
  { key: "despesas", label: "Despesas", cor: "#E24B4A", dash: [5, 2] },
  { key: "superavit",label: "Superávit",cor: "#378ADD", dash: [3, 3] },
]

const CATS_GRAFICO = ["CA","S","L","C","T","M","E","A","B","R","O"]
const PERIODOS = ["6m","12m","18m","24m","YTD","Max"]

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
  return `R$\u00a0${Math.abs(v || 0).toLocaleString("pt-BR", {
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

export default function Dashboard() {
  const [dados, setDados] = useState(null)
  const [viagens, setViagens] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState("6m")
  const [seriesSelecionadas, setSeriesSelecionadas] = useState(["receita", "despesas", "superavit"])

  const [ggSuperavit] = useState(() => sortearGG("ostentando"))
  const [ggDeficit]   = useState(() => sortearGG("surpreso"))
  const [ggVazio]     = useState(() => sortearGG("surpreso"))

  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    if (window.Chart) return

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
  }, [periodo])

  useEffect(() => {
    if (dados) renderChart()
  }, [dados, seriesSelecionadas])

  function mesesDoPeriodo() {
    if (periodo === "Max") return 999
    if (periodo === "YTD") return null
    return parseInt(periodo)
  }

  async function carregar() {
    setLoading(true)
    try {
      const meses = mesesDoPeriodo()
      const url = meses ? `${API}/dashboard?meses=${meses}` : `${API}/dashboard?ytd=true`

      const [d, v] = await Promise.all([
        fetch(url).then(r => r.json()),
        fetch(`${API}/viagens`).then(r => r.json())
      ])

      setDados(d)
      setViagens(v || [])
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

  function renderChart() {
    if (!chartRef.current || !dados?.metricas_mensais?.length || !window.Chart) return

    if (chartInstance.current) {
      chartInstance.current.destroy()
      chartInstance.current = null
    }

    const metricas = filtrarMesesFuturos(dados.metricas_mensais)
    if (!metricas.length) return

    const isDark = matchMedia("(prefers-color-scheme: dark)").matches
    const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"
    const tickColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)"

    const datasets = []

    SERIES_BASE.filter(s => seriesSelecionadas.includes(s.key)).forEach(s => {
      datasets.push({
        label: s.label,
        data: metricas.map(m => {
          if (s.key === "superavit") return Math.round((m.receita || 0) - (m.despesas || 0))
          return Math.round(m[s.key] || 0)
        }),
        borderColor: s.cor,
        borderWidth: 2,
        borderDash: s.dash,
        pointRadius: 3,
        pointBackgroundColor: s.cor,
        tension: 0.3,
        fill: false,
      })
    })

    CATS_GRAFICO.filter(c => seriesSelecionadas.includes(c)).forEach(cat => {
      datasets.push({
        label: CATS_NOME[cat] || cat,
        data: metricas.map(m => Math.round(Math.abs(m.categorias?.[cat] || 0))),
        borderColor: CATS_COR[cat] || "#888",
        borderWidth: 1.5,
        borderDash: [4, 2],
        pointRadius: 2,
        pointBackgroundColor: CATS_COR[cat] || "#888",
        tension: 0.3,
        fill: false,
      })
    })

    chartInstance.current = new window.Chart(chartRef.current, {
      type: "line",
      data: {
        labels: metricas.map(m => m.mes),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 10 },
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 10 },
              callback: v => "R$" + (v / 1000).toFixed(0) + "k"
            }
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

  if (!dados?.metricas_mensais?.length) return (
    <div style={{
      textAlign: "center",
      padding: "4rem",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16
    }}>
      <img src={ggVazio} style={{ height: 160 }} onError={e => e.target.style.display = "none"} />
      <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text)" }}>Sem dados ainda</p>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Vá para Upload e envie seus extratos.</p>
    </div>
  )

  const metricas = filtrarMesesFuturos(dados.metricas_mensais)
  if (!metricas.length) return null

  const ultimo = metricas[metricas.length - 1]
  const penult = metricas.length > 1 ? metricas[metricas.length - 2] : null
  const indice = dados.indice_saude
  const corIdx = indice >= 70 ? "#1D9E75" : indice >= 40 ? "#BA7517" : "#C0392B"
  const superavit = Math.round((ultimo.receita || 0) - (ultimo.despesas || 0))

  const cats_desp = Object.entries(ultimo.categorias || {})
    .filter(([k, v]) => !["SA", "I", "F"].includes(k) && v < 0)
    .map(([k, v]) => ({ cat: k, val: Math.abs(v) }))
    .sort((a, b) => b.val - a.val)

  const total_desp = cats_desp.reduce((s, c) => s + c.val, 0)

  const cats_media = ["CA","S","L","T","M","C","E","A","B","R"]
  const medias = cats_media.map(cat => {
    const vals = metricas.map(m => Math.abs(m.categorias?.[cat] || 0))
    const media = vals.reduce((s, v) => s + v, 0) / vals.length
    const ultimo_val = Math.abs(ultimo.categorias?.[cat] || 0)
    const diff = media > 0 ? ((ultimo_val - media) / media * 100) : 0

    return { cat, media, ultimo_val, diff }
  }).filter(x => x.media > 0).sort((a, b) => b.media - a.media)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ÍNDICE */}
      <div style={{
        background: corIdx,
        borderRadius: 14,
        padding: "1.25rem 1.5rem",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.65)",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8
            }}>
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
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>{ultimo.mes}</p>
              <div style={{ width: 100, height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3 }}>
                <div style={{ width: `${indice}%`, height: "100%", background: "#fff", borderRadius: 3 }} />
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                Invest. no mês: {fmt(ultimo.investimentos)}
              </p>
            </div>

            <img
              src={superavit >= 0 ? ggSuperavit : ggDeficit}
              style={{ height: 90, objectFit: "contain" }}
              onError={e => e.target.style.display = "none"}
            />
          </div>
        </div>
      </div>

      {/* CARDS MÊS */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}>
            {ultimo.mes} — último mês completo
          </p>

          <div style={{ display: "flex", gap: 4 }}>
            {PERIODOS.map(p => (
              <button key={p} onClick={() => setPeriodo(p)} style={{
                padding: "3px 10px",
                fontSize: 11,
                cursor: "pointer",
                background: periodo === p ? "var(--primary)" : "var(--surface)",
                border: `1px solid ${periodo === p ? "var(--primary)" : "var(--border-mid)"}`,
                borderRadius: 8,
                color: periodo === p ? "#fff" : "var(--text-muted)",
                fontWeight: periodo === p ? 500 : 400
              }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            ["Receita", ultimo.receita, penult?.receita, "var(--primary)"],
            ["Despesas", ultimo.despesas, penult?.despesas, "var(--text)"],
            [superavit >= 0 ? "Superávit" : "Déficit", Math.abs(superavit), null, superavit >= 0 ? "var(--primary)" : "var(--danger)"],
            ["Investimentos", ultimo.investimentos, null, "var(--gold)"],
          ].map(([l, v, prev, cor]) => (
            <div key={l} style={{ background: "var(--surface)", borderRadius: 10, padding: "14px" }}>
              <p style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontWeight: 500
              }}>
                {l}
              </p>
              <p style={{ fontSize: 22, fontWeight: 600, color: cor, marginBottom: 6 }}>{fmt(v)}</p>
              {prev != null && (
                <span style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: "var(--surface2)",
                  color: "var(--text-muted)"
                }}>
                  {v >= (prev || 0) ? "▲" : "▼"} vs {penult?.mes}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* GRÁFICO COM FILTROS, SÉRIES E CATEGORIAS */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "1rem 1.25rem"
      }}>
        <p style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 12
        }}>
          Evolução histórica
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {SERIES_BASE.map(s => {
            const ativo = seriesSelecionadas.includes(s.key)

            return (
              <button key={s.key} onClick={() => toggleSerie(s.key)} style={{
                padding: "3px 10px",
                fontSize: 11,
                cursor: "pointer",
                background: ativo ? s.cor : "var(--surface2)",
                border: `1px solid ${ativo ? s.cor : "var(--border-mid)"}`,
                borderRadius: 8,
                color: ativo ? "#fff" : "var(--text-muted)",
                fontWeight: ativo ? 500 : 400,
                transition: "all 0.15s"
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
                padding: "3px 10px",
                fontSize: 11,
                cursor: "pointer",
                background: ativo ? cor : "var(--surface2)",
                border: `1px solid ${ativo ? cor : "var(--border-mid)"}`,
                borderRadius: 8,
                color: ativo ? "#fff" : "var(--text-muted)",
                fontWeight: ativo ? 500 : 400,
                transition: "all 0.15s"
              }}>
                {CATS_NOME[cat] || cat}
              </button>
            )
          })}
        </div>

        <div style={{ position: "relative", width: "100%", height: 190 }}>
          <canvas
            ref={chartRef}
            role="img"
            aria-label="Gráfico de evolução histórica por série selecionada"
          >
            Gráfico de evolução financeira mensal.
          </canvas>
        </div>
      </div>

      {/* COMPOSIÇÃO + MÉDIAS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1rem 1.25rem"
        }}>
          <p style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 12
          }}>
            Composição — {ultimo.mes}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cats_desp.slice(0, 8).map(({ cat, val }) => {
              const pct = total_desp > 0 ? (val / total_desp * 100) : 0

              return (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: CATS_COR[cat] || "#888",
                    flexShrink: 0
                  }} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)", width: 76 }}>{CATS_NOME[cat] || cat}</p>
                  <div style={{ flex: 1, height: 6, background: "var(--surface2)", borderRadius: 3 }}>
                    <div style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: CATS_COR[cat] || "#888",
                      borderRadius: 3
                    }} />
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 28, textAlign: "right" }}>
                    {pct.toFixed(0)}%
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text)", minWidth: 68, textAlign: "right" }}>
                    {fmt(val)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1rem 1.25rem"
        }}>
          <p style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 12
          }}>
            Média por categoria ({periodo})
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {medias.map(({ cat, media, diff }) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: CATS_COR[cat] || "#888",
                  flexShrink: 0
                }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", width: 76 }}>{CATS_NOME[cat] || cat}</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", flex: 1 }}>{fmt(media)}</p>
                {Math.abs(diff) > 5 && (
                  <span style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: diff > 15 ? "rgba(226,75,74,0.15)" : diff < -15 ? "rgba(29,158,117,0.15)" : "var(--surface2)",
                    color: diff > 15 ? "var(--danger)" : diff < -15 ? "var(--primary)" : "var(--text-muted)"
                  }}>
                    {diff > 0 ? "▲" : "▼"}{Math.abs(diff).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* VIAGENS */}
      {viagens.length > 0 && (
        <div>
          <p style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 12
          }}>
            Viagens
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {viagens.map(v => {
              const imgSrc = getImagemViagem(v.destino)

              return (
                <div key={v.id} style={{
                  position: "relative",
                  borderRadius: 14,
                  overflow: "hidden",
                  height: 180,
                  background: imgSrc ? "var(--surface)" : "var(--primary)"
                }}>
                  {imgSrc && (
                    <img
                      src={imgSrc}
                      alt={v.destino}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={e => { e.target.style.display = "none" }}
                    />
                  )}

                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)"
                  }} />

                  <div style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "rgba(255,255,255,0.18)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontSize: 10,
                    color: "#fff",
                    fontWeight: 500
                  }}>
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
                        <span key={cat} style={{
                          background: "rgba(255,255,255,0.18)",
                          border: "1px solid rgba(255,255,255,0.28)",
                          borderRadius: 20,
                          padding: "2px 8px",
                          fontSize: 10,
                          color: "#fff"
                        }}>
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

    </div>
  )
}
