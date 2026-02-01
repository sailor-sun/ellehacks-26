// my-app/api/upload.ts (CJS only)

declare const require: any;

const handler = async (req: any, res: any) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { put } = require("@vercel/blob");
    const formidableLib = require("formidable");
    const formidable = formidableLib.default || formidableLib; // ESM/CJS 호환
    const fs = require("fs");

    const form = formidable({ multiples: false });

    const { files } = await new Promise<any>((resolve, reject) => {
      form.parse(req, (err: any, _fields: any, files: any) => {
        if (err) reject(err);
        else resolve({ files });
      });
    });

    const fileAny = files?.file;
    if (!fileAny) return res.status(400).json({ error: "Missing file" });

    const f = Array.isArray(fileAny) ? fileAny[0] : fileAny;

    const filePath = f.filepath;
    const originalName = f.originalFilename || `upload-${Date.now()}`;
    const mime = f.mimetype || "application/octet-stream";

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
};

module.exports = handler;
