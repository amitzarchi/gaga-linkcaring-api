import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { withApiKeyAuth } from "../middleware/keys-middleware";
import { getMilestoneById } from "../db/queries/milestones-queries";
import { getValidatorsByMilestone } from "../db/queries/validators-queries";
import { getCurrentSystemPrompt } from "../db/queries/system-prompt-queries";
import { getDefaultPolicy, getPolicyById } from "../db/queries/policies-queries";
import { parseAnalyzeForm } from "../services/analyze/parse-request";
import { buildPrompt } from "../services/analyze/prompt";
import { runVideoAnalysis } from "../services/analyze/model";
import { evaluatePolicy } from "../services/analyze/policy";

export async function analyze(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const { milestoneId, video } = await parseAnalyzeForm(request);

    const [milestone, milestoneValidators, systemPrompt] = await Promise.all([
      getMilestoneById(milestoneId),
      getValidatorsByMilestone(milestoneId),
      getCurrentSystemPrompt(),
    ]);

    if (!milestone) {
      return { status: 404, jsonBody: { error: "invalid milestone ID" } };
    }

    if (
      !milestoneValidators ||
      milestoneValidators.length === 0 ||
      !systemPrompt
    ) {
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }

    const finalPrompt = buildPrompt({
      basePrompt: systemPrompt.content,
      milestoneName: milestone.name,
      validators: milestoneValidators,
    });

    const responseJson = await runVideoAnalysis(video, finalPrompt);

    const policy = milestone.policyId
      ? await getPolicyById(milestone.policyId)
      : await getDefaultPolicy();

    if (!policy) {
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }

    const { result, confidence, validators } = evaluatePolicy(responseJson, {
      minValidatorsPassed: policy.minValidatorsPassed,
      minConfidence: policy.minConfidence,
    });

    return {
      status: 200,
      jsonBody: {
        milestoneId,
        result,
        confidence,
        validators,
        policy: {
          minValidatorsPassed: policy.minValidatorsPassed,
          minConfidence: policy.minConfidence,
        },
      },
    };
  } catch (error) {
    context.log("Error analyzing video:", error as any);
    const message = (error as Error)?.message;
    if (message === "INVALID_VIDEO") return { status: 400, jsonBody: { error: "Invalid or missing video file" } };
    if (message === "INVALID_MILESTONE_ID") return { status: 400, jsonBody: { error: "Invalid or missing milestone ID" } };
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("analyze", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: withApiKeyAuth(analyze),
});
