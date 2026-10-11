// Mongoose documents carry ObjectIds and Dates that cannot cross into client components.
export function serialize(value: unknown): unknown {
	return JSON.parse(JSON.stringify(value));
}
