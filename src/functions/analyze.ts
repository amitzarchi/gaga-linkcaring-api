import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { extractApiKey, withApiKeyAuth } from "../middleware/keys-middleware";
import { getMilestoneById } from "../db/queries/milestones-queries";
import { getValidatorsByMilestone } from "../db/queries/validators-queries";
import { getCurrentSystemPrompt } from "../db/queries/system-prompt-queries";
import { getDefaultPolicy, getPolicyById } from "../db/queries/policies-queries";
import { parseAnalyzeForm } from "../services/analyze/parse-request";
import { buildPrompt } from "../services/analyze/prompt";
import { runVideoAnalysis } from "../services/analyze/model";
import { evaluatePolicy } from "../services/analyze/policy";
import { getActiveModel } from "../db/queries/models-queries";
import { getApiKeyByKey } from "../db/queries/api-keys-queries";
import { apiKeys, policies } from "../db/schema";
import { insertResponseStat } from "../db/queries/response-stats-queries";
import { handleVideoFromRequest } from "../services/analyze/video-processor";

export async function analyze(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const apiKeyPromise: Promise<typeof apiKeys.$inferSelect> = getApiKeyByKey(extractApiKey(request));

    // Handle video input (file or URL) and validate
    const { formData, preProcessedVideo } = await handleVideoFromRequest(request);
    
    // Start measuring time after URL fetch (if any) and before parseAnalyzeForm
    const startTime = Date.now();

    const { milestoneId, video: processedVideo } = await parseAnalyzeForm(formData, preProcessedVideo);

    const [milestone, milestoneValidators, systemPrompt, activeModel] = await Promise.all([
      getMilestoneById(milestoneId),
      getValidatorsByMilestone(milestoneId),
      getCurrentSystemPrompt(),
      getActiveModel(),
    ]);
    const policyPromise: Promise<typeof policies.$inferSelect> = milestone.policyId
      ? getPolicyById(milestone.policyId)
      : getDefaultPolicy();

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

    if (!activeModel) {
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }

    const analysis = await runVideoAnalysis(processedVideo, finalPrompt, activeModel.model);

    const policy = await policyPromise;
    if (!policy) {
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }

    const { result, confidence, validators } = evaluatePolicy(analysis.ModelResponse, {
      minValidatorsPassed: policy.minValidatorsPassed,
      minConfidence: policy.minConfidence,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    const apiKey = await apiKeyPromise;
    const validatorsTotal = Array.isArray(validators) ? validators.length : 0;
    const validatorsPassed = validatorsTotal > 0 ? validators.filter(v => v?.result === true).length : 0;

    await insertResponseStat({
      status: "SUCCESS",
      httpStatus: 200,
      requestId: (context as any).invocationId,
      apiKeyId: apiKey?.id ?? null,
      milestoneId,
      systemPromptId: systemPrompt.id,
      policyId: milestone.policyId ?? null,
      model: activeModel.model,
      totalTokenCount: analysis.totalTokenCount ?? null,
      result,
      confidence: Math.round((typeof confidence === "number" ? confidence : 0) * 100),
      validatorsTotal,
      validatorsPassed,
      processingMs: duration,
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
    const httpStatus = message === "INVALID_VIDEO" || message === "INVALID_MILESTONE_ID" ? 400 : 500;
    try {
      const keyVal = extractApiKey(request);
      const apiKeyRow = keyVal ? await getApiKeyByKey(keyVal) : undefined;
      await insertResponseStat({
        status: "ERROR",
        httpStatus,
        errorCode: message,
        requestId: context.invocationId,
        apiKeyId: apiKeyRow?.id ?? null,
      });
    } catch {}
    if (message === "INVALID_VIDEO") return { status: 400, jsonBody: { error: "Invalid or missing video file/URL, or both provided" } };
    if (message === "INVALID_MILESTONE_ID") return { status: 400, jsonBody: { error: "Invalid or missing milestone ID" } };
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("analyze", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: withApiKeyAuth(analyze),
});
