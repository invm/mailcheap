const numberFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
	return numberFormat.format(value || 0);
}

// "1 contact", "2,239 contacts"
export function formatCount(value: number, noun: string): string {
	return `${formatNumber(value)} ${noun}${value === 1 ? "" : "s"}`;
}

export function formatCompact(value: number): string {
	return compactFormat.format(value || 0);
}

// The format helpers return null for a missing value; pages show it with TextEmpty.
export function formatRate(part: number | null | undefined, total: number, digits = 1): string | null {
	const value = Number(part);
	if (!total || part === undefined || part === null || !Number.isFinite(value)) return null;
	return `${((value / total) * 100).toFixed(digits)}%`;
}

// "+1,204", "−32", "0"
export function formatSigned(value: number): string {
	const sign = value > 0 ? "+" : value < 0 ? "−" : "";
	return `${sign}${formatNumber(Math.abs(value))}`;
}

// "+8%" for a count; for a rate, the difference between the two rates: 41.8% then 39.1% is "−2.7%".
export function formatChange(value: number | null | undefined, { digits = 0 }: { digits?: number } = {}): string | null {
	if (value === null || value === undefined || !Number.isFinite(value)) return null;
	const rounded = Number(value.toFixed(digits));
	const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
	return `${sign}${Math.abs(rounded).toFixed(digits)}%`;
}

// "2 PM" for 14.
export function formatHour(hour: number): string {
	return new Date(Date.UTC(2000, 0, 1, hour)).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
}

export function currentYear() {
	return new Date().getFullYear();
}

export function formatDate(value: Date | string | null | undefined): string | null {
	if (!value) return null;
	return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// "Wed, Oct 7, 4:00 PM" in the browser's timezone; on the server it would be UTC.
export function formatSendTime(value: Date | string): string {
	return new Date(value).toLocaleString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function formatRelative(value: Date | string | null | undefined, now = Date.now()): string | null {
	if (!value) return null;
	const seconds = Math.round((now - new Date(value).getTime()) / 1000);
	if (seconds < 60) return "just now";
	const units: [string, number][] = [
		["year", 31536000],
		["month", 2592000],
		["day", 86400],
		["hour", 3600],
		["minute", 60],
	];
	const [unit, size] = units.find(([, size]) => seconds >= size)!;
	const amount = Math.floor(seconds / size);
	return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
}
