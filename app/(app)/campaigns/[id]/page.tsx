import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import CampaignReport from "@/components/CampaignReport";
import FormCampaign from "@/components/FormCampaign";
import { getArchiveUrls } from "@/lib/archive-hosts";
import { sendTimesPipeline } from "@/lib/campaign-queries";
import { isSendingEnabled } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { MESSAGE_STATS_GROUP } from "@/lib/message-stats";
import { serialize } from "@/lib/serialize";
import { listSesDomains } from "@/lib/ses";
import Campaign from "@/models/Campaign";
import Contact from "@/models/Contact";
import Message from "@/models/Message";
import Newsletter from "@/models/Newsletter";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!isValidObjectId(id)) notFound();

	await connectDb();
	const campaign = await Campaign.findById(id).lean();
	if (!campaign) notFound();
	const newsletter = await Newsletter.findById(campaign.newsletterId).lean();
	if (!newsletter) notFound();

	if (!["draft", "scheduled"].includes(campaign.status)) {
		const [providers, remainingCount] = await Promise.all([
			getProviderBreakdown(campaign._id),
			countRemaining(campaign as any),
		]);
		return (
			<CampaignReport
				campaign={serialize(campaign) as any}
				newsletter={serialize(newsletter) as any}
				providers={providers as any}
				remainingCount={remainingCount}
			/>
		);
	}

	const [audienceCount, domains, sendTimes] = await Promise.all([
		Contact.countDocuments({ newsletterId: newsletter._id, status: "active" }),
		listSesDomains(),
		getSendTimes(campaign),
	]);
	const fromDomain = newsletter.fromEmail.split("@")[1];
	const isDomainVerified =
		Array.isArray(domains) && domains.some(({ domain, verified }) => domain === fromDomain && verified);

	return (
		<FormCampaign
			campaign={serialize(campaign) as any}
			newsletter={serialize(newsletter) as any}
			audienceCount={audienceCount}
			isDomainVerified={isDomainVerified}
			isSendingEnabled={isSendingEnabled()}
			testEmail={process.env.ADMIN_EMAIL!}
			sendTimes={sendTimes}
			archiveUrlBase={newsletter.archiveEnabled ? getArchiveUrls(newsletter).absolutePost("") : null}
		/>
	);
}

// A newsletter's first issue borrows the times the other newsletters go out.
async function getSendTimes(campaign: { newsletterId: unknown; _id: unknown }) {
	const own = await Campaign.aggregate(
		sendTimesPipeline({ newsletterId: campaign.newsletterId as any, excludeId: campaign._id as any }) as any
	);
	const rows = own.length > 0 ? own : await Campaign.aggregate(sendTimesPipeline({ excludeId: campaign._id as any }) as any);
	return {
		history: rows.map(({ at }: { at: Date }) => at.toISOString()),
		taken: own.filter(({ status }: { status: string }) => status === "scheduled").map(({ at }: { at: Date }) => at.toISOString()),
	};
}

// Only a send capped to the most engaged has a next step. Close enough for the dialog: contacts who
// left after receiving it make this a little low, and the send itself skips everyone who has it.
async function countRemaining(campaign: { status: string; audienceLimit?: number; newsletterId: unknown; stats?: { recipients?: number } | null; lastChance?: { recipients?: number } | null }) {
	if (campaign.status !== "sent" || !campaign.audienceLimit) return 0;
	const active = await Contact.countDocuments({ newsletterId: campaign.newsletterId as any, status: "active" });
	const reached = (campaign.stats?.recipients ?? 0) + (campaign.lastChance?.recipients ?? 0);
	return Math.max(0, active - reached);
}

async function getProviderBreakdown(campaignId: unknown) {
	const rows = await Message.aggregate([
		{ $match: { campaignId, kind: "campaign" } },
		{ $group: { _id: { $ifNull: ["$provider", "other"] }, ...MESSAGE_STATS_GROUP } },
		{ $sort: { sent: -1 } },
	] as any);
	return rows.filter(({ sent }: { sent: number }) => sent > 0).map(({ _id, ...row }: { _id: string; [key: string]: unknown }) => ({ provider: _id, ...row }));
}
