// localStorage throws when the browser blocks storage; the archive then just forgets.
export function readStoredNumber(key: string): number {
	try {
		return Number(localStorage.getItem(key)) || 0;
	} catch {
		return 0;
	}
}

export function storeValue(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, String(value));
	} catch {}
}

export function subscribedKey(newsletterSlug: string): string {
	return `mailcheap:subscribed:${newsletterSlug}`;
}

export function subscribeSnoozedKey(newsletterSlug: string): string {
	return `mailcheap:subscribe-snoozed:${newsletterSlug}`;
}
