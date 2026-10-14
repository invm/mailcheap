"use server";

import { after } from "next/server";
import { isSendingEnabled } from "@/lib/config";
import { verifyConfirmToken } from "@/lib/confirmation";
import { confirmContact } from "@/lib/contacts";
import { connectDb } from "@/lib/db";
import { queueWelcomeEmail } from "@/lib/sending";
import Newsletter from "@/models/Newsletter";

export async function confirmSubscription(token: string | null): Promise<{ ok?: true; error?: string }> {
	const reference = verifyConfirmToken(token);
	if (!reference) return { error: "invalid" };

	await connectDb();
	const { contact, confirmed } = await confirmContact(reference);
	if (contact?.status !== "active") return { error: "invalid" };

	if (confirmed && isSendingEnabled()) {
		const newsletter = await Newsletter.findById(reference.newsletterId).lean();
		// Skipped while the newsletter confirms signups: the confirmation was their one email.
		after(() =>
			queueWelcomeEmail({ newsletter, contact } as Parameters<typeof queueWelcomeEmail>[0]).catch((error) =>
				console.error(`[confirm] Welcome email for ${contact._id} failed:`, error.message)
			)
		);
	}
	return { ok: true };
}
