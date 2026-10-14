const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COLUMN_ALIASES = {
	email: ["email", "emailaddress", "subscriberemail", "subscriber"],
	status: ["status", "subscriptionstatus", "subscriberstatus"],
	subscribedAt: [
		"createdat",
		"created",
		"subscribedat",
		"subscribedate",
		"subscriptiondate",
		"datesubscribed",
		"signupdate",
	],
	emailsReceived: ["emailsreceived", "totalemailsreceived", "received"],
	openRate: ["openrate", "uniqueopenrate", "totalopenrate"],
	clickRate: ["clickrate", "clickthroughrate", "uniqueclickrate", "ctr"],
};

const STATUS_ALIASES = {
	active: "active",
	subscribed: "active",
	inactive: "unsubscribed",
	unsubscribed: "unsubscribed",
	bounced: "bounced",
	invalid: "bounced",
	hardbounce: "bounced",
	complained: "complained",
	spam: "complained",
	spamreport: "complained",
	pending: "dormant",
	validating: "dormant",
	needsattention: "dormant",
	dormant: "dormant",
};

// An import can only move a contact to a stricter status, never back to active.
export const STATUS_RANK = { active: 0, dormant: 1, unsubscribed: 2, bounced: 3, complained: 4 };

export const MAX_IMPORT_ROWS_PER_REQUEST = 1000;

export type ColumnMap = { email: string | null; status: string | null; subscribedAt: string | null; emailsReceived: string | null; openRate: string | null; clickRate: string | null };
export type ImportRow = Record<string, unknown>;
export type NormalizedRow = { email: string; status: string; subscribedAt: Date | string | undefined; emailsReceived: number | undefined; openRate: number | undefined; clickRate: number | undefined };

function normalizeKey(value: unknown): string {
	return String(value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

export function mapColumns(headers: string[]): ColumnMap {
	const normalized = headers.map((header) => [header, normalizeKey(header)]);
	return Object.fromEntries(
		Object.entries(COLUMN_ALIASES).map(([field, aliases]) => [
			field,
			normalized.find(([, key]) => aliases.includes(key))?.[0] ?? null,
		])
	) as ColumnMap;
}

export function normalizeEmail(value: unknown): string | null {
	const email = String(value ?? "")
		.trim()
		.toLowerCase();
	return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function normalizeStatus(value: unknown): string {
	if (value === undefined || value === null || String(value).trim() === "") return "active";
	return STATUS_ALIASES[normalizeKey(value) as keyof typeof STATUS_ALIASES] ?? "dormant";
}

export function normalizeRate(value: unknown): number | undefined {
	const text = String(value ?? "").trim();
	if (!text) return undefined;
	const number = Number.parseFloat(text.replace("%", ""));
	if (!Number.isFinite(number) || number < 0) return undefined;
	const rate = text.includes("%") || number > 1 ? number / 100 : number;
	return Math.min(rate, 1);
}

function normalizeCount(value: unknown): number | undefined {
	const number = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
	return Number.isFinite(number) ? number : undefined;
}

function normalizeDate(value: unknown): string | undefined {
	const time = Date.parse(String(value ?? ""));
	return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

export function normalizeImportRow(row: ImportRow, columns: ColumnMap, { status: statusOverride }: { status?: string } = {}) {
	const email = normalizeEmail(row[columns.email as string]);
	if (!email) return null;

	const fileStatus = columns.status ? normalizeStatus(row[columns.status]) : "active";
	const status =
		statusOverride && STATUS_RANK[statusOverride as keyof typeof STATUS_RANK] > STATUS_RANK[fileStatus as keyof typeof STATUS_RANK] ? statusOverride : fileStatus;

	return {
		email,
		status,
		subscribedAt: columns.subscribedAt ? normalizeDate(row[columns.subscribedAt]) : undefined,
		emailsReceived: columns.emailsReceived ? normalizeCount(row[columns.emailsReceived]) : undefined,
		openRate: columns.openRate ? normalizeRate(row[columns.openRate]) : undefined,
		clickRate: columns.clickRate ? normalizeRate(row[columns.clickRate]) : undefined,
	};
}

function optionalNumber(value: unknown, max: number): number | undefined {
	const number = Number(value);
	return value === undefined || value === null || !Number.isFinite(number) || number < 0
		? undefined
		: Math.min(number, max);
}

// Server side: rows come from the browser, so every field is checked again.
export function sanitizeImportRow(row: ImportRow | null | undefined): NormalizedRow | null {
	const email = normalizeEmail(row?.email);
	if (!email || !Object.hasOwn(STATUS_RANK, row?.status as PropertyKey)) return null;
	const subscribedAt = row!.subscribedAt ? new Date(row!.subscribedAt as string) : undefined;

	return {
		email,
		status: row!.status as string,
		subscribedAt: subscribedAt && Number.isFinite(subscribedAt.getTime()) ? subscribedAt : undefined,
		emailsReceived: optionalNumber(row!.emailsReceived, 1_000_000),
		openRate: optionalNumber(row!.openRate, 1),
		clickRate: optionalNumber(row!.clickRate, 1),
	};
}
