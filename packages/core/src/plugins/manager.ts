/**
 * Nova Plugin Architecture & Security Manager
 *
 * Provides a capability-gated plugin system where plugins (e.g. Stripe, Prisma, Resend)
 * declare required capabilities and contribute resources or compiler transforms safely.
 */

export type PluginCapability = "read-ir" | "add-resource" | "transform-ir" | "dashboard-panel";

export interface NovaPluginPackage {
  name: string;
  version: string;
  author?: string;
  description: string;
  requiredCapabilities: PluginCapability[];
  contributes?: {
    resources?: string[];
    commands?: string[];
  };
}

export class NovaPluginManager {
  private static registeredPlugins: Map<string, NovaPluginPackage> = new Map();

  /** Register a new plugin package */
  public static register(plugin: NovaPluginPackage): void {
    this.registeredPlugins.set(plugin.name, plugin);
  }

  /** List installed plugins */
  public static list(): NovaPluginPackage[] {
    return Array.from(this.registeredPlugins.values());
  }

  /** Install predefined marketplace plugin (e.g. stripe, prisma, resend) */
  public static install(pluginName: string): NovaPluginPackage {
    const knownPlugins: Record<string, NovaPluginPackage> = {
      stripe: {
        name: "novaserve-plugin-stripe",
        version: "1.0.0",
        description: "Stripe Webhook handler & API key vault integration",
        requiredCapabilities: ["add-resource", "read-ir"],
        contributes: { resources: ["stripeWebhookApi", "stripeKeySecret"], commands: ["stripe:test"] },
      },
      prisma: {
        name: "novaserve-plugin-prisma",
        version: "1.0.0",
        description: "Prisma ORM schema bundler & connection pooler",
        requiredCapabilities: ["transform-ir", "read-ir"],
        contributes: { resources: ["prismaSchema"], commands: ["prisma:generate"] },
      },
      resend: {
        name: "novaserve-plugin-resend",
        version: "1.0.0",
        description: "Resend Email API template queue integration",
        requiredCapabilities: ["add-resource"],
        contributes: { resources: ["emailQueue"], commands: ["resend:send"] },
      },
    };

    const target = knownPlugins[pluginName.toLowerCase()];
    if (!target) {
      throw new Error(`Plugin "${pluginName}" not found in Nova marketplace index.`);
    }

    this.register(target);
    return target;
  }
}
