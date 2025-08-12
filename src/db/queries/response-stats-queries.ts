import { db } from "../../db";
import { responseStats } from "../schema";

export async function insertResponseStat(
  data: typeof responseStats.$inferInsert
) {
  const [row] = await db.insert(responseStats).values(data).returning();
  return row;
}


