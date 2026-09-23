import type { NovaContext } from "novaserve/runtime";

export const handler = async (ctx: NovaContext) => {
  return ctx.json({
    message: "Hello from NovaServe! 🚀",
    timestamp: new Date().toISOString(),
  });
};
