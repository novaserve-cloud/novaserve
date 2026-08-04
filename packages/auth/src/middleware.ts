import type { NovaContext, NovaResponse } from "@novaserve/runtime";
import { JWT, type JWTPayload } from "./jwt.js";

export interface ProtectedContext extends NovaContext {
  user: JWTPayload;
}

export function protect(
  handler: (ctx: ProtectedContext) => Promise<NovaResponse>,
  secret?: string
) {
  const jwt = new JWT(secret);

  return async (ctx: NovaContext): Promise<NovaResponse> => {
    const token = ctx.bearerToken();
    if (!token) {
      return ctx.unauthorized("Missing Bearer authorization token");
    }

    const payload = jwt.verify(token);
    if (!payload) {
      return ctx.unauthorized("Invalid or expired authorization token");
    }

    (ctx as ProtectedContext).user = payload;
    return handler(ctx as ProtectedContext);
  };
}
