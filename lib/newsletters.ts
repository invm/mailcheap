import type mongoose from "mongoose";
import type { NewsletterDoc } from "@/models/Newsletter";

export const NEWSLETTER_SUMMARY_FIELDS = "name slug imageUrl fromEmail";
export const MAX_DESCRIPTION_LENGTH = 200;
export const MAX_AUTHOR_BIO_LENGTH = 160;

export function toNewsletterOptions(newsletters: { _id: mongoose.Types.ObjectId; name: string; imageUrl?: string | null; fromEmail?: string | null }[]) {
	return newsletters.map(({ _id, name, imageUrl, fromEmail }: { _id: mongoose.Types.ObjectId; name: string; imageUrl?: string | null; fromEmail?: string | null }) => ({
		id: _id.toString(),
		name,
		imageUrl: imageUrl || null,
		fromEmail: fromEmail || null,
	}));
}

export function toNewsletterMap(newsletters: { _id: mongoose.Types.ObjectId; name: string; imageUrl?: string | null; fromEmail?: string | null }[]) {
	return Object.fromEntries(toNewsletterOptions(newsletters).map((option: { id: string; name: string; imageUrl: string | null; fromEmail: string | null }) => [option.id, option]));
}
