// ❌ import 쓰지 말 것
// import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ✅ CommonJS require
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const { del } = require("@vercel/blob");

    const body = req.body || {};
    const image_url = (body.image_url || "").trim();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    // 🔥 테스트용: 여기까지만 살아나는지 먼저 확인
    return res.status(200).json({
      ok: true,
      note: "handler reached",
    });

    // ⬇️ 여기 아래에 원래 Gemini 로직을 다시 붙이면 됨
  } catch (err: any) {
    return res.status(500).json({
      error: "Analysis failed",
      detail: String(err?.message || err),
    });
  }
}
