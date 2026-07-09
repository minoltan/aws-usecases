"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStreamToEventBridgePipe = createStreamToEventBridgePipe;
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const aws_pipes_1 = require("aws-cdk-lib/aws-pipes");
/**
 * DynamoDB Streams -> EventBridge Pipe (no Lambda glue), reshaping change records straight
 * onto the shared bus. This is the modern replacement for the book's "DynamoDB Streams +
 * Lambda kept a materialized Firebase view in sync" pattern (Serverless Architectures on
 * AWS, 2nd Ed., section 5.2) -- it's what lets the analytics microservice observe every
 * other microservice's data changes without a hard dependency.
 */
function createStreamToEventBridgePipe(scope, id, props) {
    const role = new iam.Role(scope, `${id}Role`, {
        assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
    });
    role.addToPolicy(new iam.PolicyStatement({
        actions: ['dynamodb:DescribeStream', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator', 'dynamodb:ListStreams'],
        resources: [props.tableStreamArn],
    }));
    props.eventBus.grantPutEventsTo(role);
    return new aws_pipes_1.CfnPipe(scope, id, {
        name: id,
        roleArn: role.roleArn,
        source: props.tableStreamArn,
        sourceParameters: {
            dynamoDbStreamParameters: { startingPosition: 'LATEST', batchSize: 10 },
        },
        target: props.eventBus.eventBusArn,
        targetParameters: {
            eventBridgeEventBusParameters: {
                detailType: props.detailType,
                source: props.source,
            },
            inputTemplate: '{"eventName": <$.eventName>, "keys": <$.dynamodb.Keys>, "newImage": <$.dynamodb.NewImage>, "oldImage": <$.dynamodb.OldImage>}',
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLXN0cmVhbS1waXBlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY3JlYXRlLXN0cmVhbS1waXBlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBc0JBLHNFQTZCQztBQW5ERCx5REFBMkM7QUFDM0MscURBQWdEO0FBY2hEOzs7Ozs7R0FNRztBQUNILFNBQWdCLDZCQUE2QixDQUFDLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO0lBQ2hHLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRTtRQUM1QyxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMscUJBQXFCLENBQUM7S0FDM0QsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxDQUFDLFdBQVcsQ0FDZCxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7UUFDdEIsT0FBTyxFQUFFLENBQUMseUJBQXlCLEVBQUUscUJBQXFCLEVBQUUsMkJBQTJCLEVBQUUsc0JBQXNCLENBQUM7UUFDaEgsU0FBUyxFQUFFLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQztLQUNsQyxDQUFDLENBQ0gsQ0FBQztJQUNGLEtBQUssQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFdEMsT0FBTyxJQUFJLG1CQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRTtRQUM1QixJQUFJLEVBQUUsRUFBRTtRQUNSLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztRQUNyQixNQUFNLEVBQUUsS0FBSyxDQUFDLGNBQWM7UUFDNUIsZ0JBQWdCLEVBQUU7WUFDaEIsd0JBQXdCLEVBQUUsRUFBRSxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtTQUN4RTtRQUNELE1BQU0sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVc7UUFDbEMsZ0JBQWdCLEVBQUU7WUFDaEIsNkJBQTZCLEVBQUU7Z0JBQzdCLFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVTtnQkFDNUIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNO2FBQ3JCO1lBQ0QsYUFBYSxFQUNYLCtIQUErSDtTQUNsSTtLQUNGLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDZm5QaXBlIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLXBpcGVzJztcbmltcG9ydCB7IElFdmVudEJ1cyB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RyZWFtUGlwZVByb3BzIHtcbiAgLyoqIER5bmFtb0RCIHRhYmxlIHN0cmVhbSBBUk4gdG8gcmVhZCBmcm9tLiAqL1xuICB0YWJsZVN0cmVhbUFybjogc3RyaW5nO1xuICBldmVudEJ1czogSUV2ZW50QnVzO1xuICAvKiogRXZlbnRCcmlkZ2UgYHNvdXJjZWAgdG8gc3RhbXAgb24gZW1pdHRlZCBldmVudHMsIGUuZy4gJ2NvdXJzZS1wbGF0Zm9ybS5jb3Vyc2UtY2F0YWxvZycuICovXG4gIHNvdXJjZTogc3RyaW5nO1xuICAvKiogRXZlbnRCcmlkZ2UgYGRldGFpbC10eXBlYCB0byBzdGFtcCBvbiBlbWl0dGVkIGV2ZW50cywgZS5nLiAnQ291cnNlQ2F0YWxvZ0RhdGFDaGFuZ2VkJy4gKi9cbiAgZGV0YWlsVHlwZTogc3RyaW5nO1xufVxuXG4vKipcbiAqIER5bmFtb0RCIFN0cmVhbXMgLT4gRXZlbnRCcmlkZ2UgUGlwZSAobm8gTGFtYmRhIGdsdWUpLCByZXNoYXBpbmcgY2hhbmdlIHJlY29yZHMgc3RyYWlnaHRcbiAqIG9udG8gdGhlIHNoYXJlZCBidXMuIFRoaXMgaXMgdGhlIG1vZGVybiByZXBsYWNlbWVudCBmb3IgdGhlIGJvb2sncyBcIkR5bmFtb0RCIFN0cmVhbXMgK1xuICogTGFtYmRhIGtlcHQgYSBtYXRlcmlhbGl6ZWQgRmlyZWJhc2UgdmlldyBpbiBzeW5jXCIgcGF0dGVybiAoU2VydmVybGVzcyBBcmNoaXRlY3R1cmVzIG9uXG4gKiBBV1MsIDJuZCBFZC4sIHNlY3Rpb24gNS4yKSAtLSBpdCdzIHdoYXQgbGV0cyB0aGUgYW5hbHl0aWNzIG1pY3Jvc2VydmljZSBvYnNlcnZlIGV2ZXJ5XG4gKiBvdGhlciBtaWNyb3NlcnZpY2UncyBkYXRhIGNoYW5nZXMgd2l0aG91dCBhIGhhcmQgZGVwZW5kZW5jeS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0cmVhbVRvRXZlbnRCcmlkZ2VQaXBlKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTdHJlYW1QaXBlUHJvcHMpOiBDZm5QaXBlIHtcbiAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZShzY29wZSwgYCR7aWR9Um9sZWAsIHtcbiAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgncGlwZXMuYW1hem9uYXdzLmNvbScpLFxuICB9KTtcbiAgcm9sZS5hZGRUb1BvbGljeShcbiAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2R5bmFtb2RiOkRlc2NyaWJlU3RyZWFtJywgJ2R5bmFtb2RiOkdldFJlY29yZHMnLCAnZHluYW1vZGI6R2V0U2hhcmRJdGVyYXRvcicsICdkeW5hbW9kYjpMaXN0U3RyZWFtcyddLFxuICAgICAgcmVzb3VyY2VzOiBbcHJvcHMudGFibGVTdHJlYW1Bcm5dLFxuICAgIH0pXG4gICk7XG4gIHByb3BzLmV2ZW50QnVzLmdyYW50UHV0RXZlbnRzVG8ocm9sZSk7XG5cbiAgcmV0dXJuIG5ldyBDZm5QaXBlKHNjb3BlLCBpZCwge1xuICAgIG5hbWU6IGlkLFxuICAgIHJvbGVBcm46IHJvbGUucm9sZUFybixcbiAgICBzb3VyY2U6IHByb3BzLnRhYmxlU3RyZWFtQXJuLFxuICAgIHNvdXJjZVBhcmFtZXRlcnM6IHtcbiAgICAgIGR5bmFtb0RiU3RyZWFtUGFyYW1ldGVyczogeyBzdGFydGluZ1Bvc2l0aW9uOiAnTEFURVNUJywgYmF0Y2hTaXplOiAxMCB9LFxuICAgIH0sXG4gICAgdGFyZ2V0OiBwcm9wcy5ldmVudEJ1cy5ldmVudEJ1c0FybixcbiAgICB0YXJnZXRQYXJhbWV0ZXJzOiB7XG4gICAgICBldmVudEJyaWRnZUV2ZW50QnVzUGFyYW1ldGVyczoge1xuICAgICAgICBkZXRhaWxUeXBlOiBwcm9wcy5kZXRhaWxUeXBlLFxuICAgICAgICBzb3VyY2U6IHByb3BzLnNvdXJjZSxcbiAgICAgIH0sXG4gICAgICBpbnB1dFRlbXBsYXRlOlxuICAgICAgICAne1wiZXZlbnROYW1lXCI6IDwkLmV2ZW50TmFtZT4sIFwia2V5c1wiOiA8JC5keW5hbW9kYi5LZXlzPiwgXCJuZXdJbWFnZVwiOiA8JC5keW5hbW9kYi5OZXdJbWFnZT4sIFwib2xkSW1hZ2VcIjogPCQuZHluYW1vZGIuT2xkSW1hZ2U+fScsXG4gICAgfSxcbiAgfSk7XG59XG4iXX0=