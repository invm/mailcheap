import { slugify } from "./slug.ts";

type NewsletterForAuthor = { fromName?: string; name: string; author?: { bio?: string; imageUrl?: string }; imageUrl?: string };

// One person writes each newsletter: the From name, with the photo and bio set on the newsletter.
export function getArchiveAuthor(newsletter: NewsletterForAuthor) {
	const name = newsletter.fromName || newsletter.name;
	return {
		name,
		slug: slugify(name, 60) || "author",
		bio: newsletter.author?.bio || "",
		imageUrl: newsletter.author?.imageUrl || newsletter.imageUrl || "",
	};
}
