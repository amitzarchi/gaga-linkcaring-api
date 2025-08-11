import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getMilestoneById } from "../db/queries/milestones-queries";

export async function analyze(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    try {
        const milestone = await getMilestoneById(1);

        if (!milestone) {
            return { status: 404, jsonBody: { error: "Milestone not found" } };
        }

        return { status: 200, jsonBody: milestone };
    } catch (error) {
        context.log("Error fetching milestone:", error as any);
        return { status: 500, jsonBody: { error: "Internal server error" } };
    }
};

app.http('analyze', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: analyze
});
