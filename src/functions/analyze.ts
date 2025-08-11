import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { withApiKeyAuth } from "../middleware/keys-middleware";

export async function analyze(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    const name = request.query.get('name') || await request.text() || 'world';

    return { body: `Hello, ${name}!` };
};

app.http('analyze', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: analyze
});
