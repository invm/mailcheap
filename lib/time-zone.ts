// Days and hours on the dashboard follow the browser's timezone, saved in a cookie by CookieTimezone.
export const TIME_ZONE_COOKIE = "tz";
export const DEFAULT_TIME_ZONE = "UTC";

const DAY_MS = 24 * 60 * 60 * 1000;
const keyFormats = new Map();

export function resolveTimeZone(value: unknown): string {
	if (typeof value !== "string" || !value || value.length > 64) return DEFAULT_TIME_ZONE;
	try {
		return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
	} catch {
		return DEFAULT_TIME_ZONE;
	}
}

function keyFormat(timeZone: string): Intl.DateTimeFormat {
	if (!keyFormats.has(timeZone)) {
		keyFormats.set(
			timeZone,
			new Intl.DateTimeFormat("en-US", {
				timeZone,
				hourCycle: "h23",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			})
		);
	}
	return keyFormats.get(timeZone)!;
}

function zonedParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number; [k: string]: number } {
	const parts = Object.fromEntries(
		keyFormat(timeZone)
			.formatToParts(date)
			.map(({ type, value }: Intl.DateTimeFormatPart) => [type, Number(value)])
	);
	return { ...parts, hour: parts.hour % 24 } as { year: number; month: number; day: number; hour: number; minute: number; second: number; [k: string]: number };
}

// "2026-10-08": the calendar day of an instant in a timezone, the format $dateToString produces.
export function toDateKey(date: Date, timeZone: string): string {
	const { year, month, day } = zonedParts(date, timeZone);
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function hourIn(date: Date, timeZone: string): number {
	return zonedParts(date, timeZone).hour;
}

export function shiftDateKey(key: string, days: number): string {
	const [year, month, day] = key.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

function offsetMs(date: Date, timeZone: string): number {
	const { year, month, day, hour, minute, second } = zonedParts(date, timeZone);
	return Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(date.getTime() / 1000) * 1000;
}

// The instant a calendar day starts in a timezone, DST included.
export function startOfDateKey(key: string, timeZone: string): Date {
	const [year, month, day] = key.split("-").map(Number);
	const midnight = Date.UTC(year, month - 1, day);
	const guess = midnight - offsetMs(new Date(midnight), timeZone);
	return new Date(midnight - offsetMs(new Date(guess), timeZone));
}

// "GMT+3", or "UTC".
export function timeZoneLabel(timeZone: string, date = new Date()): string {
	const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
		.formatToParts(date)
		.find(({ type }) => type === "timeZoneName")?.value;
	return !name || name === "GMT" ? "UTC" : name;
}

// "Oct 8" for a date key, whatever the server's timezone.
export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
	return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}
