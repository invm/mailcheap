import mongoose from "mongoose";

// Global: an address that bounced or complained is never emailed again from any newsletter.
const suppressionSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, unique: true, lowercase: true, trim: true },
		reason: { type: String, enum: ["bounce", "complaint", "manual"], required: true },
		detail: { type: String },
	},
	{ timestamps: true }
);

export type SuppressionDoc = mongoose.InferSchemaType<typeof suppressionSchema>;

export default (mongoose.models.Suppression || mongoose.model("Suppression", suppressionSchema)) as mongoose.Model<SuppressionDoc>;
