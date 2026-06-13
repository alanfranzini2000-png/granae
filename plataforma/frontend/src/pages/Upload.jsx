import { useState, useRef } from "react"

const API = "http://127.0.0.1:8000"

export default function Upload({ onUploadSuccess }) {
  const [arquivos, setArquivos] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState(null)
  const [drag,     setDrag]     = useState(false)
  const [arquivosComSenha, setArquivosComSenha] = useState([])
  const [senhas, setSenhas] = useState({})
  const [errosUpload, setErrosUpload] = useState([])
  const [dadosSucesso, setDadosSucesso] = useState(null)
  const inputRef = useRef()

  function adicionarArquivos(novos) {
    const lista = Array.from(novos).filter(f => f.type === "application/pdf")
    setArquivos(prev => {
      const nomes = new Set(prev.map(f => f.name))
      return [...prev, ...lista.filter(f => !nomes.has(f.name))]
    })
  }

  function remover(nome) {
    setArquivos(prev => prev.filter(f => f.name !== nome))
    setSenhas(prev => { const s = {...prev}; delete s[nome]; return s })
  }

  async function enviar() {
    if (!arquivos.length) { setErro("Adicione pelo menos um arquivo."); return }
    setLoading(true); setErro(null); setErrosUpload([]); setDadosSucesso(null)
    const form = new FormData()
    arquivos.forEach(f => form.append("files", f))
    if (Object.keys(senhas).length > 0) {
      form.append("senhas", JSON.stringify(senhas))
    }
    try {
      const res  = await fetch(`${API}/upload`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Erro no upload")

      if (data.arquivos_com_senha?.length > 0) {
        setArquivosComSenha(data.arquivos_com_senha)
        return
      }

      setArquivosComSenha([])
      setSenhas({})

      if (data.erros?.length > 0) {
        setErrosUpload(data.erros)
        if (data.total > 0) {
          // sucesso parcial: guarda para o usuário decidir se quer continuar
          setDadosSucesso(data)
        }
        window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: 'erro' }))
        return
      }

      window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: 'upload' }))
      onUploadSuccess(data)
    } catch(e) {
      setErro(e.message)
      window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: 'erro' }))
    } finally { setLoading(false) }
  }

  function confirmarSenhas() {
    const faltando = arquivosComSenha.filter(n => !senhas[n]?.trim())
    if (faltando.length) { setErro("Preencha a senha de todos os arquivos protegidos."); return }
    setErro(null)
    enviar()
  }

  // ── MODAL DE SENHA ────────────────────────────────────────────────────────
  if (arquivosComSenha.length > 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem", maxWidth:640 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:"var(--text)", marginBottom:6 }}>
            🔒 PDF{arquivosComSenha.length > 1 ? "s" : ""} protegido{arquivosComSenha.length > 1 ? "s" : ""}
          </h2>
          <p style={{ fontSize:13, color:"var(--text-muted)" }}>
            {arquivosComSenha.length === 1
              ? "Este arquivo está protegido por senha."
              : `${arquivosComSenha.length} arquivos estão protegidos por senha.`}
            {" "}Informe a senha para continuar o processamento.
          </p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {arquivosComSenha.map(nome => (
            <div key={nome} style={{
              background:"var(--surface)", border:`1px solid var(--border)`,
              borderRadius:"var(--radius-md)", padding:"14px 16px",
              display:"flex", flexDirection:"column", gap:8
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16 }}>📄</span>
                <span style={{ fontSize:13, fontWeight:500, color:"var(--text)", flex:1,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{nome}</span>
              </div>
              <input
                type="password"
                placeholder="Senha do PDF"
                value={senhas[nome] || ""}
                onChange={e => setSenhas(prev => ({...prev, [nome]: e.target.value}))}
                onKeyDown={e => e.key === "Enter" && confirmarSenhas()}
                autoFocus
                style={{
                  padding:"9px 12px", fontSize:13,
                  border:`1px solid var(--border-mid)`,
                  borderRadius:"var(--radius-sm)",
                  background:"var(--surface2)", color:"var(--text)",
                  outline:"none", width:"100%", boxSizing:"border-box"
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:12, alignItems:"center" }}>
          {erro && <p style={{ fontSize:13, color:"var(--danger)" }}>⚠ {erro}</p>}
          <button
            onClick={() => { setArquivosComSenha([]); setSenhas({}); setErro(null) }}
            style={{
              padding:"10px 20px", fontSize:14, fontWeight:500,
              background:"var(--surface2)", color:"var(--text-muted)",
              border:`1px solid var(--border)`, borderRadius:"var(--radius-md)", cursor:"pointer"
            }}>
            Cancelar
          </button>
          <button onClick={confirmarSenhas} disabled={loading} style={{
            padding:"10px 24px", fontSize:14, fontWeight:500,
            background:"var(--primary)", color:"#fff",
            border:"none", borderRadius:"var(--radius-md)",
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
            transition:"all 0.15s"
          }}>
            {loading ? "Processando..." : "Continuar →"}
          </button>
        </div>
      </div>
    )
  }

  // ── ERROS DE LEITURA ─────────────────────────────────────────────────────
  if (errosUpload.length > 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem", maxWidth:640 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:"var(--text)", marginBottom:6 }}>
            Não foi possível ler {errosUpload.length === 1 ? "o arquivo" : `${errosUpload.length} arquivos`}
          </h2>
          <p style={{ fontSize:13, color:"var(--text-muted)" }}>
            {dadosSucesso
              ? `${dadosSucesso.total} lançamento(s) processado(s) com sucesso, mas os arquivos abaixo falharam.`
              : "Nenhum arquivo foi processado. Verifique os erros abaixo e tente novamente."}
          </p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {errosUpload.map((e, i) => {
            const [nomeArq, ...resto] = e.split(": ")
            const motivo = resto.join(": ")
            return (
              <div key={i} style={{
                background:"rgba(220,53,69,0.06)",
                border:`1px solid rgba(220,53,69,0.25)`,
                borderRadius:"var(--radius-md)", padding:"12px 16px",
                display:"flex", gap:10, alignItems:"flex-start"
              }}>
                <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>⚠️</span>
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{nomeArq}</span>
                  <span style={{ fontSize:12, color:"var(--text-muted)" }}>
                    {motivo || "Erro desconhecido ao ler o arquivo."}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:12, alignItems:"center" }}>
          <button
            onClick={() => { setErrosUpload([]); setDadosSucesso(null) }}
            style={{
              padding:"10px 20px", fontSize:14, fontWeight:500,
              background:"var(--surface2)", color:"var(--text-muted)",
              border:`1px solid var(--border)`, borderRadius:"var(--radius-md)", cursor:"pointer"
            }}>
            Tentar novamente
          </button>
          {dadosSucesso && (
            <button
              onClick={() => { onUploadSuccess(dadosSucesso) }}
              style={{
                padding:"10px 24px", fontSize:14, fontWeight:500,
                background:"var(--primary)", color:"#fff",
                border:"none", borderRadius:"var(--radius-md)", cursor:"pointer",
                transition:"all 0.15s"
              }}>
              Ver {dadosSucesso.total} lançamento(s) →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── TELA PRINCIPAL ────────────────────────────────────────────────────────
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
