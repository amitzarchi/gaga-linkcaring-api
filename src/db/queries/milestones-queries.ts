import { db } from "../../db";
import { milestones } from "../schema";
import { eq } from "drizzle-orm";

export async function getMilestoneById(id: number): Promise<{ name: string, policyId: number | null } | null> {
  const [row] = await db
    .select({ name: milestones.name, policyId: milestones.policyId })
    .from(milestones)
    .where(eq(milestones.id, id))
    .limit(1);
  return row;
}

export async function getMilestonesIds(): Promise<{ id: number, name: string }[]> {
  const result = await db
    .select({ id: milestones.id, name: milestones.name })
    .from(milestones)
    .orderBy(milestones.id);
  return result;
}