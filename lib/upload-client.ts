"use client";

// Browser-side helper for the /api/upload endpoint.
export async function uploadFile(file: File): Promise<{ url: string; name: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? "Échec de l'upload");
  }
  return data as { url: string; name: string };
}
