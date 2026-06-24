import { useState } from "react"

const API = "http://127.0.0.1:8000"

const CATS_NOME = {
  SA:"Salário", I:"Investimento", F:"Fatura", CA:"Casa", S:"Saúde",
  E:"Estudo", A:"Assinatura", T:"Transporte", M:"Mercado", C:"Comida",
  B:"Bens", R:"Roupa", L:"Lazer", O:"Outros"
}
const CATS = Object.keys(CATS_NOME)

// índice 0 → "A", 1 → "B", ... (rótulo de coluna estilo Excel)
function colLetra(i) {
  let s = "", n = i + 1
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) }
  return s
}

const inputBox = {
  padding: "7px 10px", fontSize: 13, borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-mid)", background: "var(--surface2)",
  color: "var(--text)", outline: "none"
}

export default function ImportarPlanilha({ onUploadSuccess }) {
  const [arquivo, setArquivo]   = useState(null)
  const [previa, setPrevia]     = useState(null)   // { colunas, total_linhas, linhas }
  const [map, setMap]           = useState({
    linha_inicio: 2, col_data: null, col_descricao: null,
    col_categoria: null, col_valor: null, despesa_positiva: true
  })
  const [categorias, setCategorias] = useState(null) // [{valor, sugestao, n}]
  const [dePara, setDePara]     = useState({})
  const [passo, setPasso]       = useState(1)        // 1 = mapear · 2 = de-para
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState(null)

  function autoDetect(prev) {
    const header = (prev.linhas[0] || []).map(s => (s || "").toLowerCase())
    const find = (...keys) => {
      const i = header.findIndex(h => keys.some(k => h.includes(k)))
      return i >= 0 ? i : null
    }
    return {
      col_data:      find("data", "dt"),
      col_descricao: find("desc", "nome", "histor", "lanç", "lanc", "estabele"),
      col_categoria: find("categ", "classific", "tipo de gasto"),
      col_valor:     find("valor", "montante", "preço", "preco", "r$"),
    }
  }

  async function escolherArquivo(f) {
    if (!f) return
    setArquivo(f); setErro(null); setLoading(true)
    setPrevia(null); setCategorias(null); setPasso(1)
    try {
      const form = new FormData(); form.append("file", f)
      const res = await fetch(`${API}/importar-planilha/previa`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Erro ao ler a planilha")
      setPrevia(data)
      setMap(m => ({ ...m, ...autoDetect(data) }))
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  const podeAnalisar =
    map.col_data != null && map.col_descricao != null &&
    map.col_valor != null && map.linha_inicio >= 1

  async function avancar() {
    setErro(null)
    // Sem coluna de categoria → importa direto (tudo cai como "sem categoria" na Revisão)
    if (map.col_categoria == null) return importar({})
    setLoading(true)
    try {
      const form = new FormData()
      form.append("file", arquivo)
      form.append("col_categoria", map.col_categoria)
      form.append("linha_inicio", map.linha_inicio)
      const res = await fetch(`${API}/importar-planilha/categorias`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Erro ao analisar as categorias")
      setCategorias(data.categorias)
      const dp = {}; data.categorias.forEach(c => { dp[c.valor] = c.sugestao || "" })
      setDePara(dp)
      setPasso(2)
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  async function importar(dpOverride) {
    setLoading(true); setErro(null)
    try {
      const form = new FormData()
      form.append("file", arquivo)
      form.append("mapeamento", JSON.stringify(map))
      form.append("de_para", JSON.stringify(dpOverride ?? dePara))
      const res = await fetch(`${API}/importar-planilha`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Erro ao importar")
      window.dispatchEvent(new CustomEvent('gogo-trigger', { detail: 'upload' }))
      onUploadSuccess(data)
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  // ── Dropdown de coluna reutilizável ─────────────────────────────────────
  function ColSelect({ campo, label, opcional }) {
    const amostra = i => {
      const linhaAmostra = previa.linhas[Math.min(map.linha_inicio - 1, previa.linhas.length - 1)] || previa.linhas[0] || []
      const v = (linhaAmostra[i] || "").toString().slice(0, 16)
      return v ? ` · ${v}` : ""
    }
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
        {label}
        <select value={map[campo] ?? ""} onChange={e => setMap(m => ({ ...m, [campo]: e.target.value === "" ? null : Number(e.target.value) }))}
          style={{ ...inputBox, cursor: "pointer", borderColor: map[campo] != null ? "var(--primary)" : (opcional ? "var(--border-mid)" : "var(--danger)") }}>
          <option value="">{opcional ? "— nenhuma —" : "selecione…"}</option>
          {Array.from({ length: previa.colunas }).map((_, i) =>
            <option key={i} value={i}>{colLetra(i)}{amostra(i)}</option>)}
        </select>
      </label>
    )
  }

  // ── Grade de prévia (até 10 linhas × 10 colunas) ────────────────────────
  function renderGrade() {
    if (!previa) return null
    const nCols = Math.min(previa.colunas, 10)
    const extra = previa.colunas - nCols
    const linhas = previa.linhas.slice(0, 10)
    return (
      <div>
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "auto", maxHeight: 240 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead>
              <tr style={{ background: "var(--surface2)" }}>
                <th style={{ padding: "4px 8px", color: "var(--text-faint)", fontSize: 10, position: "sticky", left: 0, background: "var(--surface2)" }}>#</th>
                {Array.from({ length: nCols }).map((_, i) => (
                  <th key={i} style={{ padding: "4px 10px", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap", borderLeft: "1px solid var(--border)" }}>
                    {colLetra(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, ri) => {
                const ehDado = (ri + 1) >= map.linha_inicio
                return (
                  <tr key={ri} style={{ background: ehDado ? "transparent" : "rgba(239,159,39,0.08)" }}>
                    <td style={{ padding: "3px 8px", color: "var(--text-faint)", fontSize: 10, position: "sticky", left: 0, background: "var(--surface)" }}>{ri + 1}</td>
                    {Array.from({ length: nCols }).map((_, ci) => (
                      <td key={ci} style={{ padding: "3px 10px", color: "var(--text)", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", borderLeft: "1px solid var(--border)" }}>
                        {linha[ci]}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
          Mostrando até 10 linhas × 10 colunas{extra > 0 ? ` (+${extra} coluna(s) não exibida(s))` : ""}.
          Linhas em amarelo são ignoradas (antes do 1º dado).
        </p>
      </div>
    )
  }

  // ── PASSO 2: DE-PARA DE CATEGORIAS ──────────────────────────────────────
  if (passo === 2 && categorias) {
    const semSugestao = categorias.filter(c => !dePara[c.valor]).length
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 680 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
            De-para de categorias
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Encontrei {categorias.length} categoria(s) na planilha. Confira o equivalente em cada
            uma — as sugestões já vêm preenchidas onde reconheci.
          </p>
        </div>

        {renderGrade()}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {categorias.map(c => (
            <div key={c.valor} style={{
              display: "grid", gridTemplateColumns: "1fr auto 200px", gap: 10, alignItems: "center",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "8px 12px"
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.valor}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{c.n}×</span>
              <select value={dePara[c.valor] || ""} onChange={e => setDePara(d => ({ ...d, [c.valor]: e.target.value }))}
                style={{ ...inputBox, cursor: "pointer", fontSize: 12,
                  borderColor: dePara[c.valor] ? "var(--primary)" : "var(--border-mid)" }}>
                <option value="">— sem categoria —</option>
                {CATS.map(code => <option key={code} value={code}>{code} — {CATS_NOME[code]}</option>)}
              </select>
            </div>
          ))}
        </div>

        {semSugestao > 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {semSugestao} categoria(s) sem equivalente — ficarão como “sem categoria” e você classifica na Revisão.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <button onClick={() => setPasso(1)} disabled={loading}
            style={{ padding: "9px 16px", fontSize: 13, background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", cursor: "pointer" }}>
            ← Voltar
          </button>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {erro && <span style={{ fontSize: 13, color: "var(--danger)" }}>⚠ {erro}</span>}
            <button onClick={() => importar()} disabled={loading}
              style={{ padding: "10px 22px", fontSize: 14, fontWeight: 500, background: "var(--primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Importando…" : "Importar para a Revisão →"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── PASSO 1: ANEXAR + MAPEAR ────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Importe sua base antiga de uma planilha Excel (.xlsx). Anexe o arquivo e depois aponte
          a linha do 1º dado e as colunas.
        </p>
      </div>

      {/* Anexar */}
      <label style={{
        display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
        border: "2px dashed var(--border-mid)", borderRadius: "var(--radius-lg)",
        padding: "1.25rem 1.5rem", background: "var(--surface)"
      }}>
        <input type="file" accept=".xlsx,.xls" style={{ display: "none" }}
          onChange={e => escolherArquivo(e.target.files?.[0])} />
        <span style={{ fontSize: 26 }}>📊</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
            {arquivo ? arquivo.name : "Clique para escolher uma planilha (.xlsx)"}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {previa ? `${previa.total_linhas ?? "—"} linha(s) · ${previa.colunas} coluna(s)` : "Excel exportado da sua base antiga"}
          </p>
        </div>
      </label>

      {loading && !previa && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Lendo planilha…</p>}

      {previa && (
        <>
          {/* Prévia em grade (10×10) */}
          {renderGrade()}

          {/* Mapeamento */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
              Linha do 1º dado
              <input type="number" min={1} value={map.linha_inicio}
                onChange={e => setMap(m => ({ ...m, linha_inicio: Math.max(1, Number(e.target.value) || 1) }))}
                style={{ ...inputBox, width: 80 }} />
            </label>
            <ColSelect campo="col_data"      label="Coluna da data" />
            <ColSelect campo="col_descricao" label="Coluna do nome do gasto" />
            <ColSelect campo="col_categoria" label="Coluna da categoria" opcional />
            <ColSelect campo="col_valor"     label="Coluna do valor" />
          </div>

          {/* Sinal do valor */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>Sinal dos valores</p>
            {[
              [true,  "Os valores são positivos e representam despesas (salário fica como receita)"],
              [false, "A planilha já tem o sinal certo (despesa negativa, receita positiva)"],
            ].map(([val, label]) => (
              <label key={String(val)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", padding: "3px 0", cursor: "pointer" }}>
                <input type="radio" checked={map.despesa_positiva === val}
                  onChange={() => setMap(m => ({ ...m, despesa_positiva: val }))}
                  style={{ accentColor: "var(--primary)" }} />
                {label}
              </label>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
            {erro && <span style={{ fontSize: 13, color: "var(--danger)" }}>⚠ {erro}</span>}
            <button onClick={avancar} disabled={!podeAnalisar || loading}
              style={{ padding: "10px 22px", fontSize: 14, fontWeight: 500,
                background: podeAnalisar ? "var(--primary)" : "var(--surface2)",
                color: podeAnalisar ? "#fff" : "var(--text-faint)",
                border: "none", borderRadius: "var(--radius-md)",
                cursor: podeAnalisar && !loading ? "pointer" : "not-allowed" }}>
              {loading ? "Processando…" : map.col_categoria == null ? "Importar para a Revisão →" : "Analisar categorias →"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
