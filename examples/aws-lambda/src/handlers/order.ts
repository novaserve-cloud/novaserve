import type { NovaContext } from "novaserve/runtime";

export const status = async (ctx: NovaContext) => {
  return ctx.json({
    status: "online",
    cloud: "AWS",
    runtime: "AWS Lambda (Node.js 20.x)",
    timestamp: new Date().toISOString(),
  });
};

export const submit = async (ctx: NovaContext) => {
  const body = ctx.body<{ item: string; quantity: number }>();

  if (!body?.item || !body?.quantity) {
    return ctx.badRequest("Fields 'item' and 'quantity' are required");
  }

  const orderId = `ord_${Math.random().toString(36).substring(2, 9)}`;

  return ctx.json({
    orderId,
    item: body.item,
    quantity: body.quantity,
    status: "queued",
  }, 202);
};
