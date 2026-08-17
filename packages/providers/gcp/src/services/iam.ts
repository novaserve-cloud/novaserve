/**
 * GCP IAM Service
 *
 * Declarative Security: Binds least-privilege roles for function dependencies.
 */

import { ProjectsClient } from "@google-cloud/resource-manager";
import { gcpRetry } from "../utils/retry.js";

export const GCP_BUILTIN_ROLES: Record<string, string> = {
  storage: "roles/storage.objectViewer",
  database: "roles/cloudsql.client",
  pubsub: "roles/pubsub.publisher",
  queue: "roles/pubsub.publisher",
  secret: "roles/secretmanager.secretAccessor",
  cache: "roles/redis.editor",
};

export class GCPIamService {
  private client: ProjectsClient;
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.client = new ProjectsClient();
  }

  /**
   * Assigns least-privilege roles to a service account based on dependencies.
   * Note: In a production GCP environment, it is better to bind IAM policy to the specific resource
   * (e.g. bucket.iam.setPolicy) rather than project-level. For this scaffolding,
   * we attach the role at the project level to the default compute service account.
   */
  public async assignRole(dependencyType: string, serviceAccountEmail?: string): Promise<void> {
    const role = GCP_BUILTIN_ROLES[dependencyType];
    if (!role) return;

    // Default compute engine service account if none provided
    const sa = serviceAccountEmail || `PROJECT_NUMBER-compute@developer.gserviceaccount.com`;
    const resource = `projects/${this.projectId}`;

    await gcpRetry(async () => {
      const [policy] = await this.client.getIamPolicy({ resource });
      
      const binding = policy.bindings?.find(b => b.role === role);
      if (binding) {
        if (!binding.members?.includes(`serviceAccount:${sa}`)) {
          binding.members?.push(`serviceAccount:${sa}`);
        }
      } else {
        policy.bindings = policy.bindings || [];
        policy.bindings.push({
          role,
          members: [`serviceAccount:${sa}`],
        });
      }

      await this.client.setIamPolicy({
        resource,
        policy,
      });
    });
  }
}
