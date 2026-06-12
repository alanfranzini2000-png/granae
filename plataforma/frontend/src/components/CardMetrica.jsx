export default function CardMetrica({ label, valor, badge, badgeType = "warn", prefix = "R$" }) {
  const colors = {
    green: { bg: "var(--color-background-success)", color: "var(--color-text-success)" },
    red:   { bg: "var(--color-background-danger)",  color: "var(--color-text-danger)" },
    warn:  { bg: "var(--color-background-warning)", color: "var(--color-text-warning)" },
    info:  { bg: "var(--color-background-info)",    color: "var(--color-text-info)" },
  }
  const c = colors[badgeType] || colors.warn
  return (
    <div style={{
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-md)", padding: "1rem"
    }}>
      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4,
                  fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>
        {prefix} {typeof valor === "number" ? valor.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : valor}
      </p>
      {badge && (
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--border-radius-md)",
                       fontWeight: 500, background: c.bg, color: c.color }}>
          {badge}
        </span>
      )}
    </div>
  )
}
