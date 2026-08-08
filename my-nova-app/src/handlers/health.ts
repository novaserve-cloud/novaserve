import type { NovaContext } from "novaserve/runtime";

export const handler = async (ctx: NovaContext) => {
  return ctx.json({
    status: "healthy",
    uptime: process.uptime(),
    version: "0.1.0",
  });
};
