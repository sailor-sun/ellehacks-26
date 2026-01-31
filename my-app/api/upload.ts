import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const config = {
  runtime: "nodejs20.x",
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = (req.body || {}) as HandleUploadBody;

    const host = req.headers.host || "localhost";
    const proto =
      (req.headers["x-forwarded-proto"] as string) ||
      (host.includes("localhost") ? "http" : "https");

    // handleUpload가 표준 Request를 요구해서 Node req를 Request로 변환
    const request = new Request(`${proto}://${host}${req.url || "/api/upload"}`, {
      method: "POST",
      headers: new Headers(
        Object.entries(req.headers)
          .filter(([, v]) => typeof v === "string") as Array<[string, string]>
      ),
      body: JSON.stringify(body),
    });

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 3 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ purpose: "scam-analysis" }),
        };
      },
      onUploadCompleted: async () => {},
    });

    return res.status(200).json(jsonResponse);
  } catch (err: any) {
    return res.status(500).json({
      error: "Upload failed",
      detail: String(err?.message || err),
    });
  }
}
