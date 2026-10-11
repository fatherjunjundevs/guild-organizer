import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { PublicEventConfig } from "./public-event-config";
import { readBoundedJson } from "./public-bounded-json";

// Atomic, shared Redis counters with bounded lifetime. No bearer is a key/input.
export const admissionScript = `
local a=redis.call('INCR',KEYS[1]); if a==1 then redis.call('EXPIRE',KEYS[1],60) end
if a>1000 then return 0 end
local b=redis.call('INCR',KEYS[2]); if b==1 then redis.call('EXPIRE',KEYS[2],60) end
if b>60 then return 0 end; return 1`;

export async function admitPublicRequest(request: Request, config: PublicEventConfig,
  transport: typeof fetch = fetch): Promise<"allowed" | "limited" | "unavailable"> {
  try {
    // Operator-owned proxy MUST strip client-supplied copies of these headers.
    const proof = request.headers.get("x-go-proxy-key") ?? "";
    if (!/^[a-f0-9]{64}$/.test(proof) || !timingSafeEqual(Buffer.from(proof, "hex"), config.proxyKey())) return "unavailable";
    const ip = request.headers.get("x-go-client-ip") ?? "";
    if (!isIP(ip)) return "unavailable";
    // URL canonicalizes equivalent IPv6 spellings; IPv4 input is already strict.
    const canonical = isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
    const identity = createHmac("sha256", config.admissionKey()).update(canonical).digest("hex");
    const response = await transport(config.redisUrl, { method: "POST", cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${config.admissionCredential()}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(1500), body: JSON.stringify(["EVAL", admissionScript, "2", "go:{public}:global", `go:{public}:ip:${identity}`]) });
    if (!response.ok) return "unavailable";
    // The REST provider must implement the Redis command/result contract.
    const result = await readBoundedJson(response.body, 128, 1500);
    if (!result || typeof result !== "object" || Object.keys(result).length !== 1 || !("result" in result)) return "unavailable";
    return result.result === 1 ? "allowed" : result.result === 0 ? "limited" : "unavailable";
  } catch { return "unavailable"; }
}
