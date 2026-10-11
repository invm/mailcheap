import { isObjectIdString, isPlainObject, normalizeAddress } from "./validation.ts";

const DETAIL_KEYS = new Map([
	["Send", "send"],
	["Delivery", "delivery"],
	["Bounce", "bounce"],
	["Complaint", "complaint"],
	["Open", "open"],
	["Click", "click"],
	["Reject", "reject"],
	["DeliveryDelay", "deliveryDelay"],
	["RenderingFailure", "failure"],
]);

// SES never un-delivers: later events only move a message to a worse status.
const BEFORE_DELIVERY = ["queued", "sent", "failed"];
const BEFORE_BOUNCE = [...BEFORE_DELIVERY, "delivered"];
const BEFORE_COMPLAINT = [...BEFORE_BOUNCE, "bounced"];

const OPEN = { field: "openedAt", stat: "opened", contactStat: "opens" };
const CLICK = { field: "clickedAt", stat: "clicked", contactStat: "clicks" };

// Configuration-set event publishing uses eventType; identity notifications use notificationType.
export interface SesEventFirst { field: string; stat?: string; contactStat?: string }
export interface SesEventStatus { to: string; from: string[]; stat?: string }
export interface SesEventSuppression { emails: string[]; reason: string; detail: string; contactStatus: string; contactStatusFrom: string[] }
export interface SesEventPlan {
	type: string;
	sesMessageId: string | null;
	messageId: string | null;
	email: string | null;
	occurredAt: Date;
	firsts: SesEventFirst[];
	status: SesEventStatus | null;
	error: string | null;
	engagement: { lastOpenAt: Date; lastClickAt?: Date } | null;
	suppression: SesEventSuppression | null;
	data: unknown;
}

export function getSesEventType(sesEvent: Record<string, unknown>): string | null {
	const type = String(sesEvent?.eventType ?? sesEvent?.notificationType ?? "").replace(" ", "");
	return DETAIL_KEYS.has(type) ? type : null;
}

function toDate(value: unknown): Date | null {
	const date = value ? new Date(value as string | number) : null;
	return date && Number.isFinite(date.getTime()) ? date : null;
}

function readTag(tags: unknown, name: string): string | null {
	if (!isPlainObject(tags) || !Object.hasOwn(tags, name)) return null;
	const value = Array.isArray(tags[name]) ? tags[name][0] : tags[name];
	return isObjectIdString(value) ? value.toLowerCase() : null;
}

function readRecipients(recipients: unknown, fallback: string | null): string[] {
	const emails = (Array.isArray(recipients) ? recipients : [])
		.map((recipient: unknown) => normalizeAddress((recipient as Record<string, unknown>)?.emailAddress))
		.filter(Boolean) as string[];
	if (emails.length > 0) return [...new Set(emails)];
	return fallback ? [fallback] : [];
}

function isUnsubscribeLink(link: unknown): boolean {
	try {
		const url = new URL(link as string);
		return /^\/(api\/)?unsubscribe\/?$/.test(url.pathname) && url.searchParams.has("token");
	} catch {
		return false;
	}
}

// A click implies an open: the reader may have images blocked.
function engagementOf(type: string, occurredAt: Date) {
	return type === "Click"
		? { firsts: [OPEN, CLICK], engagement: { lastOpenAt: occurredAt, lastClickAt: occurredAt } }
		: { firsts: [OPEN], engagement: { lastOpenAt: occurredAt } };
}

// Opens and clicks from Mailcheap's own pixel and links (lib/tracking.js).
export function getTrackingPlan(type: string, occurredAt: Date = new Date()) {
	return { type, occurredAt, status: null, error: null, suppression: null, ...engagementOf(type, occurredAt) };
}

function withoutMailHeaders(sesEvent: Record<string, unknown>): Record<string, unknown> {
	if (!isPlainObject(sesEvent.mail)) return sesEvent;
	const mail = { ...sesEvent.mail };
	delete mail.headers;
	return { ...sesEvent, mail };
}

// Pure: turns one SES event into the updates handleSesEvent applies, so the mapping is testable.
export function getSesEventPlan(sesEvent: Record<string, unknown>) {
	const type = getSesEventType(sesEvent);
	if (!type) return null;

	const mail = (isPlainObject(sesEvent.mail) ? sesEvent.mail : {}) as Record<string, unknown>;
	const detail = (isPlainObject(sesEvent[DETAIL_KEYS.get(type)!]) ? sesEvent[DETAIL_KEYS.get(type)!] : {}) as Record<string, unknown>;
	const email = normalizeAddress(Array.isArray(mail.destination) ? mail.destination[0] : null);
	const plan: SesEventPlan = {
		type,
		sesMessageId: typeof mail.messageId === "string" && mail.messageId ? mail.messageId : null,
		messageId: readTag(mail.tags, "message_id"),
		email,
		occurredAt: toDate(detail.timestamp) ?? toDate(mail.timestamp) ?? new Date(),
		firsts: [],
		status: null,
		error: null,
		engagement: null,
		suppression: null,
		data: withoutMailHeaders(sesEvent),
	};

	if (type === "Delivery") {
		plan.firsts = [{ field: "deliveredAt", stat: "delivered" }];
		plan.status = { to: "delivered", from: BEFORE_DELIVERY };
	}

	if (type === "Bounce") {
		const kind = detail.bounceType === "Permanent" ? "Hard" : "Soft";
		const reason = [detail.bounceSubType, (detail.bouncedRecipients as any)?.[0]?.diagnosticCode];
		plan.error = `${kind} bounce: ${reason.filter(Boolean).join(", ") || "unknown"}`;
		if (kind === "Hard") {
			plan.firsts = [{ field: "bouncedAt", stat: "bounced" }];
			plan.status = { to: "bounced", from: BEFORE_BOUNCE };
			plan.suppression = {
				emails: readRecipients(detail.bouncedRecipients, email),
				reason: "bounce",
				detail: `${detail.bounceType}/${detail.bounceSubType ?? "General"}`,
				contactStatus: "bounced",
				contactStatusFrom: ["active", "dormant", "unsubscribed"],
			};
		}
	}

	// "not-spam" is a recipient taking the email out of spam, not a complaint.
	if (type === "Complaint" && detail.complaintFeedbackType !== "not-spam") {
		plan.firsts = [{ field: "complainedAt", stat: "complained" }];
		plan.status = { to: "complained", from: BEFORE_COMPLAINT };
		plan.suppression = {
			emails: readRecipients(detail.complainedRecipients, email),
			reason: "complaint",
			detail: (detail.complaintFeedbackType ?? "abuse") as string,
			contactStatus: "complained",
			contactStatusFrom: ["active", "dormant", "unsubscribed", "bounced"],
		};
	}

	// Unsubscribe clicks aren't engagement.
	if (type === "Open" || (type === "Click" && !isUnsubscribeLink(detail.link))) {
		Object.assign(plan, engagementOf(type, plan.occurredAt));
	}

	if (type === "Reject" || type === "RenderingFailure") {
		plan.status = { to: "failed", from: ["queued", "sent"], stat: "failed" };
		plan.error =
			type === "Reject"
				? `Rejected by SES: ${detail.reason ?? "unknown"}`
				: `Rendering failed: ${detail.errorMessage ?? "unknown"}`;
	}

	return plan;
}
