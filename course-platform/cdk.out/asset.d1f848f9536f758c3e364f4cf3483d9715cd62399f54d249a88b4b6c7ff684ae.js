// Shared AppSync JS unit resolver reused by every Lambda data source in this API.
// Every microservice operation invokes its own Lambda directly, without stitching
// through an inner API Gateway (see appsync-stack.ts for why this deviates from the
// book's Apollo-on-Lambda-behind-API-Gateway BFF).
export function request(ctx) {
    return {
        operation: "Invoke",
        payload: {
            arguments: ctx.arguments,
            identity: ctx.identity,
            source: ctx.source,
        },
    };
}

export function response(ctx) {
    return ctx.result;
}
