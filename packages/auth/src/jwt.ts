import { createHmac } from "node:crypto";

function base64UrlEncode(str: string | Buffer): string {
  const buf = typeof str === "string" ? Buffer.from(str) : str;
  return buf.toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export interface JWTPayload {
  sub?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

export class JWT {
  private secret: string;

  constructor(secret?: string) {
    this.secret = secret || process.env.JWT_SECRET || "default-novaserve-secret-change-me";
  }

  /**
   * Sign a payload to produce a JWT string.
   */
  sign(payload: JWTPayload, expiresInSeconds = 3600): string {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
      iat: now,
      exp: now + expiresInSeconds,
      ...payload,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

    const signature = createHmac("sha256", this.secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();

    const encodedSignature = base64UrlEncode(signature);

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Verify a JWT token and return payload if valid, null if invalid/expired.
   */
  verify<T = JWTPayload>(token: string): T | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      const expectedSignature = base64UrlEncode(
        createHmac("sha256", this.secret)
          .update(`${encodedHeader}.${encodedPayload}`)
          .digest()
      );

      if (encodedSignature !== expectedSignature) {
        return null;
      }

      const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        return null; // Expired
      }

      return payload as T;
    } catch {
      return null;
    }
  }
}
