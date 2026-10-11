import { getAppUrl } from "./config.ts";
import { createContactToken, verifyContactToken } from "./contact-token.ts";
import type { ContactTokenReference } from "./contact-token.ts";

// The "Yes, keep sending it" button of the last-chance email (lib/cleanup.js).
const INFO = "mailcheap-keep-v1";
// Well past the 14 days before a silent contact goes dormant: a late click still brings them back.
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function createKeepToken({ contactId, newsletterId }: { contactId: unknown; newsletterId: unknown }, now: number = Date.now()): string {
	return createContactToken({ info: INFO, contactId, newsletterId }, now);
}

export function verifyKeepToken(token: unknown, now: number = Date.now()): ContactTokenReference | null {
	return verifyContactToken(token, { info: INFO, maxAgeMs: MAX_AGE_MS, now });
}

export function getKeepUrl({ contactId, newsletterId }: { contactId: unknown; newsletterId: unknown }): string {
	return `${getAppUrl()}/keep?token=${createKeepToken({ contactId, newsletterId })}`;
}
