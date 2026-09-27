import mongoose from 'mongoose';

import {
  enrichedRecipeSchema,
  providerMetadataSchema,
} from '../validators/recipeRecommendationValidators.js';

function schemaValidator(schema, message) {
  return {
    validator(value) {
      return schema.safeParse(value).success;
    },
    message,
  };
}

const savedRecipeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required.'],
      immutable: true,
    },
    fingerprint: {
      type: String,
      required: [true, 'Recipe fingerprint is required.'],
      immutable: true,
      lowercase: true,
      trim: true,
      match: [/^[a-f\d]{64}$/, 'Recipe fingerprint is invalid.'],
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Recipe snapshot is required.'],
      immutable: true,
      validate: schemaValidator(enrichedRecipeSchema, 'Recipe snapshot is invalid.'),
    },
    provider: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Recipe provider provenance is required.'],
      immutable: true,
      validate: schemaValidator(providerMetadataSchema, 'Recipe provider provenance is invalid.'),
    },
  },
  {
    autoCreate: false,
    autoIndex: false,
    collection: 'savedrecipes',
    timestamps: true,
    versionKey: false,
  },
);

savedRecipeSchema.index(
  { userId: 1, fingerprint: 1 },
  { name: 'savedrecipes_unique_owner_fingerprint', unique: true },
);

savedRecipeSchema.index(
  { userId: 1, createdAt: -1, _id: -1 },
  { name: 'savedrecipes_owned_recent' },
);

export const SavedRecipe =
  mongoose.models.SavedRecipe || mongoose.model('SavedRecipe', savedRecipeSchema);
