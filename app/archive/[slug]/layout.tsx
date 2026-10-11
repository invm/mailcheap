import { notFound } from "next/navigation";
import FooterArchive from "@/components/FooterArchive";
import HeaderArchive from "@/components/HeaderArchive";
import ProviderSubscribe from "@/components/ProviderSubscribe";
import { countReaders, getArchiveNewsletter } from "@/lib/archive-data";
import { getArchiveUrls } from "@/lib/archive-hosts";

export default async function ArchiveLayout({ children, params }: LayoutProps<"/archive/[slug]">) {
	const newsletter = await getArchiveNewsletter((await params).slug);
	if (!newsletter) notFound();

	const readers = await countReaders(newsletter._id.toString() as never);
	const { index } = getArchiveUrls(newsletter);
	const pitch = {
		name: newsletter.name,
		slug: newsletter.slug,
		imageUrl: newsletter.imageUrl as string | undefined,
		description: newsletter.description as string | undefined,
	};

	return (
		<ProviderSubscribe newsletter={pitch as never} readers={readers}>
			<div className="flex min-h-dvh flex-col">
				<HeaderArchive newsletter={newsletter as never} indexHref={index} />
				<main className="flex-1">{children}</main>
				<FooterArchive newsletter={newsletter as never} indexHref={index} />
			</div>
		</ProviderSubscribe>
	);
}
