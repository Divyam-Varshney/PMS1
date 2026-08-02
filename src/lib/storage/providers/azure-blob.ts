// ============================================================================
// File: src/lib/storage/providers/azure-blob.ts
// Purpose: Azure Blob Storage provider — uses the native @azure/storage-blob
//          SDK (not S3 interop) for full feature support. Files are organized
//          by category folders inside a single container. Public categories
//          use the blob public URL (if the container access level allows it);
//          private categories use SAS (Shared Access Signature) URIs.
// ============================================================================

import {
  BlobServiceClient,
  ContainerClient,
  BlockBlobClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
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

export class AzureBlobProvider implements StorageProvider {
  readonly id = "azure-blob" as const;
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  private containerName: string;
  private publicBaseUrl: string;
  private accountName: string;
  private sharedKeyCredential: StorageSharedKeyCredential;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    const az = config.azure;
    if (!az?.connectionString || !az?.containerName) {
      throw new StorageError(
        "Azure Blob Storage requires connectionString and containerName",
        500
      );
    }
    this.config = config;
    this.containerName = az.containerName;

    // Extract account name from the connection string (AccountName=...).
    const accountMatch = az.connectionString.match(/AccountName=([^;]+)/);
    this.accountName = az.accountName || (accountMatch?.[1] ?? "");

    // Extract account key for SAS generation.
    const keyMatch = az.connectionString.match(/AccountKey=([^;]+)/);
    const accountKey = keyMatch?.[1] ?? "";

    if (!this.accountName || !accountKey) {
      throw new StorageError(
        "Azure connection string must contain AccountName and AccountKey",
        500
      );
    }

    this.sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, accountKey);
    this.blobServiceClient = BlobServiceClient.fromConnectionString(az.connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);

    // Public base URL — custom domain or default blob core URL.
    this.publicBaseUrl = (
      az.publicBaseUrl ||
      `https://${this.accountName}.blob.core.windows.net/${this.containerName}`
    ).replace(/\/$/, "");
  }

  /** Build the full blob name: [pathPrefix/][category]/[filename]. */
  private blobName(category: FileCategory, key: string): string {
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
    const fullBlobName = this.blobName(category, key);
    const blockBlobClient: BlockBlobClient = this.containerClient.getBlockBlobClient(fullBlobName);

    await withRetry(
      () =>
        blockBlobClient.uploadData(buffer, {
          blobHTTPHeaders: {
            blobContentType: mime,
            blobCacheControl: "public, max-age=3600",
          },
        }),
      this.config.maxRetries,
      this.config.retryBackoffMs,
      "Azure upload"
    ).catch((e: any) => {
      throw new StorageError(`Azure Blob upload failed: ${e.message}`, 500);
    });

    const isPrivate = PRIVATE_CATEGORIES.has(category);
    const url = isPrivate
      ? `/api/file/${category}/${key}`
      : `${this.publicBaseUrl}/${fullBlobName}`;

    return { url, key, size, contentType: mime, originalName };
  }

  async delete(category: FileCategory, urlOrKey: string): Promise<void> {
    try {
      const key = urlOrKey.split("/").pop() || urlOrKey;
      const fullBlobName = this.blobName(category, key);
      const blockBlobClient = this.containerClient.getBlockBlobClient(fullBlobName);
      await blockBlobClient.deleteIfExists();
    } catch (e) {
      console.error(`[storage:azure] delete failed:`, e);
    }
  }

  getPublicUrl(category: FileCategory, key: string): string {
    const fullBlobName = this.blobName(category, key);
    return `${this.publicBaseUrl}/${fullBlobName}`;
  }

  async getSignedUrl(
    category: FileCategory,
    key: string,
    expiresIn?: number
  ): Promise<string> {
    const fullBlobName = this.blobName(category, key);
    const blockBlobClient = this.containerClient.getBlockBlobClient(fullBlobName);
    const expiry = expiresIn ?? this.config.signedUrlExpiry ?? 3600;
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiry * 1000);

    try {
      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName: fullBlobName,
          permissions: BlobSASPermissions.parse("r"), // read-only
          startsOn,
          expiresOn,
        },
        this.sharedKeyCredential
      ).toString();

      return `${blockBlobClient.url}?${sasToken}`;
    } catch (e: any) {
      throw new StorageError(`Failed to generate Azure SAS URL: ${e.message}`, 500);
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      // Verify the container exists + credentials are valid by fetching
      // container properties.
      const exists = await this.containerClient.exists();
      if (!exists) {
        return {
          ok: false,
          message: `Azure Blob container "${this.containerName}" does not exist. Create it in the Azure Portal first.`,
        };
      }
      return {
        ok: true,
        message: `Connected to Azure Blob container "${this.containerName}" (account: ${this.accountName}) successfully.`,
      };
    } catch (e: any) {
      return {
        ok: false,
        message: `Azure Blob connection failed: ${e.message}. Check the connection string and container name.`,
      };
    }
  }
}
