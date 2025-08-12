import { db } from "../../db";
import { models } from "../schema";
import { eq } from "drizzle-orm";

export async function getActiveModel() {
  const rows = await db
    .select()
    .from(models)
    .where(eq(models.isActive, true))
    .limit(1);
  return rows[0] ?? null;
}


