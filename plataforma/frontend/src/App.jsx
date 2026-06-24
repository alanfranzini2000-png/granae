import { useState, useEffect, useMemo } from "react"
import Upload from "./pages/Upload"
import Revisao from "./pages/Revisao"
import Dashboard from "./pages/Dashboard"
import Lancamentos from "./pages/Lancamentos"
import Avaliacao from "./pages/Avaliacao"
import StatusBar from "./components/StatusBar"
import UsuarioSelector from "./components/UsuarioSelector"
import GogoManager from "./components/Gogo"
import { ModalDepurar, ModalVerificar, parseValorBR } from "./components/TabelaLancamentos"
import { getUsuario, setUsuario, USUARIO_PADRAO } from "./usuario"

const API = "http://127.0.0.1:8000"
const TABS = ["Upload", "Revisão", "Dashboard", "Lançamentos", "Avaliação"]

export default function App() {
  const [tab, setTab] = useState("Dashboard")
  const [uploadData, setUploadData] = useState(null)
  const [status, setStatus] = useState({ ultimo_dado_debito: null, ultimo_dado_credito: null })
  const [lancFiltro, setLancFiltro] = useState(null)
  const [base, setBase] = useState(getUsuario())
  const [recarga, setRecarga] = useState(0)  // bump → remonta as telas (key)

  // ── RASCUNHO GLOBAL (Features 6 e 8) ───────────────────────────────────────
  // Alterações ficam pendentes aqui (sobrevive à troca de aba) e só vão ao banco
  // no "Salvar". Compartilhado entre a aba Lançamentos e o pop-up Depurar.
  const [rascunho, setRascunho] = useState({ edits: {}, exclusoes: [] })
  const [versaoDados, setVersaoDados] = useState(0)  // bump força reload nas listas
  const [depurarFiltro, setDepurarFiltro] = useState(null)
  const [verificarAberto, setVerificarAberto] = useState(false)

  function editarRascunho(id, patch) {
    setRascunho(r => ({ ...r, edits: { ...r.edits, [id]: { ...r.edits[id], ...patch } } }))
  }
  function toggleExcluir(id) {
    setRascunho(r => {
      const tem = r.exclusoes.includes(id)
      return { ...r, exclusoes: tem ? r.exclusoes.filter(x => x !== id) : [...r.exclusoes, id] }
    })
  }
  // Marca/desmarca vários ids de uma vez (ações em massa do Verificar base).
  function marcarExclusoes(ids, incluir) {
    setRascunho(r => {
      const set = new Set(r.exclusoes)
      ids.forEach(id => incluir ? set.add(id) : set.delete(id))
      return { ...r, exclusoes: [...set] }
    })
  }
  // Pré-seleciona categorias sugeridas (regra/IA) no rascunho, sem sobrescrever
  // o que o usuário já editou. pares: [{ id, categoria }].
  function semearCategorias(pares) {
    setRascunho(r => {
      const edits = { ...r.edits }
      let mudou = false
      pares.forEach(({ id, categoria }) => {
        if (!categoria) return
        if (edits[id] && "categoria" in edits[id]) return  // já mexido: respeita
        edits[id] = { ...edits[id], categoria }
        mudou = true
      })
      return mudou ? { ...r, edits } : r
    })
  }
  // Aplica a MESMA categoria a vários ids de uma vez (ação em massa).
  // Diferente de semearCategorias: aqui SOBRESCREVE o que estiver lá, pois é
  // uma escolha explícita do usuário ("mudar todos os visíveis para X").
  function aplicarCategoria(ids, categoria) {
    setRascunho(r => {
      const edits = { ...r.edits }
      ids.forEach(id => { edits[id] = { ...edits[id], categoria } })
      return { ...r, edits }
    })
  }
  // Aplica a MESMA viagem a vários ids (ação em massa). "" = remover viagem.
  function aplicarViagem(ids, viagem) {
    setRascunho(r => {
      const edits = { ...r.edits }
      ids.forEach(id => { edits[id] = { ...edits[id], viagem } })
      return { ...r, edits }
    })
  }
  // Apelido "base toda": grava o de-para e troca todos os gastos com esse nome,
  // imediatamente (não passa pelo rascunho) — depois recarrega as telas.
  async function renomearBase(descricaoReal, apelido) {
    await fetch(`${API}/apelidos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao_real: descricaoReal, apelido, aplicar_base: true })
    })
    setVersaoDados(v => v + 1)
    fetchStatus()
  }
  // Força recarregar as listas/telas (ex.: após apagar viagem ou trocar card).
  function recarregarDados() { setVersaoDados(v => v + 1); fetchStatus() }
  function descartarRascunho() { setRascunho({ edits: {}, exclusoes: [] }) }

  async function salvarRascunho() {
    const ops = []
    for (const [idStr, patch] of Object.entries(rascunho.edits)) {
      const id = Number(idStr)
      if (rascunho.exclusoes.includes(id)) continue  // será excluído, não adianta editar
      const body = {}
      if ("categoria" in patch) body.categoria = patch.categoria || null
      if ("descricao" in patch && patch.descricao != null && patch.descricao !== "") body.descricao = patch.descricao
      if ("viagem" in patch) body.viagem = patch.viagem ?? ""
      if ("data" in patch && patch.data) {
        body.data = patch.data
        // Ao alterar a data, deriva o mês da nova data (a menos que o mês tenha
        // sido editado manualmente) — mantém o lançamento no mês certo.
        if (!("mes" in patch)) {
          const md = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(patch.data).trim())
          if (md) body.mes = `${Number(md[2])}/${md[3]}`
        }
      }
      if ("mes" in patch && patch.mes) body.mes = patch.mes
      if ("valor" in patch) {
        const v = parseValorBR(patch.valor)
        if (!Number.isNaN(v)) body.valor = v
      }
      if (Object.keys(body).length === 0) continue
      ops.push(fetch(`${API}/lancamentos/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      }))
    }
    for (const id of rascunho.exclusoes) {
      ops.push(fetch(`${API}/lancamentos/${id}`, { method: "DELETE" }))
    }
    await Promise.all(ops)
    descartarRascunho()
    setVersaoDados(v => v + 1)
    fetchStatus()
  }

  const totalPendentes = useMemo(() => {
    const ids = new Set([...Object.keys(rascunho.edits).map(Number), ...rascunho.exclusoes])
    return ids.size
  }, [rascunho])

  const rascunhoApi = {
    rascunho, editarRascunho, toggleExcluir, marcarExclusoes, semearCategorias,
    aplicarCategoria, aplicarViagem, renomearBase, recarregarDados,
    descartarRascunho, salvarRascunho, totalPendentes, versaoDados,
  }

  function abrirDepurar(filtro) { setDepurarFiltro(filtro) }

  useEffect(() => { fetchStatus() }, [])

  // Navega para Lançamentos já filtrado (a partir dos cards do topo do Dashboard).
  // _ts força reaplicar o filtro mesmo se o conteúdo for igual ao anterior.
  function navegarLancamentos(filtro) {
    setLancFiltro({ ...filtro, _ts: Date.now() })
    setTab("Lançamentos")
  }

  async function fetchStatus() {
    try {
      const res = await fetch(`${API}/status`)
      setStatus(await res.json())
    } catch(e) {}
  }

  // Troca a base ativa sem recarregar a página: atualiza o usuário (em memória,
  // o interceptor passa a mandar a nova base) e remonta as telas via key={base}.
  function trocarBase(u) {
    if (!u || u === base) return
    setUsuario(u)
    descartarRascunho()
    setUploadData(null)
    setLancFiltro(null)
    setDepurarFiltro(null)
    setVerificarAberto(false)
    setTab("Dashboard")
    setBase(u)
    setVersaoDados(v => v + 1)
    setRecarga(r => r + 1)
    fetchStatus()
  }

  // Recarrega as telas da base atual sem trocar de base (ex.: após "Zerar base").
  function recarregarTudo() {
    descartarRascunho()
    setUploadData(null)
    setVersaoDados(v => v + 1)
    setRecarga(r => r + 1)
    fetchStatus()
  }

  function handleUploadSuccess(data) {
    setUploadData(data)
    setTab("Revisão")
  }

  function handleIncorporado() {
    setUploadData(null)
    fetchStatus()
    setTab("Dashboard")
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column" }}>
<GogoManager />
      {/* NAV */}
      <div style={{
        background:"var(--surface)", borderBottom:`1px solid var(--border)`,
        padding:"0 1.5rem", display:"flex", alignItems:"center",
        justifyContent:"space-between", height:52, flexShrink:0
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"2rem" }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <img src="/gogo/GG.normal.PNG" alt="GOGO"
              style={{ width:28, height:28, objectFit:"contain" }}
              onError={e => e.target.style.display='none'} />
            <p style={{ fontSize:16, fontWeight:600, color:"var(--primary)",
              letterSpacing:"-0.3px" }}>Granaê</p>
          </div>
          {/* Tabs */}
          <div style={{ display:"flex", gap:2 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:"6px 14px", fontSize:13, cursor:"pointer",
                background: tab===t ? "var(--primary)" : "transparent",
                border:"none", borderRadius:"var(--radius-md)",
                color: tab===t ? "#fff" : "var(--text-muted)",
                fontWeight: tab===t ? 500 : 400,
                position:"relative", transition:"all 0.15s"
              }}>
                {t}
                {t==="Revisão" && uploadData && (
                  <span style={{
                    position:"absolute", top:2, right:2,
                    background:"var(--danger)", color:"#fff",
                    borderRadius:"50%", width:14, height:14, fontSize:9,
                    display:"flex", alignItems:"center", justifyContent:"center"
                  }}>{uploadData.sem_categoria || "!"}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <StatusBar statusUploads={status} onStatusRefresh={fetchStatus} onVerificar={() => setVerificarAberto(true)} />
          <UsuarioSelector base={base} onTrocar={trocarBase} onRecarregar={recarregarTudo} />
        </div>
      </div>

      {/* Banner da base ativa quando NÃO é a base padrão (evita confundir com a principal) */}
      {base !== USUARIO_PADRAO && (
        <div style={{
          background: "rgba(239,159,39,0.15)", borderBottom: "1px solid rgba(239,159,39,0.45)",
          color: "var(--text)", fontSize: 12, padding: "6px 1.5rem", display: "flex",
          alignItems: "center", gap: 8, flexShrink: 0
        }}>
          <span style={{ fontSize: 13 }}>🧪</span>
          Você está na base <strong style={{ fontWeight: 600 }}>{base}</strong> (não é a principal).
          <button onClick={() => trocarBase(USUARIO_PADRAO)} style={{
            marginLeft: "auto", fontSize: 11, padding: "2px 10px", cursor: "pointer",
            background: "none", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-md)", color: "var(--text)"
          }}>
            Voltar à principal
          </button>
        </div>
      )}

      {/* CONTENT — key muda ao trocar de base ou ao recarregar (zerar) → remonta */}
      <div key={`${base}:${recarga}`} style={{ flex:1, padding:"1.5rem", maxWidth:1140, margin:"0 auto", width:"100%" }}>
        {tab==="Upload"       && <Upload onUploadSuccess={handleUploadSuccess} />}
        {tab==="Revisão"      && <Revisao uploadData={uploadData} onIncorporado={handleIncorporado} />}
        {tab==="Dashboard"    && <Dashboard onNavegar={navegarLancamentos} onDepurar={abrirDepurar} versaoDados={versaoDados} />}
        {tab==="Lançamentos"  && <Lancamentos filtroInicial={lancFiltro} rascunhoApi={rascunhoApi} onDepurar={abrirDepurar} />}
        {tab==="Avaliação"    && <Avaliacao />}
      </div>

      {depurarFiltro && (
        <ModalDepurar
          filtro={depurarFiltro}
          rascunhoApi={rascunhoApi}
          onClose={() => setDepurarFiltro(null)}
        />
      )}

      {verificarAberto && (
        <ModalVerificar
          rascunhoApi={rascunhoApi}
          onClose={() => setVerificarAberto(false)}
        />
      )}
    </div>
  )
}
