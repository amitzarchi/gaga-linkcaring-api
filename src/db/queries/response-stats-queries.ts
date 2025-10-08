import { eq } from "drizzle-orm";
import { db } from "../../db";
import { responseStats } from "../schema";

export async function insertResponseStat(
  data: typeof responseStats.$inferInsert
) {
  const [row] = await db.insert(responseStats).values(data).returning();
  return row;
}

export async function getResponseStats(invocationId: string) {
  const result = await db
    .select({
      id: responseStats.id,
      createdAt: responseStats.createdAt,
      milestoneId: responseStats.milestoneId,
      result: responseStats.result,
      confidence: responseStats.confidence,
      validatorsTotal: responseStats.validatorsTotal,
      validatorsPassed: responseStats.validatorsPassed,
      apiKeyId: responseStats.apiKeyId,
      model: responseStats.model,
      totalTokenCount: responseStats.totalTokenCount,
      processingMs: responseStats.processingMs,
      requestId: responseStats.requestId,
    })
    .from(responseStats)
    .where(eq(responseStats.requestId, invocationId));
  return result;
}
