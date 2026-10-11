import type { ComponentType, ReactNode } from "react";

export default function StateEmpty({ icon: Icon, title, children }: { icon: ComponentType<{ className?: string }>; title: string; children?: ReactNode }) {
	return (
		<div className="flex flex-col items-center justify-center gap-4 rounded-xl px-6 py-16 text-center shadow-border animate-enter">
			<div className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
				<Icon className="size-5" />
			</div>
			<p className="text-sm font-medium">{title}</p>
			{children}
		</div>
	);
}
