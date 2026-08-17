import { GoogleAuth } from "google-auth-library";

export interface GCPCredentials {
  projectId: string;
  region: string;
  auth: GoogleAuth;
}

export class GCPAuthManager {
  /**
   * Resolves GCP credentials via GoogleAuth.
   * Checks config overrides first, then falls back to Application Default Credentials.
   */
  public static async getCredentials(config?: Record<string, unknown>): Promise<GCPCredentials> {
    const gcpConfig = (config?.gcp as Record<string, unknown>) || {};
    
    // Explicit project ID or fallback to process.env (or let auth library discover it)
    let explicitProjectId = (gcpConfig.projectId as string) || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      projectId: explicitProjectId,
      keyFilename: (gcpConfig.keyFilename as string) || process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    const resolvedProjectId = await auth.getProjectId();

    return {
      projectId: resolvedProjectId || "unknown-project",
      region: (gcpConfig.region as string) || process.env.GOOGLE_CLOUD_REGION || "us-central1",
      auth,
    };
  }

  /** Checks if GCP credentials look minimally valid */
  public static isConfigured(creds: GCPCredentials): boolean {
    return creds.projectId !== "unknown-project" && creds.auth !== undefined;
  }
}
