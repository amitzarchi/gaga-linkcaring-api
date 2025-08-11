import { db } from "../../db";
import { validators, milestones } from "../schema";
import { eq } from "drizzle-orm";


export async function getValidatorsByMilestone(milestoneId: number) {
  const result = await db
    .select()
    .from(validators)
    .where(eq(validators.milestoneId, milestoneId));
  return result;
}

