"use client";

import type React from "react";
import { createContext, use, useMemo, useState } from "react";
import type { ArchiveNewsletter } from "@/lib/archive-seo";
import PitchSubscribe from "@/components/PitchSubscribe";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { storeValue, subscribeSnoozedKey } from "@/lib/storage";

type SubscribeContextValue = { open: (source?: string) => void } | null;
const SubscribeContext = createContext<SubscribeContextValue>(null);

export function useSubscribe() {
	return use(SubscribeContext);
}

export default function ProviderSubscribe({ newsletter, readers, children }: { newsletter: ArchiveNewsletter; readers: number; children: React.ReactNode }) {
	const [openedBy, setOpenedBy] = useState<string | null>(null);
	const value = useMemo(() => ({ open: (source = "reader") => setOpenedBy(source) }), []);

	function onOpenChange(open: boolean) {
		if (open) return;
		setOpenedBy(null);
		storeValue(subscribeSnoozedKey(newsletter.slug), Date.now());
	}

	// A popup that appears mid-read shouldn't throw the phone keyboard over the issue.
	function onOpenAutoFocus(event: Event) {
		if (openedBy === "scroll" && window.matchMedia("(pointer: coarse)").matches) event.preventDefault();
	}

	return (
		<SubscribeContext value={value}>
			{children}
			<Dialog open={Boolean(openedBy)} onOpenChange={onOpenChange}>
				<DialogContent
					aria-describedby={undefined}
					onOpenAutoFocus={onOpenAutoFocus}
					className="p-8 pt-10 sm:max-w-md"
				>
					<PitchSubscribe newsletter={newsletter} readers={readers} titleAs={DialogTitle} />
				</DialogContent>
			</Dialog>
		</SubscribeContext>
	);
}
