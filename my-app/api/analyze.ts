// my-app/api/analyze.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { del } from "@vercel/blob";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // ---- CORS 필요하면 사용 ----
  // res.setHeader("Access-Control-Allow-Origin", "*");
  // res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  // res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  let image_url = "";

  try {
    const body = req.body || {};
    const messages_text = String(body.messages_text || "");
    const user_context = String(body.user_context || "");
    const link_url = String(body.link_url || "");
    const extra_notes = String(body.extra_notes || "");
    image_url = String(body.image_url || "").trim();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    // ---- PROMPT ----
    const prompt = `
You are a digital safety and scam-risk analysis assistant.

Return ONLY a valid JSON object.
Do not include markdown, comments, or explanations.

Schema:
{
  "summary": string,
  "risk_level": "low" | "medium" | "high",
  "confidence": number,
  "red_flags": string[],
  "inconsistencies": string[],
  "next_steps": string[]
}

messages_text:
${messages_text}

user_context:
${user_context}

link_url:
${link_url}

extra_notes:
${extra_notes}
`.trim();

    // ---- Gemini init ----
    const genAI = new GoogleGenerativeAI(apiKey);

    // ❗ 핵심 수정: gemini-pro ❌ → gemini-2.0-flash ✅
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    // ---- parts (text + optional image) ----
    const parts: any[] = [{ text: prompt }];

    if (image_url) {
      try {
        const resp = await fetch(image_url);
        if (resp.ok) {
          const contentType = resp.headers.get("content-type") || "";
          const len = resp.headers.get("content-length");
          const size = len ? Number(len) : NaN;

          if (!Number.isNaN(size) && size > 5 * 1024 * 1024) {
            parts[0].text += `\n\nIMAGE_NOTE: Image too large (${size} bytes).`;
          } else if (!contentType.startsWith("image/")) {
            parts[0].text += `\n\nIMAGE_NOTE: Not an image (${contentType}).`;
          } else {
            const buf = await resp.arrayBuffer();
            const b64 = Buffer.from(buf).toString("base64");

            parts.push({
              inlineData: {
                mimeType: contentType || "image/jpeg",
                data: b64,
              },
            });
          }
        } else {
          parts[0].text += `\n\nIMAGE_NOTE: Failed to fetch image (${resp.status}).`;
        }
      } catch (e: any) {
        parts[0].text += `\n\nIMAGE_NOTE: ${String(e?.message || e)}`;
      }
    }

    // ---- Gemini call ----
    const result = await model.generateContent(parts);
    const text = result.response.text();

    // ---- JSON parsing (robust) ----
    let parsed: any = null;

    try {
      parsed = JSON.parse(text);
    } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        try {
          parsed = JSON.parse(text.slice(start, end + 1));
        } catch {
          parsed = null;
        }
      }
    }

    // ---- normalize output ----
    if (parsed && typeof parsed === "object") {
      parsed.summary = typeof parsed.summary === "string" ? parsed.summary : "";
      parsed.risk_level =
        parsed.risk_level === "low" ||
        parsed.risk_level === "medium" ||
        parsed.risk_level === "high"
          ? parsed.risk_level
          : "medium";

      const conf = Number(parsed.confidence);
      parsed.confidence =
        Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0;

      parsed.red_flags = Array.isArray(parsed.red_flags)
        ? parsed.red_flags
        : [];
      parsed.inconsistencies = Array.isArray(parsed.inconsistencies)
        ? parsed.inconsistencies
        : [];
      parsed.next_steps = Array.isArray(parsed.next_steps)
        ? parsed.next_steps
        : [];
    }

    // ---- cleanup vercel blob (best effort) ----
    if (image_url && image_url.includes("blob.vercel-storage.com")) {
      try {
        await del(image_url);
      } catch {}
    }

    if (!parsed) {
      return res.status(200).json({
        ok: true,
        warning: "Model did not return valid JSON",
        raw: text,
      });
    }

    return res.status(200).json(parsed);
  } catch (err: any) {
    return res.status(500).json({
      error: "Analysis failed",
      detail: String(err?.message || err),
    });
  }
};

export default handler;
