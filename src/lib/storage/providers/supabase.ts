// ============================================================================
// File: src/lib/storage/providers/supabase.ts
// Purpose: Supabase Storage provider. Uses @supabase/supabase-js. Files go
//          into a single configurable bucket, organized by category folders
//          (products/, brands/, prescriptions/, etc.). Public categories use
//          Supabase's CDN URL; private categories use signed URLs.
// ============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  withRetry,
} from "../types";

export class SupabaseProvider implements StorageProvider {
  readonly id = "supabase" as const;
  private client: SupabaseClient;
  private bucket: string;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    const sb = config.supabase;
    if (!sb?.url || !sb?.serviceRoleKey || !sb?.bucket) {
      throw new StorageError(
        "Supabase provider requires url, serviceRoleKey, and bucket",
        500
      );
    }
    this.config = config;
    this.bucket = sb.bucket;
    this.client = createClient(sb.url, sb.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Build the folder path: [pathPrefix/][category]/[filename]. */
  private objectPath(category: FileCategory, key: string): string {
    const prefix = this.config.pathPrefix
      ? `${this.config.pathPrefix.replace(/^\/|\/$/g, "")}/`
      : "";
    return `${prefix}${category}/${key}`;
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
      mime = "image/png";
      buffer = file;
      originalName = opts?.filename || "imported";
      size = buffer.length;
      if (size > this.config.maxFileSize) {
        throw new StorageError("File too large", 400);
      }
    }

    const key = generateKey(category, { name: originalName, type: mime }, opts);
    const fullPath = this.objectPath(category, key);

    // Wrap the Supabase upload in withRetry for transient failure resilience.
    const { error } = await withRetry(
      () =>
        this.client.storage.from(this.bucket).upload(fullPath, buffer, {
          contentType: mime,
          cacheControl: "3600",
          upsert: false,
        }),
      this.config.maxRetries,
      this.config.retryBackoffMs,
      "Supabase upload"
    );

    if (error) {
      throw new StorageError(`Supabase upload failed: ${error.message}`, 500);
    }

    const isPrivate = PRIVATE_CATEGORIES.has(category);
    const url = isPrivate
      ? `/api/file/${category}/${key}`
      : this.getPublicUrl(category, key);

    return { url, key, size, contentType: mime, originalName };
  }

  async delete(category: FileCategory, urlOrKey: string): Promise<void> {
    try {
      const key = urlOrKey.split("/").pop() || urlOrKey;
      const fullPath = this.objectPath(category, key);
      const { error } = await this.client.storage
        .from(this.bucket)
        .remove([fullPath]);
      if (error) {
        console.error(`[storage:supabase] delete failed:`, error.message);
      }
    } catch (e) {
      console.error(`[storage:supabase] delete error:`, e);
    }
  }

  getPublicUrl(category: FileCategory, key: string): string {
    const fullPath = this.objectPath(category, key);
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(fullPath);
    return data.publicUrl;
  }

  async getSignedUrl(
    category: FileCategory,
    key: string,
    expiresIn = 3600
  ): Promise<string> {
    const fullPath = this.objectPath(category, key);
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(fullPath, expiresIn);
    if (error || !data?.signedUrl) {
      throw new StorageError(
        `Failed to generate signed URL: ${error?.message || "unknown"}`,
        500
      );
    }
    return data.signedUrl;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      // List up to 1 object to verify bucket access + credentials.
      const { error } = await this.client.storage
        .from(this.bucket)
        .list("", { limit: 1 });
      if (error) {
        return {
          ok: false,
          message: `Connection failed: ${error.message}. Verify the bucket "${this.bucket}" exists and the service_role key is correct.`,
        };
      }
      return {
        ok: true,
        message: `Connected to Supabase bucket "${this.bucket}" successfully.`,
      };
    } catch (e: any) {
      return {
        ok: false,
        message: `Connection failed: ${e.message}`,
      };
    }
  }
}
