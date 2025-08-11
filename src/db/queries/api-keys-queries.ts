import { db } from "../../db";
import { apiKeys } from "../schema";
import { eq } from "drizzle-orm";

export async function updateApiKeyLastUsed(id: number) {
  // This function can be called without auth since it's used by middleware
  const result = await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id))
    .returning();
  return result[0];
}

export async function getApiKeyByKey(key: string) {
  // This function can be called without auth since it's used by middleware
  const result = await db
    .select({
      id: apiKeys.id,
      key: apiKeys.key,
      userId: apiKeys.userId,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      isActive: apiKeys.isActive,
    })
    .from(apiKeys)
    .where(eq(apiKeys.key, key))
    .limit(1);

  return result[0];
}
