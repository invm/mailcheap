import { Link2Off } from "lucide-react";
import CardNotice from "@/components/CardNotice";
import FormConfirm from "@/components/FormConfirm";
import { getArchiveUrls } from "@/lib/archive-hosts";
import { verifyConfirmToken } from "@/lib/confirmation";
import { connectDb } from "@/lib/db";
import Newsletter from "@/models/Newsletter";

// The URL carries the confirmation token: keep it out of search results and referrer headers.
export const metadata = {
	title: "Confirm your subscription",
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	const { token } = await searchParams;
	const validToken = typeof token === "string" ? token : null;
	const reference = verifyConfirmToken(validToken);
	const newsletter = reference ? await getNewsletter(reference.newsletterId) : null;

	return (
		<main className="flex min-h-dvh items-center justify-center bg-background px-4 py-16">
			{newsletter ? (
				<FormConfirm
					token={validToken as string}
					newsletterName={newsletter.name as string}
					fromName={newsletter.fromName as unknown as string | undefined}
					fromEmail={newsletter.fromEmail as unknown as string}
					archiveUrl={(newsletter.archiveEnabled ? getArchiveUrls(newsletter).siteIndex : null) as unknown as string | undefined}
				/>
			) : (
				<CardNotice icon={Link2Off} title="This link doesn't work">
					It may be older than 30 days. Sign up again and use the newest confirmation email.
				</CardNotice>
			)}
		</main>
	);
}

async function getNewsletter(newsletterId: string) {
	try {
		await connectDb();
		return await Newsletter.findById(newsletterId)
			.select({ name: 1, slug: 1, fromName: 1, fromEmail: 1, archiveEnabled: 1 })
			.lean();
	} catch (error) {
		console.error("[confirm] Could not load the newsletter:", (error as Error).message);
		return null;
	}
}
