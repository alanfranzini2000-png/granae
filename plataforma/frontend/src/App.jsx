import { useState, useEffect } from "react"
import Upload from "./pages/Upload"
import Revisao from "./pages/Revisao"
import Dashboard from "./pages/Dashboard"
import StatusBar from "./components/StatusBar"
import GogoManager from "./components/Gogo"

const API = "http://127.0.0.1:8000"
const TABS = ["Upload", "Revisão", "Dashboard"]

export default function App() {
  const [tab, setTab] = useState("Dashboard")
  const [uploadData, setUploadData] = useState(null)
  const [status, setStatus] = useState({ ultimo_dado_debito: null, ultimo_dado_credito: null })

  useEffect(() => { fetchStatus() }, [])

  async function fetchStatus() {
    try {
      const res = await fetch(`${API}/status`)
      setStatus(await res.json())
    } catch(e) {}
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
        <StatusBar statusUploads={status} onStatusRefresh={fetchStatus} />
      </div>

      {/* CONTENT */}
      <div style={{ flex:1, padding:"1.5rem", maxWidth:1140, margin:"0 auto", width:"100%" }}>
        {tab==="Upload"    && <Upload onUploadSuccess={handleUploadSuccess} />}
        {tab==="Revisão"   && <Revisao uploadData={uploadData} onIncorporado={handleIncorporado} />}
        {tab==="Dashboard" && <Dashboard />}
      </div>
    </div>
  )
}
