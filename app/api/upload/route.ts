import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Local-disk upload endpoint (dev convention: UPLOAD_DIR under /public).
// Accepts images + PDF up to 8 MB; returns the public URL of the stored file.

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop lourd (max 8 Mo)" }, { status: 413 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Type non autorisé (images ou PDF uniquement)" },
      { status: 415 }
    );
  }

  const dir = process.env.UPLOAD_DIR ?? "./public/uploads";
  await mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buffer);

  return NextResponse.json({ url: `/uploads/${name}`, name: file.name });
}
