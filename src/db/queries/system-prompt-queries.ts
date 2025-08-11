import { db } from "../../db";
import { systemPromptHistory } from "../schema";
import { desc, eq } from "drizzle-orm";

export async function getCurrentSystemPrompt() {
  const rows = await db
    .select()
    .from(systemPromptHistory)
    .orderBy(desc(systemPromptHistory.id))
    .limit(1);
  return rows[0] ?? null;
}

