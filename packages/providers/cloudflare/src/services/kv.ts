/**
 * Cloudflare KV Namespace Service
 *
 * Manages Cloudflare Workers KV namespaces with full CRUD lifecycle.
 * Supports idempotent operations by resolving existing namespaces before creating.
 */

import type { CloudflareApiClient } from "../utils/api-client.js";
import type { CloudflareKVNamespace } from "../types.js";

export class CloudflareKVService {
  private client: CloudflareApiClient;

  constructor(client: CloudflareApiClient) {
    this.client = client;
  }

  /**
   * Create a KV namespace.
   *
   * Idempotent: checks if a namespace with the same title already exists.
   * If it does, returns the existing namespace ID.
   *
   * @returns Namespace ID
   */
  public async createNamespace(title: string): Promise<string> {
    // Check for existing namespace with this title
    const existing = await this.findNamespaceByTitle(title);
    if (existing) {
      return existing.id;
    }

    const result = await this.client.post<CloudflareKVNamespace>(
      "/storage/kv/namespaces",
      "createKVNamespace",
      { title },
      { resource: title }
    );

    return result?.id || "";
  }

  /**
   * Get a KV namespace by ID.
   */
  public async getNamespace(
    namespaceId: string
  ): Promise<CloudflareKVNamespace | null> {
    try {
      return await this.client.get<CloudflareKVNamespace>(
        `/storage/kv/namespaces/${namespaceId}`,
        "getKVNamespace",
        { resource: namespaceId }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "CloudflareResourceNotFoundError"
      ) {
        return null;
      }
      throw err;
    }
  }

  /**
   * List all KV namespaces in the account.
   * Handles pagination automatically.
   */
  public async listNamespaces(): Promise<CloudflareKVNamespace[]> {
    const allNamespaces: CloudflareKVNamespace[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const result = await this.client.get<CloudflareKVNamespace[]>(
        `/storage/kv/namespaces?page=${page}&per_page=${perPage}`,
        "listKVNamespaces"
      );

      const namespaces = result || [];
      allNamespaces.push(...namespaces);

      if (namespaces.length < perPage) {
        break;
      }
      page++;
    }

    return allNamespaces;
  }

  /**
   * Delete a KV namespace by ID.
   * Silently succeeds if the namespace doesn't exist.
   */
  public async deleteNamespace(namespaceId: string): Promise<void> {
    try {
      await this.client.delete(
        `/storage/kv/namespaces/${namespaceId}`,
        "deleteKVNamespace",
        { resource: namespaceId }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "CloudflareResourceNotFoundError"
      ) {
        return;
      }
      throw err;
    }
  }

  /**
   * Find an existing KV namespace by title.
   *
   * Used for idempotent creates — resolves existing namespaces
   * before creating new ones.
   */
  public async findNamespaceByTitle(
    title: string
  ): Promise<CloudflareKVNamespace | null> {
    const namespaces = await this.listNamespaces();
    return namespaces.find((ns) => ns.title === title) || null;
  }
}
