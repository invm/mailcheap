// Mongoose documents carry ObjectIds and Dates that cannot cross into client components.
export function serialize<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}
