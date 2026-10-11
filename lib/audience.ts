// Most engaged first, so warm-up sends capped by audienceLimit reach likely openers.
export const AUDIENCE_SORT = {
	lastClickAt: -1,
	lastOpenAt: -1,
	"imported.clickRate": -1,
	"imported.openRate": -1,
	createdAt: 1,
	_id: 1,
};

export interface AudienceContact {
	status: string;
	email: string;
	[key: string]: unknown;
}

function normalizeLimit(audienceLimit: unknown): number | null {
	const limit = Number(audienceLimit);
	return Number.isInteger(limit) && limit > 0 ? limit : null;
}

export function buildAudienceQuery({ newsletterId, suppressedEmails = [], audienceLimit }: { newsletterId: unknown; suppressedEmails?: string[]; audienceLimit?: unknown }) {
	const filter: { newsletterId: unknown; status: string; email?: { $nin: string[] } } = { newsletterId, status: "active" };
	if (suppressedEmails.length > 0) filter.email = { $nin: suppressedEmails };
	return { filter, sort: AUDIENCE_SORT, limit: normalizeLimit(audienceLimit) };
}

function readPath(document: unknown, path: string): unknown {
	return path.split(".").reduce((value: unknown, key: string) => (value as Record<string, unknown>)?.[key], document);
}

function toComparable(value: unknown): unknown {
	if (value instanceof Date) return value.getTime();
	if (typeof value === "object") return String(value);
	return value;
}

// Same order as MongoDB: a missing value is the lowest, so it sorts last when descending.
function compareValues(left: unknown, right: unknown, direction: number): number {
	const isLeftMissing = left == null;
	const isRightMissing = right == null;
	if (isLeftMissing || isRightMissing) {
		if (isLeftMissing && isRightMissing) return 0;
		return (isLeftMissing ? -1 : 1) * direction;
	}
	const a = toComparable(left);
	const b = toComparable(right);
	if (a === b) return 0;
	return ((a as number | string) < (b as number | string) ? -1 : 1) * direction;
}

export function compareByEngagement(left: unknown, right: unknown): number {
	for (const [path, direction] of Object.entries(AUDIENCE_SORT)) {
		const result = compareValues(readPath(left, path), readPath(right, path), direction);
		if (result !== 0) return result;
	}
	return 0;
}

export function selectAudience(contacts: AudienceContact[], { suppressedEmails = [], audienceLimit }: { suppressedEmails?: string[]; audienceLimit?: unknown } = {}) {
	const suppressed = new Set(suppressedEmails);
	const limit = normalizeLimit(audienceLimit);
	const audience = contacts
		.filter(({ status, email }) => status === "active" && !suppressed.has(email))
		.toSorted(compareByEngagement);
	return limit ? audience.slice(0, limit) : audience;
}
