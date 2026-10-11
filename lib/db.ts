import mongoose from "mongoose";

declare global {
	var __mailcheapMongoose: { connection: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = globalThis.__mailcheapMongoose ?? { connection: null, promise: null };
globalThis.__mailcheapMongoose = cached;

export async function connectDb(): Promise<typeof mongoose> {
	if (cached.connection) return cached.connection;
	if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

	cached.promise ??= mongoose.connect(process.env.MONGODB_URI, {
		maxPoolSize: 10,
		serverSelectionTimeoutMS: 5000,
	});
	cached.connection = await cached.promise;
	return cached.connection;
}
