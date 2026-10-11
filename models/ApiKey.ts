import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		prefix: { type: String, required: true },
		hash: { type: String, required: true, unique: true },
		lastUsedAt: { type: Date },
		revokedAt: { type: Date },
	},
	{ timestamps: true }
);

export type ApiKeyDoc = mongoose.InferSchemaType<typeof apiKeySchema>;

export default (mongoose.models.ApiKey || mongoose.model("ApiKey", apiKeySchema)) as mongoose.Model<ApiKeyDoc>;
