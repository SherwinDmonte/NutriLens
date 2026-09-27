import { SavedRecipe } from '../models/SavedRecipe.js';

export function createSavedRecipe(data) {
  return SavedRecipe.create(data);
}

export function findOwnedSavedRecipeByFingerprint({ userId, fingerprint }) {
  return SavedRecipe.findOne({ userId, fingerprint }).lean();
}

export async function listOwnedSavedRecipes({ userId, page, limit }) {
  const filter = { userId };
  const skip = (page - 1) * limit;
  const [savedRecipes, total] = await Promise.all([
    SavedRecipe.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    SavedRecipe.countDocuments(filter),
  ]);

  return { savedRecipes, total };
}

export function findOwnedSavedRecipe({ userId, savedRecipeId }) {
  return SavedRecipe.findOne({ _id: savedRecipeId, userId }).lean();
}

export function deleteOwnedSavedRecipe({ userId, savedRecipeId }) {
  return SavedRecipe.findOneAndDelete({ _id: savedRecipeId, userId }).lean();
}
