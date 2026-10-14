import { Link2Off } from "lucide-react";
import CardNotice from "@/components/CardNotice";
import FormKeep from "@/components/FormKeep";
import { getArchiveUrls } from "@/lib/archive-hosts";
import { connectDb } from "@/lib/db";
import { verifyKeepToken } from "@/lib/last-chance";
import Newsletter from "@/models/Newsletter";

// The URL carries the keep token: keep it out of search results and referrer headers.
export const metadata = {
	title: "Keep getting the newsletter",
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};

export default async function KeepPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	const { token } = await searchParams;
	const validToken = typeof token === "string" ? token : null;
	const reference = verifyKeepToken(validToken);
	const newsletter = reference ? await getNewsletter(reference.newsletterId) : null;

	return (
		<main className="flex min-h-dvh items-center justify-center bg-background px-4 py-16">
			{newsletter ? (
				<FormKeep
					token={validToken as string}
					newsletterName={newsletter.name}
					archiveUrl={(newsletter.archiveEnabled ? getArchiveUrls(newsletter).siteIndex : null)}
				/>
			) : (
				<CardNotice icon={Link2Off} title="This link doesn't work">
					It may be older than 90 days. Sign up again to keep getting the newsletter.
				</CardNotice>
			)}
		</main>
	);
}

type NewsletterForKeep = { name: string; slug: string; archiveEnabled: boolean };

async function getNewsletter(newsletterId: string): Promise<NewsletterForKeep | null> {
	try {
		await connectDb();
		return await Newsletter.findById(newsletterId)
			.select({ name: 1, slug: 1, archiveEnabled: 1 })
			.lean() as unknown as NewsletterForKeep | null;
	} catch (error) {
		console.error("[keep] Could not load the newsletter:", (error as Error).message);
		return null;
	}
}
