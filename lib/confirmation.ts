import { getAppUrl } from "./config.ts";
import { createContactToken, verifyContactToken } from "./contact-token.ts";
import type { ContactTokenReference } from "./contact-token.ts";

// Its own key, so an unsubscribe link can never confirm a subscription or the other way around.
const INFO = "mailcheap-confirm-v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function createConfirmToken({ contactId, newsletterId }: { contactId: unknown; newsletterId: unknown }, now: number = Date.now()): string {
	return createContactToken({ info: INFO, contactId, newsletterId }, now);
}

export function verifyConfirmToken(token: unknown, now: number = Date.now()): ContactTokenReference | null {
	return verifyContactToken(token, { info: INFO, maxAgeMs: MAX_AGE_MS, now });
}

export function getConfirmUrl({ contactId, newsletterId }: { contactId: unknown; newsletterId: unknown }): string {
	return `${getAppUrl()}/confirm?token=${createConfirmToken({ contactId, newsletterId })}`;
}
