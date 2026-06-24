import { useState, useEffect, useMemo } from "react"

const API = "http://127.0.0.1:8000"

const CATS_NOME = {
  CA: "Casa", S: "Saúde", E: "Estudo", A: "Assinatura", T: "Transporte",
  M: "Mercado", C: "Comida", B: "Bens", R: "Roupa", L: "Lazer", O: "Outros"
}
const CATS_COR = {
  CA: "#EF9F27", S: "#D4537E", L: "#1D9E75", C: "#9B59B6", T: "#7F77DD",
  E: "#5DCAA5", M: "#378ADD", B: "#888780", R: "#E24B4A", A: "#F0997B", O: "#5A8A78"
}
const CATS_GASTO = ["CA", "S", "E", "A", "T", "M", "C", "B", "R", "L", "O"]

// Classes de insight (cor, prioridade na ordenação, ícone)
const CLASSES = {
  alerta:      { cor: "var(--danger)",  prio: 1, icone: "⚠" },
  atencao:     { cor: "var(--gold)",    prio: 2, icone: "●" },
  positivo:    { cor: "var(--primary)", prio: 3, icone: "✓" },
  sugestao:    { cor: "#378ADD",        prio: 4, icone: "→" },
  informativo: { cor: "var(--text-muted)", prio: 5, icone: "ℹ" },
}

// Bancos de frases — {cat},{media},{atual},{v1},{v2},{v3} são interpolados.
const FRASES = {
  consec2: [
    "Segundo mês seguido gastando acima da sua média em {cat}. Vale acompanhar.",
    "{cat} acima da média pelo segundo mês consecutivo · média {media} · atual {atual}.",
    "Dois meses no mesmo ritmo em {cat} — ainda sob controle, mas fique de olho.",
    "Seu gasto em {cat} está acima da média por dois meses seguidos. Um padrão a observar.",
  ],
  consec3: [
    "Terceiro mês consecutivo acima da média em {cat}. Já parece uma nova tendência.",
    "{cat} consistentemente acima da média por três meses · média {media} · {atual} agora.",
    "Três meses seguidos em {cat} acima do seu padrão. Pode ser hora de criar uma meta.",
    "Seu padrão em {cat} mudou — três meses consecutivos acima da média histórica.",
  ],
  desvioMed: [
    "{cat} bem acima do seu padrão este mês · média {media} · este mês {atual}.",
    "Gasto em {cat} saiu do ritmo habitual — {atual} contra uma média de {media}.",
    "Este mês em {cat} foi mais pesado que o usual. Pode ser pontual.",
    "{cat} acima do esperado. Não necessariamente um problema, mas vale checar.",
  ],
  desvioAlto: [
    "Gasto incomum em {cat}: {atual} — muito acima da sua média de {media}.",
    "{cat} com o maior desvio do seu histórico recente · {atual} contra média de {media}.",
    "Esse mês em {cat} foge bastante do seu padrão. Vale revisar os lançamentos.",
    "Pico em {cat}: {atual}. Sua média é {media} — o maior desvio dos últimos meses.",
  ],
  tendencia: [
    "{cat} crescendo por três meses seguidos: {v1} → {v2} → {v3}.",
    "Tendência de alta em {cat}: cada mês um pouco mais que o anterior.",
    "Seus gastos em {cat} subiram mês a mês nos últimos três meses.",
    "{cat} em trajetória crescente. Ainda não é um problema, mas é um sinal.",
  ],
  abaixo2: [
    "Segundo mês controlando bem {cat}. Abaixo da sua média por dois meses seguidos.",
    "{cat} em dia — dois meses abaixo da média. Continue assim.",
    "Boa sequência em {cat}: média {media} · {atual} este mês.",
    "Você está gastando menos que o habitual em {cat} pelo segundo mês consecutivo.",
  ],
  abaixo3: [
    "Três meses seguidos abaixo da média em {cat}. Melhor sequência recente.",
    "{cat} bem controlada — três meses consecutivos abaixo do seu padrão.",
    "Sua melhor sequência em {cat}: três meses dentro do limite.",
  ],
  retorno: [
    "Primeiro gasto em {cat} em mais de dois meses: {atual}.",
    "{cat} voltou a aparecer depois de dois meses sem lançamentos.",
    "Gasto em {cat} após dois meses de ausência — {atual}.",
  ],
  superavitRisco: [
    "Suas despesas já superam a receita do mês passado. O mês pode fechar no vermelho.",
    "Ritmo de gastos acima da receita habitual — atenção para o fechamento do mês.",
    "Déficit provável neste mês se o ritmo continuar.",
  ],
  meta: [
    "{cat} está acima do padrão e você ainda não tem uma meta para ela. Quer criar?",
    "Que tal estabelecer um limite para {cat}? Ela está acima da média recentemente.",
    "Criar uma meta de redução para {cat} pode ajudar a retomar o controle.",
  ],
}

function fmt(v) {
  return `R$ ${Math.abs(Math.round(v || 0)).toLocaleString("pt-BR")}`
}
function mediaStd(vals) {
  const n = vals.length
  if (!n) return { n: 0, media: 0, std: 0 }
  const media = vals.reduce((s, v) => s + v, 0) / n
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - media) ** 2, 0) / n)
  return { n, media, std }
}
// Índice determinístico a partir de uma seed string (fixa a frase por cat+tipo+mês).
function seedIdx(seed, n) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return n ? h % n : 0
}
function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`))
}
function frase(tipo, cat, mes, vars) {
  const banco = FRASES[tipo] || []
  if (!banco.length) return ""
  return fill(banco[seedIdx(`${tipo}|${cat}|${mes}`, banco.length)], vars)
}

// ── CÁLCULO DOS INSIGHTS ────────────────────────────────────────────────────
function calcularInsights({ metricas, mesFoco, incluirViagens, viagemSet, metas, emAndamento, eaInfo }) {
  const out = []
  if (!metricas || metricas.length < 2) return out

  let idxObs = mesFoco ? metricas.findIndex(m => m.mes === mesFoco) : -1
  if (idxObs < 0) idxObs = metricas.length - 1
  const mesObs = metricas[idxObs]?.mes
  if (!mesObs) return out

  const temMeta = cat => metas.some(m => (m.tipo === "limite" || m.tipo === "reducao") && m.categoria === cat)
  const catsAlerta = new Set()
  const push = (chave, classe, cat, texto, mag, nota, criarMetaCat = null) =>
    out.push({ chave, classe, cat, texto, mag, nota, criarMetaCat, prio: CLASSES[classe].prio })

  CATS_GASTO.forEach(cat => {
    const serie = metricas.map(m => ({
      mes: m.mes,
      val: Math.abs(m.categorias?.[cat] || 0),
      viagem: viagemSet.has(`${m.mes}|${cat}`),
    }))

    // Média de referência: até 3 meses fechados ANTES do mês observado.
    let pool = serie.slice(0, idxObs)
    let fallback = false
    if (!incluirViagens) {
      const semViagem = pool.filter(p => !p.viagem)
      if (semViagem.length >= 2) pool = semViagem
      else fallback = pool.some(p => p.viagem)   // poucos dados → usa todos, sinaliza
    }
    const ref = pool.slice(-3).map(p => p.val)
    if (ref.length < 2) return
    const { media, std } = mediaStd(ref)
    const obs = serie[idxObs]
    if (media <= 0 && obs.val <= 0) return

    const nota = fallback ? "média inclui meses com viagem por falta de dados suficientes" : null
    const vars = { cat: CATS_NOME[cat] || cat, media: fmt(media), atual: fmt(obs.val) }

    // Consecutividade acima / abaixo (meses fechados até o observado)
    let cAcima = 0, cAbaixo = 0
    for (let i = idxObs; i >= 0; i--) { if (serie[i].val > media) cAcima++; else break }
    for (let i = idxObs; i >= 0; i--) { if (serie[i].val < media) cAbaixo++; else break }

    // G1 — consecutividade acima
    if (cAcima >= 2) {
      const classe = cAcima >= 3 ? "alerta" : "atencao"
      push(`consec_acima|${cat}|${mesObs}`, classe, cat,
        frase(cAcima >= 3 ? "consec3" : "consec2", cat, mesObs, vars), cAcima, nota)
      catsAlerta.add(cat)
    }
    // G2 — desvio alto isolado (sem consecutividade)
    else if (std > 0.01 && obs.val > media + 1.5 * std) {
      const z = (obs.val - media) / std
      const classe = z > 2.5 ? "alerta" : "atencao"
      push(`desvio|${cat}|${mesObs}`, classe, cat,
        frase(z > 2.5 ? "desvioAlto" : "desvioMed", cat, mesObs, vars), z, nota)
      catsAlerta.add(cat)
    }

    // G4 — consecutividade abaixo (positivo)
    if (cAbaixo >= 2) {
      push(`abaixo|${cat}|${mesObs}`, "positivo", cat,
        frase(cAbaixo >= 3 ? "abaixo3" : "abaixo2", cat, mesObs, vars), cAbaixo, nota)
    }

    // G3 — tendência de alta (3 meses crescentes)
    if (idxObs >= 2) {
      const a = serie[idxObs - 2].val, b = serie[idxObs - 1].val, c = obs.val
      if (a > 0 && c > b && b > a) {
        push(`tendencia|${cat}|${mesObs}`, "atencao", cat,
          frase("tendencia", cat, mesObs, { ...vars, v1: fmt(a), v2: fmt(b), v3: fmt(c) }), c - a, nota)
      }
    }

    // G5 — categoria ausente com retorno relevante (> R$50)
    if (idxObs >= 2) {
      const p1 = serie[idxObs - 1].val, p2 = serie[idxObs - 2].val
      if (obs.val > 50 && p1 === 0 && p2 === 0) {
        push(`retorno|${cat}|${mesObs}`, "informativo", cat,
          frase("retorno", cat, mesObs, vars), obs.val, null)
      }
    }
  })

  // G6 — superávit em risco (mês em andamento)
  if (emAndamento && eaInfo) {
    const despCorrente = eaInfo.corrente?.despesas || 0
    const recAnterior = metricas[metricas.length - 1]?.receita || 0
    if (recAnterior > 0 && despCorrente > recAnterior) {
      push(`superavit_risco||${eaInfo.mes}`, "alerta", null,
        frase("superavitRisco", "_", eaInfo.mes, {}), despCorrente - recAnterior, null)
    }
  }

  // G7 — sugestão de meta para categorias em atenção/alerta sem meta
  catsAlerta.forEach(cat => {
    if (!temMeta(cat)) {
      push(`sugestao_meta|${cat}|${mesObs}`, "sugestao", cat,
        frase("meta", cat, mesObs, { cat: CATS_NOME[cat] || cat }), 1, null, cat)
    }
  })

  // Ordenação: prioridade da classe → magnitude → categoria (alfabética)
  out.sort((x, y) =>
    x.prio - y.prio ||
    (y.mag || 0) - (x.mag || 0) ||
    (CATS_NOME[x.cat] || "").localeCompare(CATS_NOME[y.cat] || "")
  )
  return out
}

// ── PERSISTÊNCIA DOS IGNORADOS (backend por perfil) ─────────────────────────
// Isolado para troca trivial; hoje usa o backend (X-Usuario injetado no fetch).
async function getIgnorados() {
  try {
    const r = await fetch(`${API}/insights/ignorados`)
    const d = await r.json()
    return new Set(d.chaves || [])
  } catch { return new Set() }
}
async function setIgnorado(chave) {
  try {
    await fetch(`${API}/insights/ignorar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave })
    })
  } catch (e) { console.error(e) }
}

const LS_VIAGENS = "granae_insights_incluir_viagens"

// ── COMPONENTE ──────────────────────────────────────────────────────────────
export default function Insights({ metricas = [], mesFoco, metas = [], onCriarMeta, emAndamento = false, eaInfo = null }) {
  const [incluirViagens, setIncluirViagens] = useState(() => {
    try { return localStorage.getItem(LS_VIAGENS) === "1" } catch { return false }
  })
  const [ignorados, setIgnorados] = useState(() => new Set())
  const [lancs, setLancs] = useState([])
  const [expandido, setExpandido] = useState(false)

  useEffect(() => { getIgnorados().then(setIgnorados) }, [])
  useEffect(() => {
    fetch(`${API}/lancamentos`).then(r => r.json())
      .then(d => setLancs(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  function toggleViagens() {
    setIncluirViagens(v => {
      const nv = !v
      try { localStorage.setItem(LS_VIAGENS, nv ? "1" : "0") } catch {}
      return nv
    })
  }

  // (mes|categoria) que contêm lançamento com tag de viagem
  const viagemSet = useMemo(() => {
    const s = new Set()
    for (const l of lancs) {
      if (l.viagem && l.mes && l.categoria) s.add(`${l.mes}|${l.categoria}`)
    }
    return s
  }, [lancs])

  const insights = useMemo(
    () => calcularInsights({ metricas, mesFoco, incluirViagens, viagemSet, metas, emAndamento, eaInfo }),
    [metricas, mesFoco, incluirViagens, viagemSet, metas, emAndamento, eaInfo]
  )

  const visiveisTodos = insights.filter(i => !ignorados.has(i.chave))
  const visiveis = expandido ? visiveisTodos : visiveisTodos.slice(0, 4)
  const ocultos = visiveisTodos.length - visiveis.length

  async function ignorar(chave) {
    setIgnorados(prev => new Set(prev).add(chave))   // some na hora
    await setIgnorado(chave)
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem 1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Insights
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
          title="Por padrão, meses com gastos de viagem são excluídos da média de cada categoria">
          <input type="checkbox" checked={incluirViagens} onChange={toggleViagens} style={{ accentColor: "var(--primary)", cursor: "pointer" }} />
          incluir viagens na média
        </label>
      </div>
      <p style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 12 }}>
        Padrões detectados nos seus últimos meses fechados
      </p>

      {visiveisTodos.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
          Nada fora do padrão por aqui. Seus gastos estão dentro do esperado.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visiveis.map(ins => {
            const cl = CLASSES[ins.classe]
            const corCat = ins.cat ? (CATS_COR[ins.cat] || "#888") : cl.cor
            return (
              <div key={ins.chave} style={{
                position: "relative", display: "flex", gap: 10, alignItems: "flex-start",
                padding: "10px 34px 10px 12px", borderRadius: 10,
                background: "var(--surface2)", borderLeft: `3px solid ${cl.cor}`
              }}>
                <span style={{ fontSize: 14, color: cl.cor, lineHeight: 1.3, flexShrink: 0 }}>{cl.icone}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    {ins.cat && <span style={{ width: 7, height: 7, borderRadius: 2, background: corCat, flexShrink: 0 }} />}
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: cl.cor }}>
                      {ins.cat ? (CATS_NOME[ins.cat] || ins.cat) : "Fechamento do mês"}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.4 }}>{ins.texto}</p>
                  {ins.nota && <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3, fontStyle: "italic" }}>{ins.nota}</p>}
                  {ins.criarMetaCat && onCriarMeta && (
                    <button onClick={() => onCriarMeta(ins.criarMetaCat)} style={{
                      marginTop: 6, fontSize: 11, fontWeight: 500, cursor: "pointer", padding: "3px 10px",
                      background: "none", border: `1px solid ${cl.cor}`, borderRadius: 8, color: cl.cor
                    }}>
                      Criar meta →
                    </button>
                  )}
                </div>
                <button onClick={() => ignorar(ins.chave)} title="Ignorar até o fim do mês"
                  style={{
                    position: "absolute", top: 8, right: 8, background: "none", border: "none",
                    cursor: "pointer", color: "var(--text-faint)", fontSize: 13, lineHeight: 1, padding: 2
                  }}>✕</button>
              </div>
            )
          })}

          {(ocultos > 0 || expandido) && visiveisTodos.length > 4 && (
            <button onClick={() => setExpandido(e => !e)} style={{
              marginTop: 2, fontSize: 11, cursor: "pointer", background: "none",
              border: "none", color: "var(--primary)", padding: 0, alignSelf: "flex-start"
            }}>
              {expandido ? "ver menos" : `ver mais ${ocultos}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
