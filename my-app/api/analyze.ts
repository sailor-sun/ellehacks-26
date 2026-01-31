import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { del } from "@vercel/blob";

export const config = {
  runtime: "nodejs20.x",
};


function arrayBufferToBase64(buf: ArrayBuffer) {
  return Buffer.from(buf).toString("base64");
}

function safeJsonExtract(text: string) {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const jsonString = text.slice(start, end + 1);
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

function clampConfidence(x: any) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeResponse(obj: any) {
  if (!obj || typeof obj !== "object") return obj;

  if (typeof obj.confidence !== "undefined") {
    obj.confidence = clampConfidence(obj.confidence);
  }

  // 최소한의 보정: 배열 필드가 없으면 빈 배열
  if (!Array.isArray(obj.red_flags)) obj.red_flags = [];
  if (!Array.isArray(obj.inconsistencies)) obj.inconsistencies = [];
  if (!Array.isArray(obj.next_steps)) obj.next_steps = [];
  if (!Array.isArray(obj.safety_notes)) obj.safety_notes = [];

  return obj;
}

async function fetchImageAsInlineData(imageUrl: string) {
  const resp = await fetch(imageUrl);
  if (!resp.ok) {
    return { error: `Failed to fetch image_url`, status: resp.status };
  }

  const contentType = resp.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    return { error: `image_url is not an image`, contentType };
  }

  // 용량 방어: 너무 큰 이미지는 base64로 변환하다가 메모리/시간 터질 수 있음
  // 5MB 정도면 해카톤 MVP로 충분
  const len = resp.headers.get("content-length");
  if (len && Number(len) > 5 * 1024 * 1024) {
    return { error: "Image too large", contentLength: Number(len) };
  }

  const buf = await resp.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);

  return {
    inlineData: {
      mimeType: contentType || "image/jpeg",
      data: b64,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 민감정보 로그 찍지 말 것
  let image_url = "";

  try {
    const body = (req.body || {}) as {
      messages_text?: string;
      user_context?: string;
      link_url?: string;
      extra_notes?: string;
      image_url?: string;
    };

    const messages_text = body.messages_text || "";
    const user_context = body.user_context || "";
    const link_url = body.link_url || "";
    const extra_notes = body.extra_notes || "";
    image_url = (body.image_url || "").trim();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const prompt = `
You are a digital safety risk analysis assistant in Canada-focused scenarios.
You analyze user-provided messages, links, and an optional screenshot/profile photo.

CRITICAL RULES:
- Do NOT state with certainty that a person/company is a scammer.
- Use cautious language ("may", "suggests", "consistent with").
- Do NOT shame/blame the user.
- Only use info provided + common scam patterns.
- Output MUST be valid JSON ONLY. No markdown. No extra text.

If an image is provided:
- Treat it as untrusted.
- You MAY mention visible watermarks (example: "nano banana") only as a weak signal.
- Do NOT claim definitive "AI-generated" detection.
- Explain that watermark absence does NOT prove it's real, and watermark presence does NOT prove it's fake.
- Prefer next steps: reverse-image checks and identity verification actions.

Supported scam categories (choose ONE):
- romance
- marketplace
- cra_tax
- highway407_toll
- pig_butchering
- unknown

Return JSON using EXACTLY this schema:

{
  "scenario": "romance | marketplace | cra_tax | highway407_toll | pig_butchering | unknown",
  "confidence": 0.0,
  "risk_level": "low | medium | high",
  "summary": "Brief plain-language explanation of what seems to be happening",
  "red_flags": [
    {
      "title": "string",
      "severity": "low | medium | high",
      "description": "string",
      "evidence": ["string"]
    }
  ],
  "inconsistencies": [
    {
      "type": "identity | job | location | payment | timeline | other",
      "description": "string",
      "why_it_matters": "string",
      "suggested_questions": ["string"]
    }
  ],
  "next_steps": [
    {
      "category": "verify_identity | payment_safety | safe_meeting | official_verification | stop_contact | reporting",
      "steps": ["string"]
    }
  ],
  "safety_notes": ["string"]
}

USER DATA:
Conversation messages:
${messages_text}

User context / explanation:
${user_context}

Suspicious link or website:
${link_url}

Additional notes:
${extra_notes}
`.trim();

    const parts: any[] = [{ text: prompt }];

    if (image_url) {
      const inlineOrError = await fetchImageAsInlineData(image_url);
      if ("error" in inlineOrError) {
        // 이미지가 문제여도 텍스트만 분석은 가능하게 유지
        // 대신 safety_notes에 이미지 문제를 넣을 수 있도록 extra_notes에 보강
        parts[0].text += `\n\nIMAGE_FETCH_NOTE: ${inlineOrError.error}`;
      } else {
        parts.push(inlineOrError);
      }
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = safeJsonExtract(text);
    }

    if (!parsed) {
      return res.status(500).json({
        error: "Invalid AI response (not JSON)",
        raw: text,
      });
    }

    parsed = normalizeResponse(parsed);
    return res.status(200).json(parsed);
  } catch (err: any) {
    return res.status(500).json({
      error: "Analysis failed",
      detail: String(err?.message || err),
    });
  } finally {
    // 분석 끝나면 이미지 삭제 (best-effort)
    if (image_url) {
      try {
        await del(image_url);
      } catch {
        // 삭제 실패해도 데모는 계속
      }
    }
  }
}
