import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getMilestoneById } from "../db/queries/milestones-queries";
import { getValidatorsByMilestone } from "../db/queries/validators-queries";
import { getCurrentSystemPrompt } from "../db/queries/system-prompt-queries";
import {
  getDefaultPolicy,
  getPolicyById,
} from "../db/queries/policies-queries";
import { GoogleGenAI, Type } from "@google/genai";
import { withApiKeyAuth } from "../middleware/keys-middleware";

export async function analyze(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const formData = await request.formData();
    const video = formData.get("video");
    const milestoneIdRaw = formData.get("milestoneId");

    if (!(video instanceof File)) {
      return {
        status: 400,
        jsonBody: { error: "Invalid or missing video file" },
      };
    }

    let milestoneId: number | null = null;
    if (typeof milestoneIdRaw === "string") {
      const parsedMilestoneId = parseInt(milestoneIdRaw);
      if (!isNaN(parsedMilestoneId)) {
        milestoneId = parsedMilestoneId;
      }
    } else if (typeof milestoneIdRaw === "number") {
      milestoneId = milestoneIdRaw;
    }

    if (!Number.isInteger(milestoneId)) {
      return {
        status: 400,
        jsonBody: { error: "Invalid or missing milestone ID" },
      };
    }

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

    const basePrompt = systemPrompt.content;

    const validatorsList = milestoneValidators
      .map((v: any) => `- ${v.description}`)
      .join("\n");
    const sections = [
      basePrompt,
      `Milestone: ${milestone.name}`,
      `Validators:\n${validatorsList}`,
    ];
    const finalPrompt = sections.filter(Boolean).join("\n\n");

    const fileObj = video as File;
    const arrayBuffer = await fileObj.arrayBuffer();
    const base64Video = Buffer.from(arrayBuffer).toString("base64");

    const reportedType = (fileObj.type || "").toLowerCase();
    const isGenericType =
      !reportedType || reportedType === "application/octet-stream";
    const fileExt = (fileObj.name.split(".").pop() || "").toLowerCase();
    const extToMime: Record<string, string> = {
      mp4: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
      mpeg: "video/mpeg",
      mpg: "video/mpeg",
      m4v: "video/mp4",
      qt: "video/quicktime",
      "3gp": "video/3gpp",
      "3gpp": "video/3gpp",
      "3g2": "video/3gpp2",
      "3gpp2": "video/3gpp2",
    };
    const inferredType = extToMime[fileExt] || "video/mp4";
    const mimeType = isGenericType ? inferredType : reportedType;

    const contents = [
      {
        inlineData: {
          mimeType,
          data: base64Video,
        },
      },
      { text: finalPrompt },
    ];

    const startTime = performance.now();
    console.log(`starting to send request to google`);
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            validators: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  result: { type: Type.BOOLEAN },
                },
              },
            },
            confidence: { type: Type.NUMBER },
          },
          propertyOrdering: ["validators", "confidence"],
          required: ["validators", "confidence"],
          additionalProperties: false,
          strict: true,
        },
      },
    });

    const endTime = performance.now();
    console.log(
      `Time taken to send request to google: ${(
        (endTime - startTime) /
        1000
      ).toFixed(2)}s`
    );
    let responseJson: {
      validators: Array<{ description: string; result: boolean }>;
      confidence: number;
    };
    try {
      responseJson = JSON.parse(response.text);
    } catch (error) {
      context.log("Error parsing response from google:", error as any);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }

    const policy = milestone.policyId
      ? await getPolicyById(milestone.policyId)
      : await getDefaultPolicy();

    if (!policy) {
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }

    const total = Array.isArray(responseJson.validators)
      ? responseJson.validators.length
      : 0;
    const passed =
      total > 0
        ? responseJson.validators.filter((v) => v?.result === true).length
        : 0;
    const percentPassed = total > 0 ? (passed / total) * 100 : 0;
    const confidencePct =
      typeof responseJson.confidence === "number"
        ? responseJson.confidence * 100
        : 0;
    const result =
      percentPassed >= policy.minValidatorsPassed &&
      confidencePct >= policy.minConfidence;

    return {
      status: 200,
      jsonBody: {
        milestoneId,
        result,
        confidence: responseJson.confidence,
        validators: responseJson.validators,
        policy: {
          minValidatorsPassed: policy.minValidatorsPassed,
          minConfidence: policy.minConfidence,
        },
      },
    };
  } catch (error) {
    context.log("Error analyzing video:", error as any);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("analyze", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: withApiKeyAuth(analyze),
});
