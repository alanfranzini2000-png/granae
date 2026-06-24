import { useState, useEffect, useRef } from "react"
import { comUsuario } from "../usuario"

const API = "http://127.0.0.1:8000"

const CATS_NOME = {
  SA:"Salário", I:"Investimento", F:"Fatura", CA:"Casa", S:"Saúde",
  E:"Estudo", A:"Assinatura", T:"Transporte", M:"Mercado", C:"Comida",
  B:"Bens", R:"Roupa", L:"Lazer", O:"Outros"
}

const CATS_COR = {
  CA:"#EF9F27", S:"#D4537E", L:"#1D9E75", C:"#9B59B6", T:"#7F77DD",
  E:"#5DCAA5", M:"#378ADD", B:"#888780", R:"#E24B4A", A:"#F0997B",
  O:"#5A8A78", SA:"#27AE60", I:"#EF9F27", F:"#aaaaaa"
}

const CONF_STYLE = {
  verde:    { bg:"rgba(29,158,117,0.18)",  text:"#5DCAA5", border:"rgba(29,158,117,0.45)" },
  amarelo:  { bg:"rgba(239,159,39,0.18)",  text:"#EFB85F", border:"rgba(239,159,39,0.45)" },
  vermelho: { bg:"rgba(226,75,74,0.18)",   text:"#F08A89", border:"rgba(226,75,74,0.45)" },
}

function pct(n, d, decimals = 0) {
  if (!d) return "—"
  return `${((n / d) * 100).toFixed(decimals)}%`
}

function Badge({ cor, label }) {
  const s = CONF_STYLE[cor] || { bg:"rgba(255,255,255,0.08)", text:"var(--text-muted)", border:"var(--border)" }
  return (
    <span style={{
      background: s.bg, color: s.text,
      border: `1px solid ${s.border || "transparent"}`,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600
    }}>{label || cor}</span>
  )
}

function Card({ label, value, sub, color, desc }) {
  return (
    <div style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--radius-lg)", padding:"1rem 1.25rem",
      display:"flex", flexDirection:"column"
    }}>
      <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, marginTop:4, color: color || "var(--text)" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{sub}</div>}
      {desc && (
        <div style={{
          fontSize:11, color:"var(--text-muted)", marginTop:8,
          paddingTop:8, borderTop:"1px solid var(--border)", lineHeight:1.5
        }}>{desc}</div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--radius-lg)", padding:"1.25rem 1.5rem"
    }}>
      <h3 style={{
        margin:"0 0 1rem", fontSize:11, fontWeight:600,
        color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1
      }}>{title}</h3>
      {children}
    </div>
  )
}

function MiniBar({ value }) {
  const p = Math.round(value * 100)
  const color = p >= 80 ? "#1D9E75" : p >= 50 ? "#EF9F27" : "#E24B4A"
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center" }}>
      <div style={{ width:56, height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${p}%`, height:"100%", background:color, borderRadius:3 }} />
      </div>
      <span style={{ fontSize:12, fontWeight:600, minWidth:34, textAlign:"right" }}>{p}%</span>
    </div>
  )
}

function ProgressBar({ done, total }) {
  const p = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ width:"100%" }}>
      <div style={{
        height: 8, background:"var(--border)", borderRadius: 4, overflow:"hidden", marginBottom: 6
      }}>
        <div style={{
          width:`${p}%`, height:"100%",
          background:"var(--primary)", borderRadius: 4,
          transition:"width 0.2s ease"
        }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--text-muted)" }}>
        <span>{done} de {total} processados</span>
        <span>{p}%</span>
      </div>
    </div>
  )
}

// Fases: idle | preview | confirmando | rodando | done
export default function Avaliacao() {
  const [fase, setFase]           = useState("idle")
  const [usarIA, setUsarIA]       = useState(false)
  const [limiteIA, setLimiteIA]   = useState("")
  const [seed, setSeed]           = useState(() => Math.floor(Math.random() * 1e9))
  const [previa, setPrevia]       = useState(null)
  const [progresso, setProgresso] = useState({ done: 0, total: 0 })
  const [resultado, setResultado] = useState(null)
  const [erro, setErro]           = useState(null)
  const [showErros, setShowErros] = useState(false)
  const esRef = useRef(null)

  // Busca prévia sempre que usarIA/seed mudar e estiver em idle/preview
  useEffect(() => {
    if (fase !== "idle" && fase !== "preview") return
    setPrevia(null)
    const params = limiteIA ? `?limite_ia=${limiteIA}&seed=${seed}` : ""
    fetch(`${API}/avaliar/previa${params}`)
      .then(r => r.json())
      .then(setPrevia)
      .catch(() => {})
  }, [usarIA, fase === "idle", seed])

  function iniciarPrevia() {
    // Novo seed → nova amostra aleatória de observações a cada avaliação
    setSeed(Math.floor(Math.random() * 1e9))
    setFase("preview")
    setErro(null)
    setResultado(null)
  }

  function cancelar() {
    setFase("idle")
    setErro(null)
  }

  function confirmarERodar() {
    setFase("rodando")
    setProgresso({ done: 0, total: previa?.total || 0 })
    setErro(null)

    const limiteParam = usarIA && limiteIA ? `&limite_ia=${limiteIA}&seed=${seed}` : ""
    const es = new EventSource(comUsuario(`${API}/avaliar?usar_ia=${usarIA}${limiteParam}`))
    esRef.current = es

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === "progress") {
        setProgresso({ done: data.done, total: data.total })
      } else if (data.type === "result") {
        setResultado(data)
        setFase("done")
        es.close()
      }
    }

    es.onerror = () => {
      setErro("Erro na conexão com o servidor.")
      setFase("idle")
      es.close()
    }
  }

  // Cleanup ao desmontar
  useEffect(() => () => esRef.current?.close(), [])

  const r = resultado

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

      {/* Cabeçalho + controles */}
      <div style={{
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--radius-lg)", padding:"1.25rem 1.5rem",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"1rem"
      }}>
        <div>
          <h2 style={{ margin:0, fontSize:16, fontWeight:600 }}>Avaliação do Modelo</h2>
          <p style={{ margin:"4px 0 0", fontSize:12, color:"var(--text-muted)" }}>
            Reclassifica cada lançamento sem pedir ajuda e compara com a categoria atual (ground truth)
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"1.25rem" }}>
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer", userSelect:"none" }}>
            <input
              type="checkbox"
              checked={usarIA}
              disabled={fase === "rodando"}
              onChange={e => setUsarIA(e.target.checked)}
              style={{ accentColor:"var(--primary)" }}
            />
            Usar IA
            {usarIA && (
              <span style={{ fontSize:11, color:"#e67e22" }}>(lento + custo de API)</span>
            )}
          </label>
          {usarIA && (
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
              <span style={{ color:"var(--text-muted)", whiteSpace:"nowrap" }}>Limite IA:</span>
              <input
                type="number"
                min={1}
                placeholder="ilimitado"
                value={limiteIA}
                disabled={fase === "rodando"}
                onChange={e => setLimiteIA(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width:90, padding:"4px 8px", fontSize:13,
                  border:"1px solid var(--border)", borderRadius:"var(--radius-md)",
                  background:"var(--bg)", color:"var(--text)"
                }}
              />
            </label>
          )}
          {fase === "idle" && (
            <button
              onClick={iniciarPrevia}
              style={{
                padding:"7px 20px", background:"var(--primary)", color:"#fff",
                border:"none", borderRadius:"var(--radius-md)", fontSize:13,
                cursor:"pointer", fontWeight:500
              }}
            >
              Rodar Avaliação
            </button>
          )}
          {(fase === "preview" || fase === "confirmando") && (
            <button
              onClick={cancelar}
              style={{
                padding:"7px 16px", background:"none", color:"var(--text-muted)",
                border:"1px solid var(--border)", borderRadius:"var(--radius-md)", fontSize:13,
                cursor:"pointer"
              }}
            >
              Cancelar
            </button>
          )}
          {fase === "done" && (
            <button
              onClick={() => { setFase("idle"); setResultado(null) }}
              style={{
                padding:"7px 16px", background:"none", color:"var(--primary)",
                border:"1px solid var(--primary)", borderRadius:"var(--radius-md)", fontSize:13,
                cursor:"pointer"
              }}
            >
              Nova Avaliação
            </button>
          )}
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div style={{
          background:"#f8d7da", color:"#721c24",
          borderRadius:"var(--radius-md)", padding:"12px 16px", fontSize:13
        }}>
          Erro: {erro}
        </div>
      )}

      {/* Painel de prévia + confirmação */}
      {fase === "preview" && previa && (
        <div style={{
          background:"var(--surface)", border:"2px solid var(--primary)",
          borderRadius:"var(--radius-lg)", padding:"1.5rem",
          display:"flex", flexDirection:"column", gap:"1rem"
        }}>
          <div style={{ fontSize:14, fontWeight:600 }}>Confirmar avaliação</div>

          <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:700 }}>{previa.total}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase" }}>
                lançamentos
                {previa.total_geral > previa.total && (
                  <span style={{ color:"#999" }}> de {previa.total_geral}</span>
                )}
              </div>
            </div>
            {usarIA && (
              <>
                <div style={{ alignSelf:"center", color:"var(--text-muted)", fontSize:18 }}>→</div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:28, fontWeight:700, color:"#e67e22" }}>{previa.vai_ia_efetivo}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase" }}>
                    vão chamar a IA
                    {previa.vai_ia_efetivo < previa.vai_ia && (
                      <span style={{ color:"#999" }}> (de {previa.vai_ia})</span>
                    )}
                  </div>
                </div>
                <div style={{ alignSelf:"center", color:"var(--text-muted)", fontSize:18 }}>+</div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:28, fontWeight:700, color:"#1D9E75" }}>{previa.total - previa.vai_ia_efetivo}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase" }}>por regra fixa</div>
                </div>
              </>
            )}
            {!usarIA && (
              <>
                <div style={{ alignSelf:"center", color:"var(--text-muted)", fontSize:18 }}>→</div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:28, fontWeight:700, color:"#1D9E75" }}>{previa.total}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase" }}>apenas regras fixas</div>
                </div>
              </>
            )}
          </div>

          {usarIA && previa.vai_ia_efetivo > 0 && (
            <div style={{
              background:"#fff8f0", border:"1px solid #f0c97b",
              borderRadius:"var(--radius-md)", padding:"10px 14px", fontSize:12, color:"#7a5c00"
            }}>
              {previa.ia_disponivel
                ? `⚠ A IA será chamada ${previa.vai_ia_efetivo} vezes. Estimativa: ~${Math.round(previa.vai_ia_efetivo * 2 / 60)} a ${Math.round(previa.vai_ia_efetivo * 3 / 60) + 1} min e custo de ~US$ ${(previa.vai_ia_efetivo * 0.00001).toFixed(4)}.`
                : "⚠ ANTHROPIC_API_KEY não configurada — a IA não será usada mesmo com a opção marcada."}
            </div>
          )}

          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button
              onClick={confirmarERodar}
              style={{
                padding:"8px 24px", background:"var(--primary)", color:"#fff",
                border:"none", borderRadius:"var(--radius-md)", fontSize:13,
                cursor:"pointer", fontWeight:600
              }}
            >
              Confirmar e Rodar
            </button>
            <button
              onClick={cancelar}
              style={{
                padding:"8px 16px", background:"none", color:"var(--text-muted)",
                border:"1px solid var(--border)", borderRadius:"var(--radius-md)", fontSize:13,
                cursor:"pointer"
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Contador ao vivo */}
      {fase === "rodando" && (
        <div style={{
          background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--radius-lg)", padding:"1.5rem",
          display:"flex", flexDirection:"column", gap:"1rem"
        }}>
          <div style={{ fontSize:13, fontWeight:500 }}>
            {usarIA ? "Rodando avaliação com IA…" : "Aplicando regras…"}
          </div>
          <ProgressBar done={progresso.done} total={progresso.total} />
          <div style={{ fontSize:11, color:"var(--text-muted)" }}>
            {progresso.total > 0 && progresso.done < progresso.total
              ? usarIA
                ? "Cada chamada à IA leva ~1–3 s. Aguarde…"
                : "Processando regras fixas…"
              : "Calculando métricas…"}
          </div>
        </div>
      )}

      {/* Resultados */}
      {r && fase === "done" && (<>

        {/* Cards de resumo */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem" }}>
          <Card
            label="Avaliados"
            value={r.total}
            sub={r.usar_ia ? "regras + IA" : "apenas regras"}
            desc="Total de lançamentos do banco usados como referência (ground truth)."
          />
          <Card
            label="Acurácia geral"
            value={pct(r.corretos, r.total, 1)}
            sub={`${r.corretos} de ${r.total} corretos`}
            color="var(--primary)"
            desc="De todos os lançamentos, quantos o modelo acertou. Casos sem resposta contam como erro."
          />
          <Card
            label="Acurácia (excl. ajuda)"
            value={pct(r.corretos, r.preditos, 1)}
            sub={`${r.preditos} predições feitas`}
            color="#1D9E75"
            desc="Dos casos em que o modelo arriscou uma categoria, quantos ele acertou — mede a qualidade das respostas dadas."
          />
          <Card
            label="Precisariam de ajuda"
            value={r.precisa_ajuda}
            sub={pct(r.precisa_ajuda, r.total, 1)}
            color="#E24B4A"
            desc="Lançamentos em que o modelo não teve confiança suficiente e pediria revisão manual ao usuário."
          />
        </div>

        {/* Distribuição + Acurácia por Fonte */}
        {(() => {
          const reg   = r.por_fonte['regra']   || { total:0, correto:0 }
          const ia    = r.por_fonte['ia']       || { total:0, correto:0 }
          const pix   = r.por_fonte['pix']      || { total:0, correto:0 }
          const ajuda = r.por_fonte['sem_pred'] || { total:0, correto:0 }

          const segmentos = [
            { key:'regra',    label:'Regra fixa', color:'#378ADD', d:reg },
            { key:'ia',       label:'IA',         color:'#9B59B6', d:ia },
            { key:'pix',      label:'PIX',        color:'#EF9F27', d:pix },
            { key:'sem_pred', label:'Sem resposta', color:'#E24B4A', d:ajuda },
          ].filter(s => s.d.total > 0 || (s.key === 'ia' && r.usar_ia))

          const fontes = [
            { key:'regra', label:'Regra fixa',    d:reg,   color:'#378ADD', sempre:false,
              desc:'Classificados por palavra-chave — sem IA.' },
            { key:'ia',    label:'IA (Claude)',    d:ia,    color:'#9B59B6', sempre:r.usar_ia,
              desc:'Sem regra fixa — passou pelo Claude.' },
            { key:'pix',   label:'PIX heurística',d:pix,   color:'#EF9F27', sempre:false,
              desc:'PIX sem regra — assumido como Lazer por valor.' },
            { key:'sem_pred', label:'Sem resposta', d:ajuda, color:'#E24B4A', sempre:false,
              desc:'Confiança insuficiente — precisaria de revisão manual.' },
          ].filter(f => f.d.total > 0 || f.sempre)

          return (
            <Section title="Distribuição e Acurácia por Fonte">
              {/* Barra de distribuição */}
              <div style={{ marginBottom:"1.25rem" }}>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:6 }}>
                  Como os {r.total} lançamentos foram classificados
                </div>
                <div style={{ display:"flex", height:20, borderRadius:4, overflow:"hidden", gap:1 }}>
                  {segmentos.map(s => {
                    const w = r.total > 0 ? (s.d.total / r.total) * 100 : 0
                    if (w === 0) return null
                    return (
                      <div key={s.key} title={`${s.label}: ${s.d.total}`}
                        style={{ width:`${w}%`, background:s.color, minWidth:2 }} />
                    )
                  })}
                </div>
                <div style={{ display:"flex", gap:"1rem", marginTop:6, flexWrap:"wrap" }}>
                  {segmentos.map(s => (
                    <div key={s.key} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }} />
                      <span style={{ color:"var(--text-muted)" }}>{s.label}</span>
                      <span style={{ fontWeight:600 }}>{s.d.total}</span>
                      <span style={{ color:"var(--text-muted)" }}>({pct(s.d.total, r.total, 0)})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cards de acurácia por fonte */}
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${fontes.length},1fr)`, gap:"0.75rem" }}>
                {fontes.map(({ key, label, d, color, desc }) => (
                  <div key={key} style={{
                    background:"var(--bg)", border:`2px solid ${d.total > 0 ? color : 'var(--border)'}`,
                    borderRadius:"var(--radius-md)", padding:"0.875rem 1rem",
                    opacity: d.total === 0 ? 0.5 : 1
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }} />
                      <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0.5, fontWeight:600 }}>{label}</div>
                    </div>
                    <div style={{ fontSize:28, fontWeight:700, color: d.total > 0 ? color : "var(--text-muted)" }}>
                      {d.total > 0 ? pct(d.correto, d.total, 1) : "—"}
                    </div>
                    <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>
                      {d.total > 0 ? `${d.correto}/${d.total} corretos` : "nenhum neste lote"}
                    </div>
                    <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:8, lineHeight:1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </Section>
          )
        })()}

        {/* Por Confiança */}
        <Section title="Por Nível de Confiança">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem" }}>
            {[
              { conf:"verde",    desc:"Regra fixa disparou — o modelo tem certeza. Alta acurácia esperada." },
              { conf:"amarelo",  desc:"IA com confiança média, ou PIX pequeno assumido como Lazer. Acurácia intermediária." },
              { conf:"vermelho", desc:"Sem categoria confiável — todos são pedidos de ajuda. % mostra quantos o modelo teria acertado se tivesse chutado." },
            ].map(({ conf, desc }) => {
              const d = r.por_confianca[conf] || { total:0, correto:0 }
              return (
                <div key={conf} style={{
                  background:"var(--bg)", border:"1px solid var(--border)",
                  borderRadius:"var(--radius-md)", padding:"1rem", textAlign:"center"
                }}>
                  <Badge cor={conf} />
                  <div style={{ marginTop:10, fontSize:24, fontWeight:700 }}>
                    {pct(d.correto, d.total, 1)}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
                    {d.correto}/{d.total} corretos
                  </div>
                  <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:8, lineHeight:1.5, textAlign:"left" }}>
                    {desc}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Por Fonte + Top Confusões */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>

          <Section title="Por Fonte de Classificação">
            <p style={{ margin:"0 0 10px", fontSize:11, color:"var(--text-muted)" }}>
              Como cada lançamento foi classificado: por <strong>regra</strong> fixa (palavra-chave), por <strong>ia</strong> (Claude), ou <strong>sem_pred</strong> (sem resposta — precisaria de ajuda).
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"0.75rem" }}>
              {Object.entries(r.por_fonte).map(([fonte, d]) => (
                <div key={fonte} style={{
                  background:"var(--bg)", border:"1px solid var(--border)",
                  borderRadius:"var(--radius-md)", padding:"0.75rem 1.25rem",
                  flex:"1 1 100px", textAlign:"center"
                }}>
                  <div style={{ fontSize:10, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1 }}>{fonte}</div>
                  <div style={{ fontSize:20, fontWeight:700, marginTop:4 }}>{pct(d.correto, d.total, 1)}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{d.total} pred.</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Principais Confusões">
            <p style={{ margin:"0 0 10px", fontSize:11, color:"var(--text-muted)" }}>
              Pares onde o modelo errou com mais frequência — mostra quais categorias o modelo confunde entre si.
            </p>
            {r.top_confusoes.length === 0
              ? <p style={{ fontSize:12, color:"var(--text-muted)", margin:0 }}>Nenhum erro de classificação.</p>
              : (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {r.top_confusoes.map(({ par, count }) => {
                    const [real, pred] = par.split("→")
                    return (
                      <div key={par} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                        <span style={{ color: CATS_COR[real], fontWeight:600, minWidth:72 }}>
                          {CATS_NOME[real] || real}
                        </span>
                        <span style={{ color:"var(--text-muted)" }}>→</span>
                        <span style={{ color: CATS_COR[pred], fontWeight:600, minWidth:72 }}>
                          {CATS_NOME[pred] || pred}
                        </span>
                        <div style={{
                          marginLeft:"auto", background:"var(--border)",
                          borderRadius:10, padding:"1px 8px", fontSize:11, fontWeight:600
                        }}>{count}×</div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            {/* Erros da IA */}
            {r.usar_ia && (() => {
              const errosIA = r.erros_amostra.filter(e => e.fonte_pred === 'ia')
              return errosIA.length > 0 ? (
                <div style={{ marginTop:16, paddingTop:12, borderTop:"1px solid var(--border)" }}>
                  <div style={{ fontSize:11, fontWeight:600, color:"#9B59B6", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>
                    Erros da IA ({errosIA.length})
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {errosIA.map((e, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                        <span style={{ color:"var(--text-muted)", flex:"1 1 0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={e.descricao}>
                          {e.descricao}
                        </span>
                        <span style={{ color: CATS_COR[e.real], fontWeight:600, whiteSpace:"nowrap" }}>{CATS_NOME[e.real] || e.real}</span>
                        <span style={{ color:"var(--text-muted)" }}>→</span>
                        <span style={{ color: CATS_COR[e.pred], fontWeight:600, whiteSpace:"nowrap" }}>{CATS_NOME[e.pred] || e.pred}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : r.por_fonte['ia']?.total > 0 ? (
                <div style={{ marginTop:16, paddingTop:12, borderTop:"1px solid var(--border)", fontSize:12, color:"#1D9E75" }}>
                  Nenhum erro da IA nesta amostra.
                </div>
              ) : null
            })()}
          </Section>
        </div>

        {/* Por Categoria */}
        <Section title="Por Categoria">
          <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:12, lineHeight:1.6 }}>
            <strong>Recall</strong> — cobertura: de todos os lançamentos reais dessa categoria, quantos o modelo identificou corretamente?&nbsp;
            <strong>Precisão</strong> — confiabilidade: quando o modelo disse ser essa categoria, quantas vezes estava certo?&nbsp;
            <strong>F1</strong> — nota geral: média harmônica entre recall e precisão (baixo se errar muito em qualquer um dos dois).
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:"2px solid var(--border)" }}>
                {[
                  { label:"Categoria", title:"" },
                  { label:"Total",     title:"Quantidade de lançamentos reais nessa categoria" },
                  { label:"Recall",    title:"Cobertura: % dos lançamentos reais que o modelo encontrou" },
                  { label:"Precisão",  title:"Confiabilidade: % das predições dessa categoria que estavam certas" },
                  { label:"F1",        title:"Nota geral: equilíbrio entre recall e precisão" },
                ].map(({ label, title }) => (
                  <th key={label} title={title} style={{
                    textAlign: label === "Categoria" ? "left" : "center",
                    padding:"6px 10px", fontWeight:600, fontSize:11,
                    color:"var(--text-muted)", textTransform:"uppercase",
                    cursor: title ? "help" : "default"
                  }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(r.por_categoria)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([cat, d]) => (
                  <tr key={cat} style={{ borderBottom:"1px solid var(--border)" }}>
                    <td style={{ padding:"7px 10px" }}>
                      <span style={{
                        display:"inline-block", width:8, height:8, borderRadius:"50%",
                        background: CATS_COR[cat] || "#aaa", marginRight:8, verticalAlign:"middle"
                      }} />
                      {CATS_NOME[cat] || cat}
                    </td>
                    <td style={{ textAlign:"center", padding:"7px 10px", color:"var(--text-muted)" }}>{d.total}</td>
                    <td style={{ padding:"7px 10px" }}><MiniBar value={d.recall} /></td>
                    <td style={{ padding:"7px 10px" }}><MiniBar value={d.precisao} /></td>
                    <td style={{ padding:"7px 10px" }}><MiniBar value={d.f1} /></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </Section>

        {/* Top 5 erros + amostra maior */}
        {r.erros_amostra.length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>

            <Section title="Top 5 Erros">
              <p style={{ margin:"0 0 10px", fontSize:11, color:"var(--text-muted)" }}>
                Os primeiros erros encontrados — descrição, categoria real e o que o modelo previu.
              </p>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:"2px solid var(--border)" }}>
                    {["Descrição","Real","Previsto","Conf."].map(h => (
                      <th key={h} style={{
                        textAlign:"left", padding:"5px 8px",
                        fontWeight:600, fontSize:11, color:"var(--text-muted)"
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.erros_amostra.slice(0, 5).map((e, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                      <td style={{
                        padding:"6px 8px", maxWidth:200,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
                      }} title={e.descricao}>{e.descricao}</td>
                      <td style={{ padding:"6px 8px", whiteSpace:"nowrap" }}>
                        <span style={{ color: CATS_COR[e.real], fontWeight:600 }}>
                          {CATS_NOME[e.real] || e.real}
                        </span>
                      </td>
                      <td style={{ padding:"6px 8px", whiteSpace:"nowrap" }}>
                        <span style={{ color: CATS_COR[e.pred], fontWeight:600 }}>
                          {CATS_NOME[e.pred] || e.pred}
                        </span>
                      </td>
                      <td style={{ padding:"6px 8px" }}><Badge cor={e.confianca} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title={`Mais Erros — amostra de ${r.erros_amostra.length}`}>
              <button
                onClick={() => setShowErros(v => !v)}
                style={{
                  background:"none", border:"none", color:"var(--primary)",
                  cursor:"pointer", fontSize:12, padding:0, marginBottom: showErros ? 12 : 0
                }}
              >
                {showErros ? "▲ Ocultar" : "▼ Ver todos"}
              </button>
              {showErros && (
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:"2px solid var(--border)" }}>
                      {["Descrição","Real","Previsto","Conf."].map(h => (
                        <th key={h} style={{
                          textAlign:"left", padding:"5px 8px",
                          fontWeight:600, fontSize:11, color:"var(--text-muted)"
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.erros_amostra.map((e, i) => (
                      <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                        <td style={{
                          padding:"5px 8px", maxWidth:200,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
                        }} title={e.descricao}>{e.descricao}</td>
                        <td style={{ padding:"5px 8px", whiteSpace:"nowrap" }}>
                          <span style={{ color: CATS_COR[e.real], fontWeight:600 }}>
                            {CATS_NOME[e.real] || e.real}
                          </span>
                        </td>
                        <td style={{ padding:"5px 8px", whiteSpace:"nowrap" }}>
                          <span style={{ color: CATS_COR[e.pred], fontWeight:600 }}>
                            {CATS_NOME[e.pred] || e.pred}
                          </span>
                        </td>
                        <td style={{ padding:"5px 8px" }}><Badge cor={e.confianca} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

          </div>
        )}

        {/* Top 5 — IA devolveu para o usuário responder */}
        {r.usar_ia && (() => {
          const iaParaUsuario = (r.ia_lancamentos || []).filter(l => l.confianca === "vermelho")
          if (iaParaUsuario.length === 0) return null
          return (
            <Section title={`Top 5 — IA devolveu para você responder (${iaParaUsuario.length} no total)`}>
              <p style={{ margin:"0 0 10px", fontSize:11, color:"var(--text-muted)" }}>
                Casos em que a IA não teve informação suficiente e pediria sua decisão (retorno <strong>inconclusivo</strong>).
              </p>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:"2px solid var(--border)" }}>
                    {["Descrição","Valor","Categoria real","Status"].map(h => (
                      <th key={h} style={{
                        textAlign:"left", padding:"5px 8px",
                        fontWeight:600, fontSize:11, color:"var(--text-muted)"
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {iaParaUsuario.slice(0, 5).map((l, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                      <td style={{ padding:"6px 8px", maxWidth:260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.descricao}>
                        {l.descricao}
                      </td>
                      <td style={{ padding:"6px 8px", whiteSpace:"nowrap", color:"var(--text-muted)" }}>
                        R$ {Math.abs(l.valor).toFixed(2)}
                      </td>
                      <td style={{ padding:"6px 8px", whiteSpace:"nowrap" }}>
                        <span style={{ color: CATS_COR[l.real], fontWeight:600 }}>{CATS_NOME[l.real] || l.real}</span>
                      </td>
                      <td style={{ padding:"6px 8px" }}><Badge cor="vermelho" label="inconclusivo" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )
        })()}

        {/* Lançamentos processados pela IA */}
        {r.usar_ia && r.ia_lancamentos?.length > 0 && (
          <Section title={`Lançamentos Processados pela IA — ${r.ia_lancamentos.length} no total`}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:"2px solid var(--border)" }}>
                  {["Descrição","Valor","Real","Predito","Conf.",""].map(h => (
                    <th key={h} style={{
                      textAlign:"left", padding:"5px 8px",
                      fontWeight:600, fontSize:11, color:"var(--text-muted)"
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.ia_lancamentos.map((l, i) => {
                  const devolvido = l.confianca === "vermelho"
                  return (
                  <tr key={i} style={{
                    borderBottom:"1px solid var(--border)",
                    background: devolvido ? "rgba(226,75,74,0.08)" : "transparent",
                    boxShadow: devolvido ? "inset 3px 0 0 var(--danger)" : "none"
                  }}>
                    <td style={{ padding:"6px 8px", maxWidth:240, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.descricao}>
                      {l.descricao}
                    </td>
                    <td style={{ padding:"6px 8px", whiteSpace:"nowrap", color:"var(--text-muted)" }}>
                      R$ {Math.abs(l.valor).toFixed(2)}
                    </td>
                    <td style={{ padding:"6px 8px", whiteSpace:"nowrap" }}>
                      <span style={{ color: CATS_COR[l.real], fontWeight:600 }}>{CATS_NOME[l.real] || l.real}</span>
                    </td>
                    <td style={{ padding:"6px 8px", whiteSpace:"nowrap" }}>
                      {l.pred
                        ? <span style={{ color: CATS_COR[l.pred], fontWeight:600 }}>{CATS_NOME[l.pred] || l.pred}</span>
                        : <span style={{ color:"var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ padding:"6px 8px" }}><Badge cor={l.confianca} /></td>
                    <td style={{ padding:"6px 8px", fontWeight:600, color: l.acertou ? "#1D9E75" : l.pred ? "#E24B4A" : "var(--text-muted)" }}>
                      {l.acertou ? "✓" : l.pred ? "✗" : "?"}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </Section>
        )}

      </>)}
    </div>
  )
}
