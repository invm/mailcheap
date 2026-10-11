import crypto from "node:crypto";

const API_KEY_PATTERN = /^mc_[A-Za-z0-9_-]{43}$/;
const LAST_USED_RESOLUTION_MS = 60_000;

// Only the SHA-256 hash is stored: a database leak doesn't leak usable keys.
export function hashApiKey(key: string): string {
	return crypto.createHash("sha256").update(String(key)).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
	const key = `mc_${crypto.randomBytes(32).toString("base64url")}`;
	return { key, prefix: `${key.slice(0, 10)}…`, hash: hashApiKey(key) };
}

export function readBearerToken(authorization: string | null): string | null {
	const match = /^Bearer\s+(\S+)$/i.exec(String(authorization ?? "").trim());
	return match && API_KEY_PATTERN.test(match[1]) ? match[1] : null;
}

export function shouldTouchLastUsed(lastUsedAt: Date | null | undefined, now: number = Date.now()): boolean {
	if (!lastUsedAt) return true;
	return now - new Date(lastUsedAt).getTime() >= LAST_USED_RESOLUTION_MS;
}
