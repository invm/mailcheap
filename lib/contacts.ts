import type { NewsletterDoc } from "@/models/Newsletter";
import { withEngagement } from "@/lib/cleanup";
import Contact from "@/models/Contact";
import Newsletter from "@/models/Newsletter";
import Suppression from "@/models/Suppression";

// Newsletters in creation order with their active contacts, counted from the index in the same round trip.
export function listNewslettersWithActiveCounts(fields?: string | null) {
	return Newsletter.aggregate([
		{ $sort: { createdAt: 1 } },
		...(fields ? [{ $project: Object.fromEntries(fields.split(" ").map((field) => [field, 1])) }] : []),
		{
			$lookup: {
				from: Contact.collection.collectionName,
				localField: "_id",
				foreignField: "newsletterId",
				pipeline: [{ $match: { status: "active" } }, { $count: "count" }],
				as: "active",
			},
		},
		{ $set: { activeCount: { $ifNull: [{ $first: "$active.count" }, 0] } } },
		{ $unset: "active" },
	]);
}

// Only an explicit resubscribe reverses an opt-out; bounces and complaints never reverse.
const REACTIVATABLE_STATUSES = ["unsubscribed", "dormant"];
const SUPPRESSED_STATUSES = { bounce: "bounced", complaint: "complained", manual: "unsubscribed" };

export async function upsertContact({ newsletter, email, source, resubscribe }: { newsletter: NewsletterDoc & { _id: unknown }; email: string; source: string; resubscribe: boolean }) {
	const joinStatus = newsletter.requireConfirmation ? "pending" : "active";
	const suppression = await Suppression.findOne({ email }).select({ reason: 1 }).lean();
	const status = suppression ? (SUPPRESSED_STATUSES[suppression.reason as keyof typeof SUPPRESSED_STATUSES] ?? "unsubscribed") : joinStatus;
	const now = new Date();
	type ModifyLean = { value: unknown; lastErrorObject?: { updatedExisting?: boolean } };
	const result = (await Contact.findOneAndUpdate(
		{ newsletterId: newsletter._id as never, email },
		{ $setOnInsert: { status, source, subscribedAt: now } } as never,
		{ upsert: true, returnDocument: "after", includeResultMetadata: true }
	).lean()) as unknown as ModifyLean;
	const created = !result.lastErrorObject?.updatedExisting;
	const contact = result.value as Record<string, unknown>;

	if (created || !resubscribe || suppression) return { contact, created };
	// Signing up again is a sign of life, and brings back a contact who left or went dormant.
	if (contact.status === "active") {
		await Contact.updateOne({ _id: contact._id as never }, withEngagement() as never);
		return { contact, created };
	}
	if (!REACTIVATABLE_STATUSES.includes(contact.status as string)) return { contact, created };
	const reactivated = await Contact.findOneAndUpdate(
		{ _id: contact._id, status: { $in: REACTIVATABLE_STATUSES } } as never,
		withEngagement({ $set: { status: joinStatus, subscribedAt: new Date() }, $unset: { unsubscribedAt: 1 } }) as never,
		{ returnDocument: "after" }
	).lean();
	return { contact: reactivated ?? contact, created };
}

// The click on the confirmation link. A contact that already confirmed stays as it is.
export async function confirmContact({ contactId, newsletterId }: { contactId: string; newsletterId: string }) {
	const confirmed = await Contact.findOneAndUpdate(
		{ _id: contactId, newsletterId, status: "pending" },
		withEngagement({ $set: { status: "active", confirmedAt: new Date() } }) as never,
		{ returnDocument: "after" }
	).lean();
	if (confirmed) return { contact: confirmed, confirmed: true };
	const contact = await Contact.findOne({ _id: contactId, newsletterId }).lean();
	return { contact, confirmed: false };
}

// The "Yes, keep sending it" click in the last-chance email. It also brings back a contact who went
// dormant; unsubscribes, bounces and complaints stay as they are.
export async function keepContact({ contactId, newsletterId }: { contactId: string; newsletterId: string }) {
	const contact = await Contact.findOne({ _id: contactId, newsletterId }).select({ email: 1, status: 1 }).lean();
	if (!contact || !["active", "dormant"].includes(contact.status)) return null;
	if (contact.status === "dormant" && (await Suppression.exists({ email: contact.email }))) return null;
	return Contact.findOneAndUpdate(
		{ _id: contact._id, status: { $in: ["active", "dormant"] } },
		withEngagement({ $set: { status: "active" } }) as never,
		{ returnDocument: "after" }
	).lean();
}
