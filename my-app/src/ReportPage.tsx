import React from "react";
import { Link, useLocation } from "react-router-dom";

type AnalysisResult = {
  summary: string;
  risk_level: "low" | "medium" | "high";
  confidence: number; // 0..1
  red_flags: string[];
  inconsistencies: string[];
  next_steps: string[];
};

function confidenceLabel(c: number) {
  if (c >= 0.8) return "High confidence in this assessment.";
  if (c >= 0.5) return "Moderate confidence based on available information.";
  if (c > 0) return "Low confidence due to limited information.";
  return "No confidence. Insufficient data was provided.";
}

function riskColor(level: AnalysisResult["risk_level"]) {
  if (level === "high") return "#dc2626";
  if (level === "medium") return "#f59e0b";
  return "#16a34a";
}

export default function ReportPage() {
  const location = useLocation();
  const result = (location.state as any)?.result as AnalysisResult | undefined;

  if (!result) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Safety Analysis Report</h1>
        <p style={styles.muted}>
          No report data found. Please run an analysis first.
        </p>
        <Link to="/" style={styles.link}>
          Go back to analyzer
        </Link>
      </div>
    );
  }

  const confidencePercent = Math.round(result.confidence * 100);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Safety Analysis Report</h1>

      <div style={styles.topRow}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Risk Level</div>
          <span
            style={{
              ...styles.badge,
              backgroundColor: riskColor(result.risk_level),
            }}
          >
            {result.risk_level.toUpperCase()}
          </span>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Confidence</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{confidencePercent}%</div>
          <div style={styles.confidenceBar}>
            <div
              style={{
                ...styles.confidenceFill,
                width: `${confidencePercent}%`,
              }}
            />
          </div>
          <div style={styles.muted}>{confidenceLabel(result.confidence)}</div>
        </div>
      </div>

      <section style={styles.section}>
        <h2>Summary</h2>
        <p>{result.summary}</p>
      </section>

      <section style={styles.section}>
        <h2>Red Flags</h2>
        {result.red_flags.length === 0 ? (
          <p style={styles.muted}>No red flags detected.</p>
        ) : (
          <ul>
            {result.red_flags.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
      </section>

      <section style={styles.section}>
        <h2>Inconsistencies</h2>
        {result.inconsistencies.length === 0 ? (
          <p style={styles.muted}>No inconsistencies found.</p>
        ) : (
          <ul>
            {result.inconsistencies.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
      </section>

      <section style={styles.section}>
        <h2>Recommended Next Steps</h2>
        <ol>
          {result.next_steps.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      </section>

      <div style={{ marginTop: 18 }}>
        <Link to="/" style={styles.link}>
          Run another analysis
        </Link>
      </div>
    </div>
  );
}

const styles: { [k: string]: React.CSSProperties } = {
    page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0b1f4a 0%, #1a3275 100%)",
    padding: 40,
    display: "flex",
    justifyContent: "center",
  },
  container: {
    maxWidth: 820,
    margin: "40px auto",
    padding: 24,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    lineHeight: 1.6,
  },
  title: { marginBottom: 18 },
  topRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginBottom: 18,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
  },
  cardTitle: { fontWeight: 700, marginBottom: 8 },
  badge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
  },
  confidenceBar: {
    width: "100%",
    height: 10,
    background: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 8,
  },
  confidenceFill: {
    height: "100%",
    background: "linear-gradient(90deg, #22c55e, #16a34a)",
    transition: "width 0.35s ease",
  },
  section: {
    background: "#fff",
    borderRadius: 12,
    padding: 18,
    marginTop: 14,
    boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
  },
  muted: { color: "#6b7280", fontSize: 14 },
  link: {
    color: "#111827",
    fontWeight: 700,
    textDecoration: "underline",
  },
};
