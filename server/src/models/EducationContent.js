import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    org: { type: String, required: true },     // e.g. "WHO", "UNHCR", "UNICEF", "CDC", "MSF"
    title: { type: String, required: true },
    url: { type: String, required: true },
    description: String,
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ['hygiene', 'nutrition', 'maternal', 'general'],
      required: true,
      index: true,
    },
    icon: String,
    title: String,
    body: String,             // short summary
    details: [String],        // longer paragraphs
    keyFacts: [String],       // bullet facts
    resources: [resourceSchema],
    language: { type: String, enum: ['en', 'sw', 'fr', 'ar'], required: true, index: true },
  },
  { timestamps: true }
);

educationSchema.index({ category: 1, language: 1 });
educationSchema.index({ slug: 1, language: 1 }, { unique: true });

export const EducationContent = mongoose.model('EducationContent', educationSchema);
