// Round axis bounds and evenly spaced ticks around the data, so labels read 2,200 rather than 2,187.
export function niceScale(values: number[], tickCount = 4): { min: number; max: number; ticks: number[] } {
	const numbers = values.filter(Number.isFinite);
	let min = numbers.length ? Math.min(...numbers) : 0;
	let max = numbers.length ? Math.max(...numbers) : 0;
	if (min === max) {
		min = Math.max(0, min - 1);
		max += 1;
	}
	const step = niceStep((max - min) / (tickCount - 1));
	const low = Math.floor(min / step) * step;
	const high = Math.max(Math.ceil(max / step) * step, low + step);
	const ticks = [];
	for (let tick = low; tick <= high + step / 2; tick += step) ticks.push(Math.round(tick * 1e6) / 1e6);
	return { min: low, max: high, ticks };
}

function niceStep(rough: number): number {
	const power = 10 ** Math.floor(Math.log10(rough || 1));
	const fraction = rough / power;
	const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
	return Math.max(nice * power, 1);
}

// 0 at the bottom of the axis, 1 at the top.
export function toRatio(value: number, { min, max }: { min: number; max: number }): number {
	return max === min ? 0 : (value - min) / (max - min);
}

// Path through evenly spaced points in a width × height box, y measured from the top.
export function linePath(values: number[], scale: { min: number; max: number }, { width, height }: { width: number; height: number }): string {
	const step = values.length > 1 ? width / (values.length - 1) : 0;
	return values
		.map((value: number, index: number) => {
			const x = round(index * step);
			const y = round(height - toRatio(value, scale) * height);
			return `${index ? "L" : "M"}${x},${y}`;
		})
		.join("");
}

export function areaPath(values: number[], scale: { min: number; max: number }, box: { width: number; height: number }): string {
	if (values.length === 0) return "";
	return `${linePath(values, scale, box)}L${box.width},${box.height}L0,${box.height}Z`;
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}
