export const config = {
  api: { bodyParser: false },
};

import type { NextApiRequest, NextApiResponse } from "next";
import { put } from "@vercel/blob";
import formidable from "formidable";
import fs from "fs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({ multiples: false });

    const { files } = await new Promise<{ files: formidable.Files }>((resolve, reject) => {
      form.parse(req as any, (err, _fields, files) => {
        if (err) reject(err);
        else resolve({ files });
      });
    });

    const fileAny = (files as any).file;
    if (!fileAny) return res.status(400).json({ error: "Missing file" });

    const f = Array.isArray(fileAny) ? fileAny[0] : fileAny;

    const filePath = f.filepath as string;
    const originalName = (f.originalFilename as string) || `upload-${Date.now()}`;
    const mime = (f.mimetype as string) || "application/octet-stream";

    const data = fs.readFileSync(filePath);

    const blob = await put(originalName, data, {
      access: "public",
      contentType: mime,
      addRandomSuffix: true,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err: any) {
    return res.status(500).json({
      error: "Upload failed",
      detail: String(err?.message || err),
    });
  }
}
