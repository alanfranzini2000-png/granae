import { useEffect, useState, useRef } from "react"

const MAPEAMENTO = {
  upload:      { ggs: ['GG.ostentando.PNG','GG.ostentando.2.PNG','GG.ostentando.3.PNG','GG.ostentando.4.PNG'], fala: 'fala.arquivolido.PNG',          tipo: 'toast' },
  incorporado: { ggs: ['GG.certo.PNG','GG.certo.2.PNG','GG.certo.3.PNG'],                                      fala: 'fala.base atualizada.PNG',       tipo: 'popup' },
  download:    { ggs: ['GG.descolado.PNG','GG.descolado.2.PNG','GG.descolado.3.PNG'],                          fala: 'fala.download feito.PNG',        tipo: 'toast' },
  gasto_salvo: { ggs: ['GG.nerd.PNG','GG.poupando.PNG','GG.poupando2.PNG','GG.ostentando.PNG','GG.ostentando.2.PNG','GG.ostentando.3.PNG','GG.ostentando.4.PNG','GG.suave.PNG','GG.suave.2.PNG','GG.suave.3.PNG','GG.suave.4.PNG','GG.suave.5.PNG'], fala: 'fala.gasto salvo.PNG', tipo: 'toast' },
  catalogado:  { ggs: ['GG.nasty.PNG'],                                                                        fala: 'fala.gastos catalogados.PNG',    tipo: 'slidein' },
  erro:        { ggs: ['GG.surpreso.PNG','GG.surpreso.2.PNG','GG.surpreso.3.PNG','GG.surpreso.4.PNG','GG.surpreso.5.PNG','GG.surpreso.6.PNG','GG.surpreso.7.PNG','GG.surpreso.8.PNG'], fala: null, tipo: 'toast-erro' },
}

function sortear(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ── TOAST ──────────────────────────────────────────────────────────────────
function GogoToast({ gg, fala, erro, onDone }) {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    setTimeout(() => setVis(true), 50)
    setTimeout(() => { setVis(false); setTimeout(onDone, 400) }, 3500)
  }, [])
  return (
    <div style={{
      position:"fixed", bottom:24, right:24, zIndex:9000,
      display:"flex", alignItems:"flex-end", gap:8,
      transform: vis ? "translateY(0)" : "translateY(120px)",
      opacity: vis ? 1 : 0, transition:"all 0.35s cubic-bezier(0.34,1.56,0.64,1)"
    }}>
      {fala && <img src={`/gogo/${fala}`} style={{ height:60, objectFit:"contain" }} />}
      <img src={`/gogo/${gg}`} style={{ height:100, objectFit:"contain" }} />
      {erro && (
        <div style={{ position:"absolute", top:-36, right:0,
          background:"var(--danger)", color:"#fff", borderRadius:"var(--radius-md)",
          padding:"6px 12px", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
          {erro}
        </div>
      )}
    </div>
  )
}

// ── POPUP CENTRAL ──────────────────────────────────────────────────────────
function GogoPopup({ gg, fala, onDone }) {
  const [vis, setVis] = useState(false)
  useEffect(() => { setTimeout(() => setVis(true), 50) }, [])
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9000,
      background: vis ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
      display:"flex", alignItems:"center", justifyContent:"center",
      transition:"background 0.3s", cursor:"pointer"
    }} onClick={() => { setVis(false); setTimeout(onDone, 300) }}>
      <div style={{
        display:"flex", flexDirection:"column", alignItems:"center", gap:12,
        transform: vis ? "scale(1)" : "scale(0.7)",
        opacity: vis ? 1 : 0, transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1)"
      }}>
        {fala && <img src={`/gogo/${fala}`} style={{ height:80, objectFit:"contain" }} />}
        <img src={`/gogo/${gg}`} style={{ height:200, objectFit:"contain" }} />
        <p style={{ color:"rgba(255,255,255,0.6)", fontSize:12 }}>toque para fechar</p>
      </div>
    </div>
  )
}

// ── SLIDE-IN LATERAL (nasty!) ──────────────────────────────────────────────
function GogoSlideIn({ gg, fala, onDone }) {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    setTimeout(() => setVis(true), 50)
    setTimeout(() => { setVis(false); setTimeout(onDone, 500) }, 4000)
  }, [])
  return (
    <div style={{
      position:"fixed", bottom:0, right: vis ? 0 : -220, zIndex:9000,
      display:"flex", alignItems:"flex-end", gap:8,
      transition:"right 0.5s cubic-bezier(0.34,1.56,0.64,1)"
    }}>
      {fala && (
        <div style={{
          marginBottom:60, opacity: vis ? 1 : 0,
          transition:"opacity 0.3s 0.4s"
        }}>
          <img src={`/gogo/${fala}`} style={{ height:70, objectFit:"contain" }} />
        </div>
      )}
      <img src={`/gogo/${gg}`} style={{ height:180, objectFit:"contain" }} />
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────
export default function GogoManager() {
  const [atual, setAtual] = useState(null)

  useEffect(() => {
    function handler(e) {
      const tipo = e.detail
      const cfg = MAPEAMENTO[tipo]
      if (!cfg) return
      setAtual({
        gg:   sortear(cfg.ggs),
        fala: cfg.fala,
        tipo: cfg.tipo,
        erro: tipo === 'erro' ? (e.detail?.msg || null) : null,
      })
    }
    window.addEventListener('gogo-trigger', handler)
    return () => window.removeEventListener('gogo-trigger', handler)
  }, [])

  if (!atual) return null

  const done = () => setAtual(null)

  if (atual.tipo === 'popup')      return <GogoPopup    gg={atual.gg} fala={atual.fala} onDone={done} />
  if (atual.tipo === 'slidein')    return <GogoSlideIn  gg={atual.gg} fala={atual.fala} onDone={done} />
  if (atual.tipo === 'toast-erro') return <GogoToast    gg={atual.gg} fala={null} erro={atual.erro || "Algo deu errado"} onDone={done} />
  return <GogoToast gg={atual.gg} fala={atual.fala} onDone={done} />
}

// Helper global para disparar o GOGO de qualquer lugar
export function triggerGogo(tipo, extra) {
  window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: tipo, ...extra }))
}
