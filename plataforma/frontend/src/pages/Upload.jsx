import { useState, useRef } from "react"

const API = "http://127.0.0.1:8000"

export default function Upload({ onUploadSuccess }) {
  const [arquivos, setArquivos] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState(null)
  const [drag,     setDrag]     = useState(false)
  const inputRef = useRef()

  function adicionarArquivos(novos) {
    const lista = Array.from(novos).filter(f => f.type === "application/pdf")
    setArquivos(prev => {
      const nomes = new Set(prev.map(f => f.name))
      return [...prev, ...lista.filter(f => !nomes.has(f.name))]
    })
  }

  function remover(nome) { setArquivos(prev => prev.filter(f => f.name !== nome)) }

  async function enviar() {
    if (!arquivos.length) { setErro("Adicione pelo menos um arquivo."); return }
    setLoading(true); setErro(null)
    const form = new FormData()
    arquivos.forEach(f => form.append("files", f))
    try {
      const res  = await fetch(`${API}/upload`, { method:"POST", body:form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Erro no upload")
      window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: 'upload' }))
      onUploadSuccess(data)
    } catch(e) {
      setErro(e.message)
      window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: 'erro' }))
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem", maxWidth:640 }}>
      <div>
        <h2 style={{ fontSize:20, fontWeight:600, color:"var(--text)", marginBottom:6 }}>Upload</h2>
        <p style={{ fontSize:13, color:"var(--text-muted)" }}>
          Adicione um ou mais PDFs — extratos de débito e/ou faturas de crédito.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); adicionarArquivos(e.dataTransfer.files) }}
        onClick={() => inputRef.current.click()}
        style={{
          border:`2px dashed ${drag ? "var(--primary)" : "var(--border-mid)"}`,
          borderRadius:"var(--radius-lg)", padding:"2.5rem",
          textAlign:"center", cursor:"pointer",
          background: drag ? "rgba(29,158,117,0.08)" : "var(--surface)",
          transition:"all 0.15s"
        }}>
        <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display:"none" }}
          onChange={e => adicionarArquivos(e.target.files)} />
        <p style={{ fontSize:32, marginBottom:8 }}>📄</p>
        <p style={{ fontSize:14, fontWeight:500, color:"var(--text)", marginBottom:4 }}>
          Arraste PDFs aqui ou clique para selecionar
        </p>
        <p style={{ fontSize:12, color:"var(--text-muted)" }}>
          Múltiplos arquivos · débito e crédito detectados automaticamente
        </p>
      </div>

      {/* Lista */}
      {arquivos.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {arquivos.map(f => (
            <div key={f.name} style={{
              display:"flex", alignItems:"center", gap:10,
              background:"var(--surface)", border:`1px solid var(--border)`,
              borderRadius:"var(--radius-md)", padding:"10px 14px"
            }}>
              <span style={{ fontSize:18 }}>📄</span>
              <p style={{ flex:1, fontSize:13, fontWeight:500, color:"var(--text)" }}>{f.name}</p>
              <p style={{ fontSize:11, color:"var(--text-faint)" }}>{(f.size/1024).toFixed(0)} KB</p>
              <button onClick={() => remover(f.name)} style={{
                fontSize:14, background:"none", border:"none",
                cursor:"pointer", color:"var(--text-faint)", padding:0 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Rodapé */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:12, alignItems:"center" }}>
        {erro && <p style={{ fontSize:13, color:"var(--danger)" }}>⚠ {erro}</p>}
        <button onClick={enviar} disabled={loading || !arquivos.length} style={{
          padding:"10px 24px", fontSize:14, fontWeight:500,
          background: !arquivos.length ? "var(--surface2)" : "var(--primary)",
          color: !arquivos.length ? "var(--text-faint)" : "#fff",
          border:"none", borderRadius:"var(--radius-md)",
          cursor: !arquivos.length ? "not-allowed" : "pointer",
          transition:"all 0.15s"
        }}>
          {loading ? "Processando..." : arquivos.length ? `Processar ${arquivos.length} arquivo(s) →` : "Selecione arquivos"}
        </button>
      </div>
    </div>
  )
}
