"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

export default function ProviderTheme({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
			{children}
		</ThemeProvider>
	);
}
