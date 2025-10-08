import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { withApiKeyAuth } from "../middleware/keys-middleware";
import { getMilestonesIds } from "../db/queries/milestones-queries";

export async function listMilestoneIds(
  _request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const result = await getMilestonesIds();
    return { status: 200, jsonBody: result };
  } catch (error) {
    context.log("Error fetching milestone ids:", error as any);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("milestone-ids", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: withApiKeyAuth(listMilestoneIds),
});


