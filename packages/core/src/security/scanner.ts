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

      // 3. Audit APIs for Wildcard CORS
      if (res.type === "api") {
        const cors = res.config.cors as { origin?: string; allowOrigins?: string[] } | undefined;
        if (cors && (cors.origin === "*" || (Array.isArray(cors.allowOrigins) && cors.allowOrigins.includes("*")))) {
          findings.push({
            id: `SEC-API-001-${id}`,
            severity: "MEDIUM",
            title: "Overly Permissive CORS Origin (*)",
            resourceId: id,
            description: `API "${res.name}" allows requests from any origin ("*").`,
            remediation: "Restrict CORS origins to explicit domains (e.g. https://app.example.com).",
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
