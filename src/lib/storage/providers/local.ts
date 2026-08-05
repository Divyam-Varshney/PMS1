// ============================================================================
// File: src/lib/storage/providers/local.ts
// Purpose: LocalFilesystem provider — the dev/sandbox fallback. Writes to
//          public/uploads/<category>/ so files are served directly by Next.js.
//          Used automatically when no cloud provider is configured (so the app
//          works out-of-the-box in local dev). NOT suitable for Vercel
//          production (read-only filesystem).
// ============================================================================

import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import {
  StorageProvider,
  StorageError,
  FileCategory,
  UploadResult,
  UploadOptions,
  StorageConfig,
  PRIVATE_CATEGORIES,
  validateImageFile,
  generateKey,
} from "../types";

const FOLDER_MAP: Record<FileCategory, string> = {
  products: "products",
  brands: "brands",
  categories: "categories",
  "qr-codes": "qr",
  store: "store",
  prescriptions: "prescriptions",
  payments: "payments",
  reviews: "reviews",
};

export class LocalProvider implements StorageProvider {
  readonly id = "local" as const;
  private baseDir = path.join(process.cwd(), "public", "uploads");
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  private dir(category: FileCategory): string {
    return path.join(this.baseDir, FOLDER_MAP[category]);
  }

  async upload(
    category: FileCategory,
    file: File | Buffer,
    opts?: UploadOptions
  ): Promise<UploadResult> {
    let buffer: Buffer;
    let mime: string;
    let originalName: string;
    let size: number;

    if (file instanceof File) {
      mime = validateImageFile(file, this.config.allowedMimeTypes, this.config.maxFileSize);
      buffer = Buffer.from(await file.arrayBuffer());
      originalName = file.name;
      size = file.size;
    } else {
      // Buffer (URL import) — skip MIME validation, just check size.
      mime = "image/png";
      buffer = file;
      originalName = opts?.filename || "imported";
      size = buffer.length;
      if (size > this.config.maxFileSize) {
        throw new StorageError("File too large", 400);
      }
    }

    await mkdir(this.dir(category), { recursive: true });
    const key = generateKey(category, { name: originalName, type: mime }, opts);
    await writeFile(path.join(this.dir(category), key), buffer);

    // Public categories: served directly from /public/uploads. Private
    // categories: routed through /api/file proxy (authenticated).
    const url = PRIVATE_CATEGORIES.has(category)
      ? `/api/file/${category}/${key}`
      : `/uploads/${FOLDER_MAP[category]}/${key}`;

    return { url, key, size, contentType: mime, originalName };
  }

  async delete(category: FileCategory, urlOrKey: string): Promise<void> {
    try {
      const filename = urlOrKey.split("/").pop() || urlOrKey;
      const full = path.join(this.dir(category), filename);
      if (existsSync(full)) await unlink(full);
    } catch {
      /* best-effort */
    }
  }

  getPublicUrl(category: FileCategory, key: string): string {
    return `/uploads/${FOLDER_MAP[category]}/${key}`;
  }

  async getSignedUrl(
    category: FileCategory,
    key: string,
    _expiresIn = 3600
  ): Promise<string> {
    // Dev mode — no auth, just return the proxy path.
    return `/api/file/${category}/${key}`;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await mkdir(this.baseDir, { recursive: true });
      return { ok: true, message: "Local filesystem is ready (dev mode)." };
    } catch (e: any) {
      return { ok: false, message: `Cannot write to ${this.baseDir}: ${e.message}` };
    }
  }
}

/** Read a private-category file from disk (used by the /api/file proxy). */
export async function readLocalPrivateFile(
  category: FileCategory,
  key: string
): Promise<{ data: Buffer; contentType: string }> {
  const full = path.join(process.cwd(), "public", "uploads", FOLDER_MAP[category], key);
  if (!existsSync(full)) throw new StorageError("File not found", 404);
  const data = await readFile(full);
  const ext = key.split(".").pop()?.toLowerCase() || "";
  const contentType =
    ext === "png" ? "image/png" :
    ext === "webp" ? "image/webp" :
    ext === "gif" ? "image/gif" : "image/jpeg";
  return { data, contentType };
}
