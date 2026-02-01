import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type AnalysisResult = {
  summary: string;
  risk_level: "low" | "medium" | "high";
  confidence: number;
  red_flags: string[];
  inconsistencies: string[];
  next_steps: string[];
};

export default function FormPage() {
  const navigate = useNavigate();

  const [messagesText, setMessagesText] = useState("");
  const [userContext, setUserContext] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const canAnalyze = useMemo(() => {
    // 최소 하나는 있어야 분석 의미가 있음
    return (
      messagesText.trim().length > 0 ||
      userContext.trim().length > 0 ||
      linkUrl.trim().length > 0 ||
      extraNotes.trim().length > 0 ||
      !!imageFile
    );
  }, [messagesText, userContext, linkUrl, extraNotes, imageFile]);

  async function uploadImageIfNeeded(): Promise<string> {
    if (!imageFile) return "";

    const fd = new FormData();
    fd.append("file", imageFile);

    const r = await fetch("/api/upload", {
      method: "POST",
      body: fd,
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Upload failed (${r.status}). ${t}`);
    }

    const data = await r.json();
    const url = String(data?.url || data?.image_url || "").trim();
    if (!url) throw new Error("Upload succeeded but no URL returned.");
    return url;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // 중복 호출 방지
    setError("");

    if (!canAnalyze) {
      setError("Please provide at least one input (text, link, notes, or image).");
      return;
    }

    setLoading(true);

    try {
      const image_url = await uploadImageIfNeeded();

      const payload = {
        messages_text: messagesText,
        user_context: userContext,
        link_url: linkUrl,
        extra_notes: extraNotes,
        image_url,
      };

      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // 429 등도 여기서 잡아서 사용자에게 보여주기
      const text = await r.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response from /api/analyze: ${text.slice(0, 200)}`);
      }

      if (!r.ok) {
        const msg = String(data?.detail || data?.error || "Analysis failed");
        throw new Error(msg);
      }

      const result = data as AnalysisResult;

      // report 페이지로 이동하면서 결과 전달
      navigate("/report", { state: { result } });
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Scam Risk Analyzer</h1>

      <form onSubmit={onSubmit} style={styles.form}>
        <label style={styles.label}>
          Messages Text
          <textarea
            value={messagesText}
            onChange={(e) => setMessagesText(e.target.value)}
            style={styles.textarea}
            placeholder="Paste the conversation or message text here..."
          />
        </label>

        <label style={styles.label}>
          User Context
          <textarea
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            style={styles.textarea}
            placeholder="Any background about the situation..."
          />
        </label>

        <label style={styles.label}>
          Link URL
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            style={styles.input}
            placeholder="https://..."
          />
        </label>

        <label style={styles.label}>
          Extra Notes
          <textarea
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            style={styles.textarea}
            placeholder="Anything else you want the analyzer to consider..."
          />
        </label>

        <label style={styles.label}>
          Optional Image
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            style={styles.input}
          />
        </label>

        {error ? <div style={styles.error}>{error}</div> : null}

        <button
          type="submit"
          disabled={!canAnalyze || loading}
          style={{
            ...styles.button,
            opacity: !canAnalyze || loading ? 0.6 : 1,
            cursor: !canAnalyze || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </form>
    </div>
  );
}

const styles: { [k: string]: React.CSSProperties } = {
  container: {
    maxWidth: 780,
    margin: "40px auto",
    padding: 24,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    background: "linear-gradient(180deg, #e6f0ff 0%, #ffffff 100%)",
    borderRadius: 16,
  },
  title: { 
    marginBottom: 24, 
    color: "#0b3d91",
    textAlign: "center",
    fontSize: 28,
  },
  form: {
    background: "#f0f6ff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 12px 28px rgba(0,0,0,0.08)",
  },
  label: { 
    display: "block", 
    marginBottom: 16, 
    fontWeight: 600, 
    color: "#0b3d91"
  },
  textarea: {
    width: "100%",
    minHeight: 90,
    marginTop: 6,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #a3c4f3",
    fontWeight: 400,
    resize: "vertical",
    background: "#ffffff",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
    transition: "border 0.2s",
  },
  input: {
    width: "100%",
    marginTop: 6,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #a3c4f3",
    fontWeight: 400,
    background: "#ffffff",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
    transition: "border 0.2s",
  },
  button: {
    width: "100%",
    marginTop: 16,
    padding: "14px 16px",
    borderRadius: 12,
    border: "none",
    fontWeight: 700,
    fontSize: 16,
    background: "linear-gradient(90deg, #0b3d91, #3f7fe1)",
    color: "#fff",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  buttonHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
  },
  error: {
    marginTop: 8,
    marginBottom: 6,
    color: "#b91c1c",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
  },
};
