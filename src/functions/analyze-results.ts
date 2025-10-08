import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { withApiKeyAuth } from "../middleware/keys-middleware";
import { getResponseStats } from "../db/queries/response-stats-queries";

export async function getAnalyzeResults(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const id = request.params.id;
    
    if (!id) {
      return { status: 400, jsonBody: { error: "Missing id parameter" } };
    }

    const result = await getResponseStats(id);
    
    if (!result || result.length === 0) {
      return { status: 404, jsonBody: { error: "Analysis result not found" } };
    }

    return { status: 200, jsonBody: result };
  } catch (error) {
    context.log("Error fetching analyze results:", error as any);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("analyze-results", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "analyze-results/{id}",
  handler: withApiKeyAuth(getAnalyzeResults),
});

