"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
	value: string;
	label?: string;
};

export default function ButtonCopy({ value, label = "Copy" }: Props) {
	const [isCopied, setIsCopied] = useState(false);
	const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	async function copy() {
		await navigator.clipboard.writeText(value);
		setIsCopied(true);
		clearTimeout(timeout.current as ReturnType<typeof setTimeout>);
		timeout.current = setTimeout(() => setIsCopied(false), 1500);
	}

	const Icon = isCopied ? Check : Copy;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={copy}
					aria-label={label}
					className="relative text-muted-foreground after:absolute after:-inset-1.5 hover:text-foreground"
				>
					<Icon key={String(isCopied)} className="animate-icon-in" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>{isCopied ? "Copied" : label}</TooltipContent>
		</Tooltip>
	);
}
