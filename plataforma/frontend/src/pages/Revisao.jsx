import { useState, useEffect, useMemo } from "react"
import { AliasModal } from "../components/TabelaLancamentos"

const API = "http://127.0.0.1:8000"
const CATS = ["SA","I","F","CA","S","E","A","T","M","C","B","R","L","O"]
const CATS_NOME = {
  SA:"Salário",I:"Investimento",F:"Fatura",CA:"Casa",S:"Saúde",
  E:"Estudo",A:"Assinatura",T:"Transporte",M:"Mercado",C:"Comida",
  B:"Bens",R:"Roupa",L:"Lazer",O:"Outros"
}
const CONF = {
  verde:    { label:"✓ Certo",   bg:"rgba(29,158,117,0.15)",  color:"#1D9E75" },
  amarelo:  { label:"? Revisar", bg:"rgba(239,159,39,0.15)",  color:"#EF9F27" },
  vermelho: { label:"! Atenção", bg:"rgba(226,75,74,0.15)",   color:"#E24B4A" },
}
const ARQ = {
  debito:  { label:"Débito",  bg:"rgba(127,119,221,0.15)", color:"#7F77DD" },
  credito: { label:"Crédito", bg:"rgba(55,138,221,0.15)",  color:"#378ADD" },
}

// ── POPUP (verde-creme) ────────────────────────────────────────────────────
function Popup({ titulo, sub, children, podeFechar=true, onFechar }) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:800,
      background:"rgba(0,0,0,0.55)",
      display:"flex", alignItems:"center", justifyContent:"center"
    }}>
      <div style={{
        background:"var(--popup-bg)", borderRadius:16,
        padding:"1.5rem", width:"min(620px,95vw)",
        maxHeight:"80vh", display:"flex", flexDirection:"column", gap:"1rem",
        border:"1px solid var(--popup-border)",
        boxShadow:"0 16px 48px rgba(0,0,0,0.4)", color:"var(--popup-text)"
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <p style={{ fontSize:16, fontWeight:600, color:"var(--popup-text)" }}>{titulo}</p>
            {sub && <p style={{ fontSize:12, color:"var(--popup-muted)", marginTop:2 }}>{sub}</p>}
          </div>
          {podeFechar && (
            <button onClick={onFechar} style={{ fontSize:18, background:"none",
              border:"none", cursor:"pointer", color:"var(--popup-muted)" }}>✕</button>
          )}
        </div>
        <div style={{ overflowY:"auto", flex:1 }}>{children}</div>
      </div>
    </div>
  )
}

// ── POPUP CATEGORIAS ───────────────────────────────────────────────────────
function PopupCategorias({ itens, onSalvar }) {
  const [local, setLocal] = useState(itens.map(i => ({...i})))
  const pendentes = local.filter(l => !l.categoria).length

  function mudar(id, cat) { setLocal(ls => ls.map(l => l.id===id ? {...l,categoria:cat} : l)) }

  async function fixarRegra(desc, cat) {
    if (!cat) return
    await fetch(`${API}/regras`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ palavra_chave: desc, categoria: cat })
    })
    window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: 'gasto_salvo' }))
  }

  return (
    <Popup titulo={`${itens.length} lançamento(s) sem categoria`}
      sub="Classifique todos para continuar" podeFechar={false}>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {local.map(item => (
          <div key={item.id} style={{
            display:"grid", gridTemplateColumns:"1fr 130px 90px",
            gap:8, alignItems:"center", padding:"10px 12px",
            background:"var(--popup-surface)", borderRadius:10
          }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:12, fontWeight:500, color:"var(--popup-text)",
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {item.descricao}
              </p>
              <p style={{ fontSize:11, color:"var(--popup-muted)" }}>
                {item.data} · R${Math.abs(item.valor).toLocaleString("pt-BR",{minimumFractionDigits:2})}
              </p>
            </div>
            <select value={item.categoria||""} onChange={e => mudar(item.id, e.target.value)}
              style={{ fontSize:11, padding:"4px 6px", borderRadius:8,
                border: item.categoria ? `1px solid var(--popup-border)` : "1px solid #E24B4A",
                background:"#fff", color:"var(--popup-text)", cursor:"pointer" }}>
              <option value="" disabled>-- selecione --</option>
              {CATS.map(c => <option key={c} value={c}>{c} — {CATS_NOME[c]}</option>)}
            </select>
            <button disabled={!item.categoria}
              onClick={() => fixarRegra(item.descricao, item.categoria)}
              style={{ fontSize:10, padding:"4px 8px", borderRadius:8,
                cursor: item.categoria ? "pointer" : "not-allowed",
                background: item.categoria ? "rgba(29,158,117,0.1)" : "transparent",
                color: item.categoria ? "var(--primary)" : "var(--popup-muted)",
                border:"1px solid currentColor", whiteSpace:"nowrap" }}>
              📌 Fixar
            </button>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <button onClick={() => onSalvar(local)} disabled={pendentes>0} style={{
          padding:"8px 20px", fontSize:13, fontWeight:500,
          background: pendentes>0 ? "#ccc" : "var(--primary)",
          color:"#fff", border:"none", borderRadius:10,
          cursor: pendentes>0 ? "not-allowed" : "pointer" }}>
          {pendentes>0 ? `Faltam ${pendentes}` : "Confirmar →"}
        </button>
      </div>
    </Popup>
  )
}

// ── PRINCIPAL ──────────────────────────────────────────────────────────────
export default function Revisao({ uploadData, onIncorporado }) {
  const [itens, setItens] = useState(uploadData?.itens || [])
  const [incorporando, setIncorporando] = useState(false)
  const [incorporadoInfo, setIncorporadoInfo] = useState(null)
  const [popup, setPopup] = useState(null)
  const [ordem, setOrdem] = useState({ key: null, dir: "asc" })
  const [editDesc, setEditDesc] = useState(null)     // { id, temp }
  const [apelidoPend, setApelidoPend] = useState(null) // { id, real, antigo, novo }

  // Colunas ordenáveis (mesma ideia de Lançamentos e do pop-up)
  const COLS = [
    { label: "Data", key: "data" },
    { label: "Descrição", key: "descricao" },
    { label: "Valor", key: "valor", align: "right" },
    { label: "Categoria", key: "categoria" },
    { label: "Conf.", key: "confianca" },
    { label: "Arquivo", key: "arquivo" },
    { label: "", key: null },
  ]

  function ordenarPor(key) {
    if (!key) return
    setOrdem(o => o.key === key ? { key, dir: o.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })
  }

  function chaveOrd(item, key) {
    switch (key) {
      case "data": { const [d, m, y] = (item.data || "").split("/"); return Number(`${y || ""}${m || ""}${d || ""}`) || 0 }
      case "valor": return item.valor ?? 0
      default: return (item[key] || "").toString().toLowerCase()
    }
  }

  const itensOrdenados = useMemo(() => {
    if (!ordem.key) return itens
    const arr = [...itens]
    arr.sort((a, b) => {
      const va = chaveOrd(a, ordem.key), vb = chaveOrd(b, ordem.key)
      if (va < vb) return ordem.dir === "asc" ? -1 : 1
      if (va > vb) return ordem.dir === "asc" ? 1 : -1
      return 0
    })
    return arr
  }, [itens, ordem])

  useEffect(() => {
    if (!uploadData) return
    const semCat = (uploadData.itens||[]).filter(i => !i.categoria)
    setPopup(semCat.length > 0 ? 'categorias' : null)
  }, [uploadData])

  if (!uploadData) return (
    <div style={{ textAlign:"center", padding:"4rem", color:"var(--text-muted)" }}>
      <img src="/gogo/GG.normal.PNG" style={{ height:120, marginBottom:16, opacity:0.7 }}
        onError={e => e.target.style.display='none'} />
      <p style={{ fontSize:15, fontWeight:500, color:"var(--text)", marginBottom:8 }}>Nenhum arquivo carregado</p>
      <p style={{ fontSize:13 }}>Vá para Upload e envie os arquivos.</p>
    </div>
  )

  function mudarCategoria(id, cat) { setItens(its => its.map(i => i.id===id ? {...i,categoria:cat} : i)) }
  function excluir(id)   { setItens(its => its.map(i => i.id===id ? {...i,excluir:true}  : i)) }
  function restaurar(id) { setItens(its => its.map(i => i.id===id ? {...i,excluir:false} : i)) }

  function handleCatsConfirmadas(cats) {
    setItens(its => its.map(i => { const n=cats.find(c=>c.id===i.id); return n ? {...i,categoria:n.categoria} : i }))
    setPopup(null)
  }

  // Renomear descrição na revisão (abre escolha: este vs base toda)
  function abrirRenome(item) { setEditDesc({ id: item.id, temp: item.descricao }) }
  function confirmarRenome() {
    const item = itens.find(i => i.id === editDesc?.id)
    const novo = (editDesc?.temp || "").trim()
    if (item && novo && novo !== item.descricao) {
      setApelidoPend({ id: item.id, real: item.descricao_real || item.descricao, antigo: item.descricao, novo })
    }
    setEditDesc(null)
  }
  function renomearSoEste() {
    if (apelidoPend) setItens(its => its.map(i => i.id === apelidoPend.id ? { ...i, descricao: apelidoPend.novo } : i))
    setApelidoPend(null)
  }
  async function renomearBaseToda() {
    if (!apelidoPend) return
    const { real, novo } = apelidoPend
    try {
      await fetch(`${API}/apelidos`, { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ descricao_real: real, apelido: novo, aplicar_base: true }) })
    } catch (e) { console.error(e) }
    // Atualiza localmente todos os itens com esse mesmo nome real
    setItens(its => its.map(i => (i.descricao_real || i.descricao) === real
      ? { ...i, descricao: novo, descricao_real: real } : i))
    setApelidoPend(null)
  }

  async function incorporar() {
    setIncorporando(true)
    const visiveis = itens.filter(i => !i.excluir)
    try {
      const res = await fetch(`${API}/incorporar`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ upload_id: uploadData.upload_id,
          itens: visiveis.map(i => ({id:i.id,categoria:i.categoria,excluir:false,descricao:i.descricao})) })
      })
      const data = await res.json()
      window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: 'incorporado' }))
      if (data.ignorados_duplicata > 0) setIncorporadoInfo(data)
      else onIncorporado && onIncorporado()
    } finally { setIncorporando(false) }
  }

  const visiveis  = itens.filter(i => !i.excluir)
  const excluidos = itens.filter(i => i.excluir)
  const semCat    = visiveis.filter(i => !i.categoria).length
  const itensSemCat = itens.filter(i => !i.categoria && !i.excluir)

  // Detectar fila zerada
  useEffect(() => {
    if (semCat === 0 && itens.length > 0 && !incorporadoInfo) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: 'catalogado' }))
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [semCat])

  if (incorporadoInfo) return (
    <div style={{ textAlign:"center", padding:"4rem", display:"flex",
      flexDirection:"column", alignItems:"center", gap:16 }}>
      <p style={{ fontSize:32 }}>✓</p>
      <p style={{ fontSize:15, fontWeight:500, color:"var(--text)" }}>
        {incorporadoInfo.incorporados} lançamentos incorporados
      </p>
      {incorporadoInfo.ignorados_duplicata > 0 && (
        <div style={{ background:"rgba(239,159,39,0.15)", borderRadius:10,
          padding:"10px 16px", color:"var(--gold)", fontSize:13 }}>
          ⚠ {incorporadoInfo.ignorados_duplicata} ignorados por duplicata
        </div>
      )}
      <button onClick={() => onIncorporado && onIncorporado()} style={{
        padding:"10px 24px", fontSize:14, fontWeight:500,
        background:"var(--primary)", color:"#fff", border:"none",
        borderRadius:10, cursor:"pointer", marginTop:8 }}>
        Ver Dashboard →
      </button>
    </div>
  )

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

      {popup==='categorias' && itensSemCat.length>0 &&
        <PopupCategorias itens={itensSemCat} onSalvar={handleCatsConfirmadas} />}
      {apelidoPend && (
        <AliasModal pend={apelidoPend} podeBase={true}
          onBaseToda={renomearBaseToda} onSoEste={renomearSoEste}
          onClose={() => setApelidoPend(null)} />
      )}

      {/* Resumo */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
        {[
          ["Total", itens.length, "var(--text)"],
          ["Débito",  itens.filter(i=>i.arquivo==="debito").length,  "var(--text)"],
          ["Crédito", itens.filter(i=>i.arquivo==="credito").length, "var(--text)"],
          ["Sem cat.", semCat, semCat>0 ? "var(--danger)" : "var(--primary)"],
          ["Excluídos", excluidos.length, "var(--text-muted)"],
        ].map(([l,v,c]) => (
          <div key={l} style={{ background:"var(--surface)", borderRadius:10, padding:"12px 14px" }}>
            <p style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>{l}</p>
            <p style={{ fontSize:22, fontWeight:500, color:c }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Aviso duplicatas */}
      {uploadData.duplicatas_removidas > 0 && (
        <div style={{ background:"var(--surface)", borderRadius:10, padding:"8px 14px",
          fontSize:12, color:"var(--text-muted)" }}>
          ℹ {uploadData.duplicatas_removidas} duplicata(s) removidas automaticamente
        </div>
      )}

      {/* Botão abrir popup se ainda tem pendentes */}
      {semCat > 0 && popup === null && (
        <button onClick={() => setPopup('categorias')} style={{
          alignSelf:"flex-start", padding:"6px 14px", fontSize:12,
          background:"var(--danger-bg)", color:"var(--danger)",
          border:"1px solid var(--danger)", borderRadius:10, cursor:"pointer", fontWeight:500 }}>
          🔴 {semCat} sem categoria — classificar
        </button>
      )}

      {/* Tabela */}
      <div style={{ background:"var(--surface)", border:`1px solid var(--border)`,
        borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 90px 110px 80px 70px 32px",
          gap:8, padding:"10px 14px", background:"var(--surface2)",
          borderBottom:`1px solid var(--border)` }}>
          {COLS.map((c, i) => {
            const ativo = ordem.key === c.key && c.key
            return (
              <p key={i} onClick={() => ordenarPor(c.key)}
                title={c.key ? "Clique para ordenar" : undefined}
                style={{ fontSize:10, fontWeight:500,
                  color: ativo ? "var(--primary)" : "var(--text-faint)",
                  textTransform:"uppercase", letterSpacing:"0.05em",
                  textAlign: c.align === "right" ? "right" : "left",
                  cursor: c.key ? "pointer" : "default", userSelect:"none" }}>
                {c.label}{ativo ? (ordem.dir === "asc" ? " ▲" : " ▼") : ""}
              </p>
            )
          })}
        </div>
        <div style={{ maxHeight:"58vh", overflowY:"auto" }}>
          {itensOrdenados.map(item => {
            const conf = CONF[item.confianca] || CONF.vermelho
            const arq  = ARQ[item.arquivo]   || null
            const isExc = item.excluir
            return (
              <div key={item.id} style={{
                display:"grid", gridTemplateColumns:"90px 1fr 90px 110px 80px 70px 32px",
                gap:8, padding:"9px 14px", alignItems:"center",
                borderBottom:`1px solid var(--border)`, opacity: isExc ? 0.3 : 1,
                background: item.confianca==="vermelho" && !isExc
                  ? "rgba(226,75,74,0.05)" : "transparent"
              }}>
                <p style={{ fontSize:11, color:"var(--text-muted)" }}>{item.data}</p>
                {editDesc && editDesc.id === item.id ? (
                  <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                    <input autoFocus value={editDesc.temp}
                      onChange={e => setEditDesc(d => ({ ...d, temp: e.target.value }))}
                      onKeyDown={e => { if (e.key==="Enter") confirmarRenome(); if (e.key==="Escape") setEditDesc(null) }}
                      style={{ fontSize:11, padding:"3px 6px", width:150, background:"var(--surface)",
                        border:"1px solid var(--primary)", borderRadius:6, color:"var(--text)", outline:"none" }} />
                    <button onClick={confirmarRenome} style={{ fontSize:11, padding:"3px 7px", cursor:"pointer", background:"var(--primary)", color:"#fff", border:"none", borderRadius:6 }}>OK</button>
                    <button onClick={() => setEditDesc(null)} style={{ fontSize:11, padding:"3px 5px", cursor:"pointer", background:"none", color:"var(--text-muted)", border:"1px solid var(--border-mid)", borderRadius:6 }}>✕</button>
                  </div>
                ) : (
                  <button disabled={isExc} onClick={() => !isExc && abrirRenome(item)} title="Clique para renomear"
                    style={{ background:"none", border:"none", cursor: isExc?"default":"pointer", padding:0, color:"var(--text)", font:"inherit", display:"inline-flex", alignItems:"center", gap:4, maxWidth:"100%" }}>
                    <span style={{ fontSize:12, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.descricao}</span>
                    {item.descricao_real && item.descricao_real !== item.descricao && (
                      <span style={{ fontSize:10, flexShrink:0 }} title={`veio como: ${item.descricao_real}`}>🏷️</span>
                    )}
                    {!isExc && <span style={{ fontSize:9, color:"var(--text-faint)", opacity:0.6, flexShrink:0 }}>✎</span>}
                  </button>
                )}
                <p style={{ fontSize:12, textAlign:"right", fontWeight:500,
                  color: item.valor>0 ? "var(--primary)" : "var(--text)" }}>
                  R${Math.abs(item.valor).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                </p>
                <select value={item.categoria||""} disabled={isExc}
                  onChange={e => mudarCategoria(item.id, e.target.value)}
                  style={{ fontSize:11, padding:"3px 6px", borderRadius:8,
                    border: item.categoria ? `1px solid var(--border-mid)` : "1px solid var(--danger)",
                    background:"var(--surface2)", color:"var(--text)", cursor:"pointer" }}>
                  <option value="" disabled>-- cat --</option>
                  {CATS.map(c => <option key={c} value={c}>{c} — {CATS_NOME[c]}</option>)}
                </select>
                <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20,
                  background:conf.bg, color:conf.color, fontWeight:500 }}>
                  {conf.label}
                </span>
                {arq ? (
                  <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20,
                    background:arq.bg, color:arq.color, fontWeight:500 }}>{arq.label}</span>
                ) : <span/>}
                <button onClick={() => isExc ? restaurar(item.id) : excluir(item.id)}
                  style={{ fontSize:14, background:"none", border:"none",
                    cursor:"pointer", color: isExc ? "var(--primary)" : "var(--text-faint)", padding:0 }}>
                  {isExc ? "↩" : "✕"}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:12, alignItems:"center" }}>
        <p style={{ fontSize:12, color:"var(--text-muted)" }}>
          {visiveis.length} incorporar · {excluidos.length} excluídos
        </p>
        <button onClick={incorporar} disabled={incorporando || semCat>0} style={{
          padding:"10px 24px", fontSize:14, fontWeight:500,
          background: semCat>0 ? "var(--surface2)" : "var(--primary)",
          color: semCat>0 ? "var(--text-faint)" : "#fff",
          border:"none", borderRadius:10,
          cursor: semCat>0 ? "not-allowed" : "pointer" }}>
          {incorporando ? "Incorporando..." : semCat>0 ? `Classifique ${semCat} primeiro` : "✓ Incorporar ao banco"}
        </button>
      </div>
    </div>
  )
}
