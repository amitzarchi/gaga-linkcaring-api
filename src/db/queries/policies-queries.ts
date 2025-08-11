import { db } from "../../db";
import { policies, milestones, milestoneCategories } from "../schema";
import { eq, asc, and } from "drizzle-orm";


export async function getPolicyById(id: number) {
  const [row] = await db.select().from(policies).where(eq(policies.id, id)).limit(1);
  return row;
}

export async function getDefaultPolicy() {
  const rows = await db
    .select()
    .from(policies)
    .where(eq(policies.isDefault, true))
    .limit(1);
  return rows[0] ?? null;
}
