/**
 * Nova Security & Audit Engine
 *
 * Scans Nova IR graphs, permissions, and app configurations for security risks,
 * wildcard IAM policies, exposed secrets, public buckets, and insecure CORS.
 */

import type { NovaIRGraph } from "../ir/schema.js";

export type SecuritySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface SecurityFinding {
  id: string;
  severity: SecuritySeverity;
  title: string;
  resourceId: string;
  description: string;
  remediation: string;
}

export interface SecurityReport {
  timestamp: string;
  appName: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: SecurityFinding[];
}

export class NovaSecurityScanner {
  public static scan(ir: NovaIRGraph): SecurityReport {
    const findings: SecurityFinding[] = [];

    // 1. Audit Permissions for Wildcards
    for (const perm of ir.permissions || []) {
      if (perm.actions.includes("*")) {
        findings.push({
          id: `SEC-IAM-001-${perm.id}`,
          severity: "CRITICAL",
          title: "Wildcard IAM Action Permission Detected",
          resourceId: perm.targetFunction,
          description: `Function "${perm.targetFunction}" has wildcard "Action: '*'" permissions.`,
          remediation: "Restrict permissions to explicit IAM actions (e.g. s3:GetObject, sqs:SendMessage).",
        });
      }

      if (perm.resources.includes("*") && perm.actions.some((a) => a.startsWith("s3:") || a.startsWith("dynamodb:"))) {
        findings.push({
          id: `SEC-IAM-002-${perm.id}`,
          severity: "HIGH",
          title: "Unscoped Resource ARN in IAM Policy",
          resourceId: perm.targetFunction,
          description: `Function "${perm.targetFunction}" can access all resources ("*") for actions: ${perm.actions.join(", ")}.`,
          remediation: "Scope resource ARNs to specific bucket or table ARNs.",
        });
      }
    }

    // 2. Audit Storage Buckets for Public Exposure
    for (const [id, res] of Object.entries(ir.resources)) {
      if (res.type === "storage") {
        if (res.config.public === true) {
          findings.push({
            id: `SEC-STR-001-${id}`,
            severity: "HIGH",
            title: "Public Storage Bucket Configured",
            resourceId: id,
            description: `Storage bucket "${res.name}" is configured with public access enabled.`,
            remediation: "Set public: false and access object resources via signed URLs.",
          });
        }
      }

      // 4. Audit environment variables for hardcoded secrets
      if (res.type === "function") {
        const env = (res.config.environment as Record<string, string>) || {};
        for (const [key, val] of Object.entries(env)) {
          if (
            /secret|password|key|token|auth/i.test(key) &&
            !val.startsWith("secret:") &&
            !val.startsWith("process.env")
          ) {
            findings.push({
              id: `SEC-ENV-001-${id}-${key}`,
              severity: "HIGH",
              title: "Potential Hardcoded Secret in Environment Variable",
              resourceId: id,
              description: `Function "${res.name}" has hardcoded secret variable "${key}".`,
              remediation: "Use NovaServe secret() vault or AWS Secrets Manager reference instead of plain-text string.",
            });
          }
        }

        // 5b. Audit functions with no timeout (unbounded execution risk)
        if (!res.config.timeout) {
          findings.push({
            id: `SEC-FN-001-${id}`,
            severity: "MEDIUM",
            title: "Function Has No Timeout Configured",
            resourceId: id,
            description: `Function "${res.name}" does not specify a timeout. Unbounded execution can lead to runaway costs and DoS.`,
            remediation: "Set an explicit timeout (e.g. timeout: 30) to limit function execution duration.",
          });
        }
      }

      // 5. Audit Storage Buckets for Encryption
      if (res.type === "storage" && res.config.encryption === false) {
        findings.push({
          id: `SEC-STR-002-${id}`,
          severity: "HIGH",
          title: "Unencrypted Storage Bucket Configured",
          resourceId: id,
          description: `Storage bucket "${res.name}" has server-side encryption disabled.`,
          remediation: "Enable SSE-S3 AES256 or KMS encryption for all stored objects.",
        });
      }

      // 6. Audit Database resources for encryption at rest
      if (res.type === "database" && res.config.encryption === false) {
        findings.push({
          id: `SEC-DB-001-${id}`,
          severity: "HIGH",
          title: "Unencrypted Database Configured",
          resourceId: id,
          description: `Database "${res.name}" has encryption at rest disabled.`,
          remediation: "Enable server-side encryption for all DynamoDB tables or database instances.",
        });
      }

      // 7. Audit API resources for wildcard CORS origins
      if (res.type === "api") {
        const cors = res.config.cors as { allowOrigins?: string[] } | undefined;
        if (cors?.allowOrigins?.includes("*")) {
          findings.push({
            id: `SEC-API-001-${id}`,
            severity: "MEDIUM",
            title: "Wildcard CORS Origin Configured",
            resourceId: id,
            description: `API "${res.name}" allows requests from all origins ("*"). This exposes the API to cross-origin attacks.`,
            remediation: "Restrict CORS allowOrigins to your specific frontend domain(s).",
          });
        }
      }
    }

    // Sort findings by severity priority
    const severityOrder: Record<SecuritySeverity, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    findings.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

    return {
      timestamp: new Date().toISOString(),
      appName: ir.app.name,
      totalFindings: findings.length,
      criticalCount: findings.filter((f) => f.severity === "CRITICAL").length,
      highCount: findings.filter((f) => f.severity === "HIGH").length,
      mediumCount: findings.filter((f) => f.severity === "MEDIUM").length,
      lowCount: findings.filter((f) => f.severity === "LOW").length,
      findings,
    };
  }
}
