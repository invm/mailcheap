import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";

// Warm-up: a limit sends to the most engaged contacts first.
export default function InputAudienceLimit({ value, onChange, audienceCount, label = "Limit" }: { value: string; onChange: (value: string) => void; audienceCount: number; label?: string }) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="text-sm text-muted-foreground">{label}</span>
			<Input
				type="number"
				min={1}
				inputMode="numeric"
				value={value}
				placeholder={`All ${formatNumber(audienceCount)}`}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	);
}

export function countRecipients(limit: string, audienceCount: number): number {
	const limitNumber = Number.parseInt(limit, 10);
	return limitNumber > 0 ? Math.min(limitNumber, audienceCount) : audienceCount;
}
