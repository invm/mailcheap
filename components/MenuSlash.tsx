"use client";

import { type Ref, useImperativeHandle, useState } from "react";
import type { Editor, Range } from "@tiptap/core";
import type { ChainedCommands } from "@tiptap/core";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { LucideIcon } from "lucide-react";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import {
	Heading1,
	Heading2,
	Heading3,
	ImagePlus,
	List,
	ListOrdered,
	Minus,
	Pilcrow,
	RectangleHorizontal,
	TextQuote,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SlashItem = { title: string; keywords: string; icon: LucideIcon; run: (chain: ChainedCommands) => ChainedCommands; isImage?: boolean };
type SlashHandle = { onKeyDown: (props: { event: KeyboardEvent }) => boolean };

export default function MenuSlash({ items, command, ref }: { items: SlashItem[]; command: (item: SlashItem) => void; ref: Ref<SlashHandle> }) {
	const [selection, setSelection] = useState<{ items: SlashItem[]; index: number }>({ items, index: 0 });
	const index = selection.items === items ? selection.index : 0;

	function select(nextIndex: number): void {
		setSelection({ items, index: nextIndex });
	}

	useImperativeHandle(ref, () => ({
		onKeyDown({ event }) {
			if (!items.length) return false;
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				const step = event.key === "ArrowDown" ? 1 : -1;
				select((index + step + items.length) % items.length);
				return true;
			}
			if (event.key === "Enter" || event.key === "Tab") {
				command(items[index]);
				return true;
			}
			return false;
		},
	}));

	if (!items.length) return null;

	return (
		<div
			role="listbox"
			aria-label="Insert"
			className="max-h-80 w-56 origin-top-left overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg animate-in duration-150 fade-in-0 zoom-in-95"
		>
			{items.map((item, itemIndex) => {
				const isSelected = itemIndex === index;
				return (
					<button
						key={item.title}
						type="button"
						role="option"
						aria-selected={isSelected}
						ref={isSelected ? scrollIntoView : undefined}
						onMouseEnter={() => select(itemIndex)}
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => command(item)}
						className={cn(
							"flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm",
							isSelected && "bg-accent text-accent-foreground"
						)}
					>
						<span className="grid size-7 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground">
							<item.icon className="size-4" />
						</span>
						{item.title}
					</button>
				);
			})}
		</div>
	);
}

// Typing "/" at the start of a line or after a space opens the menu; the text after it filters.
export const SlashCommand = Extension.create({
	name: "slashCommand",
	addOptions(): { onPickImage: (editor: Editor) => void } {
		return { onPickImage: () => {} };
	},
	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				char: "/",
				items: ({ query }) => filterItems(query),
				command: ({ editor, range, props: item }: { editor: Editor; range: Range; props: SlashItem }) => {
					item.run(editor.chain().focus().deleteRange(range)).run();
					if (item.isImage) this.options.onPickImage(editor);
				},
				render: renderMenu,
			}),
		];
	},
});

function renderMenu() {
	let component: import("@tiptap/react").ReactRenderer<SlashHandle>;
	let unmount: (() => void) | undefined;
	return {
		onStart(props: SuggestionProps<SlashItem>) {
			component = new ReactRenderer(MenuSlash, { props, editor: props.editor });
			component.element.style.zIndex = "50";
			unmount = props.mount(component.element);
		},
		onUpdate(props: SuggestionProps<SlashItem>) {
			component.updateProps(props);
		},
		onKeyDown(props: { event: KeyboardEvent }) {
			return component.ref?.onKeyDown(props) ?? false;
		},
		onExit() {
			unmount?.();
			component.destroy();
		},
	};
}

function filterItems(query: string): SlashItem[] {
	const search = query.toLowerCase().trim();
	return SLASH_ITEMS.filter(({ title, keywords }) => `${title} ${keywords}`.toLowerCase().includes(search));
}

function scrollIntoView(element: Element | null): void {
	element?.scrollIntoView({ block: "nearest" });
}

const SLASH_ITEMS: SlashItem[] = [
	{ title: "Text", keywords: "paragraph", icon: Pilcrow, run: (chain) => chain.setParagraph() },
	{ title: "Heading 1", keywords: "title h1 big", icon: Heading1, run: (chain) => chain.setHeading({ level: 1 }) },
	{ title: "Heading 2", keywords: "subtitle h2", icon: Heading2, run: (chain) => chain.setHeading({ level: 2 }) },
	{ title: "Heading 3", keywords: "h3 small", icon: Heading3, run: (chain) => chain.setHeading({ level: 3 }) },
	{ title: "Bulleted list", keywords: "ul unordered", icon: List, run: (chain) => chain.toggleBulletList() },
	{ title: "Numbered list", keywords: "ol ordered", icon: ListOrdered, run: (chain) => chain.toggleOrderedList() },
	{ title: "Image", keywords: "picture photo upload", icon: ImagePlus, run: (chain) => chain, isImage: true },
	{ title: "Quote", keywords: "blockquote", icon: TextQuote, run: (chain) => chain.setBlockquote() },
	{ title: "Divider", keywords: "hr separator line", icon: Minus, run: (chain) => chain.setHorizontalRule() },
	{
		title: "Box",
		keywords: "callout container update promo",
		icon: RectangleHorizontal,
		run: (chain) => chain.wrapIn("callout"),
	},
];
