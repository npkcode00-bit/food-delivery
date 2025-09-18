// src/app/api/upload/route.js
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename") || "upload.bin";
  const contentType = req.headers.get("content-type") || "";

  // If the request is multipart/form-data, use req.formData()
  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || undefined,
    });

    return NextResponse.json({ url: blob.url });
  }

  // Otherwise treat it as a raw upload (body is the file stream)
  const blob = await put(filename, req.body, {
    access: "public",
    addRandomSuffix: true,
    contentType: contentType || undefined,
  });

  return NextResponse.json({ url: blob.url });
}
