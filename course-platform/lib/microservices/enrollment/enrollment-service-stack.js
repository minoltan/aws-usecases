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
exports.EnrollmentServiceStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigwv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigwv2Integrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const create_handler_1 = require("../../shared/create-handler");
const create_stream_pipe_1 = require("../../shared/create-stream-pipe");
const EVENT_SOURCE = 'course-platform.enrollment';
/**
 * Enrollment & Payments is the one microservice with a plain HTTP endpoint alongside its
 * AppSync-fronted operations: payment webhooks are fired by an external payment provider
 * that cannot call GraphQL, so `paymentWebhook` gets its own HttpApi route rather than a
 * resolver -- a deliberate, documented exception to the "everything through AppSync" rule.
 */
class EnrollmentServiceStack extends cdk.Stack {
    enrollFn;
    getEnrollmentFn;
    listEnrollmentsForUserFn;
    cancelEnrollmentFn;
    webhookUrl;
    constructor(scope, id, props) {
        super(scope, id, props);
        const environment = {
            TABLE_NAME: props.table.tableName,
            EVENT_BUS_NAME: props.eventBus.eventBusName,
            EVENT_SOURCE,
        };
        this.enrollFn = (0, create_handler_1.createHandler)(this, 'EnrollFunction', {
            domain: 'enrollment',
            name: 'enroll',
            environment,
        });
        this.getEnrollmentFn = (0, create_handler_1.createHandler)(this, 'GetEnrollmentFunction', {
            domain: 'enrollment',
            name: 'getEnrollment',
            environment,
        });
        this.listEnrollmentsForUserFn = (0, create_handler_1.createHandler)(this, 'ListEnrollmentsForUserFunction', {
            domain: 'enrollment',
            name: 'listEnrollmentsForUser',
            environment,
        });
        this.cancelEnrollmentFn = (0, create_handler_1.createHandler)(this, 'CancelEnrollmentFunction', {
            domain: 'enrollment',
            name: 'cancelEnrollment',
            environment,
        });
        props.table.grantReadWriteData(this.enrollFn);
        props.table.grantReadData(this.getEnrollmentFn);
        props.table.grantReadData(this.listEnrollmentsForUserFn);
        props.table.grantReadWriteData(this.cancelEnrollmentFn);
        props.eventBus.grantPutEventsTo(this.enrollFn);
        props.eventBus.grantPutEventsTo(this.cancelEnrollmentFn);
        // Demo-scope shared secret standing in for the payment provider's webhook signing
        // secret (e.g. Stripe's whsec_*) -- a real deployment would rotate this out-of-band.
        const webhookSecret = new secretsmanager.Secret(this, 'PaymentWebhookSecret', {
            description: 'HMAC secret used to verify inbound payment webhook signatures',
        });
        const paymentWebhookFn = (0, create_handler_1.createHandler)(this, 'PaymentWebhookFunction', {
            domain: 'enrollment',
            name: 'paymentWebhook',
            environment: {
                ...environment,
                WEBHOOK_SECRET_ARN: webhookSecret.secretArn,
            },
        });
        props.table.grantReadWriteData(paymentWebhookFn);
        props.eventBus.grantPutEventsTo(paymentWebhookFn);
        webhookSecret.grantRead(paymentWebhookFn);
        const httpApi = new apigwv2.HttpApi(this, 'PaymentWebhookApi', {
            apiName: `course-platform-${props.envConfig.envName}-payment-webhook`,
            description: 'Public webhook receiver for payment provider callbacks',
        });
        httpApi.addRoutes({
            path: '/webhooks/payment',
            methods: [apigwv2.HttpMethod.POST],
            integration: new apigwv2Integrations.HttpLambdaIntegration('PaymentWebhookIntegration', paymentWebhookFn),
        });
        this.webhookUrl = `${httpApi.apiEndpoint}/webhooks/payment`;
        (0, create_stream_pipe_1.createStreamToEventBridgePipe)(this, 'EnrollmentStreamPipe', {
            tableStreamArn: props.tableStreamArn,
            eventBus: props.eventBus,
            source: EVENT_SOURCE,
            detailType: 'EnrollmentDataChanged',
        });
        const cmService = props.namespace.createService('EnrollmentRegistry', {
            name: 'enrollment-payments',
            description: 'Enrollment & Payments microservice',
        });
        cmService.registerNonIpInstance('Instance', {
            customAttributes: {
                WEBHOOK_URL: this.webhookUrl,
                LAMBDA_ENTRYPOINT_ARN: this.getEnrollmentFn.functionArn,
            },
        });
        new cdk.CfnOutput(this, 'PaymentWebhookUrl', {
            value: this.webhookUrl,
            exportName: `course-platform-${props.envConfig.envName}-PaymentWebhookUrl`,
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        cdk.Tags.of(this).add('Microservice', 'enrollment');
    }
}
exports.EnrollmentServiceStack = EnrollmentServiceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5yb2xsbWVudC1zZXJ2aWNlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZW5yb2xsbWVudC1zZXJ2aWNlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxzRUFBd0Q7QUFDeEQsK0ZBQWlGO0FBSWpGLCtFQUFpRTtBQUlqRSxnRUFBNEQ7QUFDNUQsd0VBQWdGO0FBVWhGLE1BQU0sWUFBWSxHQUFHLDRCQUE0QixDQUFDO0FBRWxEOzs7OztHQUtHO0FBQ0gsTUFBYSxzQkFBdUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNuQyxRQUFRLENBQWlCO0lBQ3pCLGVBQWUsQ0FBaUI7SUFDaEMsd0JBQXdCLENBQWlCO0lBQ3pDLGtCQUFrQixDQUFpQjtJQUNuQyxVQUFVLENBQVM7SUFFbkMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrQztRQUMxRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFdBQVcsR0FBRztZQUNsQixVQUFVLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTO1lBQ2pDLGNBQWMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLFlBQVk7WUFDM0MsWUFBWTtTQUNiLENBQUM7UUFFRixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUEsOEJBQWEsRUFBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDcEQsTUFBTSxFQUFFLFlBQVk7WUFDcEIsSUFBSSxFQUFFLFFBQVE7WUFDZCxXQUFXO1NBQ1osQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFBLDhCQUFhLEVBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ2xFLE1BQU0sRUFBRSxZQUFZO1lBQ3BCLElBQUksRUFBRSxlQUFlO1lBQ3JCLFdBQVc7U0FDWixDQUFDLENBQUM7UUFDSCxJQUFJ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QUFDLENBQUM7UUFDSCxTQUFTLENBQUMscUJBQXFCLENBQUMsVUFBVSxFQUFFO1lBQzFDLGdCQUFnQixFQUFFO2dCQUNoQixXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVU7Z0JBQzVCLHFCQUFxQixFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVzthQUN4RDtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVO1lBQ3RCLFVBQVUsRUFBRSxtQkFBbUIsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLG9CQUFvQjtTQUMzRSxDQUFDLENBQUM7UUFFSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDcEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzlELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDdEQsQ0FBQztDQUNGO0FBckdELHdEQXFHQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBhcGlnd3YyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgYXBpZ3d2MkludGVncmF0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgeyBJVGFibGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24gfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcyc7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0ICogYXMgc2VydmljZWRpc2NvdmVyeSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VydmljZWRpc2NvdmVyeSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50JztcbmltcG9ydCB7IGNyZWF0ZUhhbmRsZXIgfSBmcm9tICcuLi8uLi9zaGFyZWQvY3JlYXRlLWhhbmRsZXInO1xuaW1wb3J0IHsgY3JlYXRlU3RyZWFtVG9FdmVudEJyaWRnZVBpcGUgfSBmcm9tICcuLi8uLi9zaGFyZWQvY3JlYXRlLXN0cmVhbS1waXBlJztcblxuZXhwb3J0IGludGVyZmFjZSBFbnJvbGxtZW50U2VydmljZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudkNvbmZpZzogRW52aXJvbm1lbnRDb25maWc7XG4gIHRhYmxlOiBJVGFibGU7XG4gIHRhYmxlU3RyZWFtQXJuOiBzdHJpbmc7XG4gIGV2ZW50QnVzOiBldmVudHMuSUV2ZW50QnVzO1xuICBuYW1lc3BhY2U6IHNlcnZpY2VkaXNjb3ZlcnkuSHR0cE5hbWVzcGFjZTtcbn1cblxuY29uc3QgRVZFTlRfU09VUkNFID0gJ2NvdXJzZS1wbGF0Zm9ybS5lbnJvbGxtZW50JztcblxuLyoqXG4gKiBFbnJvbGxtZW50ICYgUGF5bWVudHMgaXMgdGhlIG9uZSBtaWNyb3NlcnZpY2Ugd2l0aCBhIHBsYWluIEhUVFAgZW5kcG9pbnQgYWxvbmdzaWRlIGl0c1xuICogQXBwU3luYy1mcm9udGVkIG9wZXJhdGlvbnM6IHBheW1lbnQgd2ViaG9va3MgYXJlIGZpcmVkIGJ5IGFuIGV4dGVybmFsIHBheW1lbnQgcHJvdmlkZXJcbiAqIHRoYXQgY2Fubm90IGNhbGwgR3JhcGhRTCwgc28gYHBheW1lbnRXZWJob29rYCBnZXRzIGl0cyBvd24gSHR0cEFwaSByb3V0ZSByYXRoZXIgdGhhbiBhXG4gKiByZXNvbHZlciAtLSBhIGRlbGliZXJhdGUsIGRvY3VtZW50ZWQgZXhjZXB0aW9uIHRvIHRoZSBcImV2ZXJ5dGhpbmcgdGhyb3VnaCBBcHBTeW5jXCIgcnVsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEVucm9sbG1lbnRTZXJ2aWNlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZW5yb2xsRm46IE5vZGVqc0Z1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZ2V0RW5yb2xsbWVudEZuOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGxpc3RFbnJvbGxtZW50c0ZvclVzZXJGbjogTm9kZWpzRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBjYW5jZWxFbnJvbGxtZW50Rm46IE5vZGVqc0Z1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViaG9va1VybDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBFbnJvbGxtZW50U2VydmljZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGVudmlyb25tZW50ID0ge1xuICAgICAgVEFCTEVfTkFNRTogcHJvcHMudGFibGUudGFibGVOYW1lLFxuICAgICAgRVZFTlRfQlVTX05BTUU6IHByb3BzLmV2ZW50QnVzLmV2ZW50QnVzTmFtZSxcbiAgICAgIEVWRU5UX1NPVVJDRSxcbiAgICB9O1xuXG4gICAgdGhpcy5lbnJvbGxGbiA9IGNyZWF0ZUhhbmRsZXIodGhpcywgJ0Vucm9sbEZ1bmN0aW9uJywge1xuICAgICAgZG9tYWluOiAnZW5yb2xsbWVudCcsXG4gICAgICBuYW1lOiAnZW5yb2xsJyxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0pO1xuICAgIHRoaXMuZ2V0RW5yb2xsbWVudEZuID0gY3JlYXRlSGFuZGxlcih0aGlzLCAnR2V0RW5yb2xsbWVudEZ1bmN0aW9uJywge1xuICAgICAgZG9tYWluOiAnZW5yb2xsbWVudCcsXG4gICAgICBuYW1lOiAnZ2V0RW5yb2xsbWVudCcsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICB9KTtcbiAgICB0aGlzLmxpc3RFbnJvbGxtZW50c0ZvclVzZXJGbiA9IGNyZWF0ZUhhbmRsZXIodGhpcywgJ0xpc3RFbnJvbGxtZW50c0ZvclVzZXJGdW5jdGlvbicsIHtcbiAgICAgIGRvbWFpbjogJ2Vucm9sbG1lbnQnLFxuICAgICAgbmFtZTogJ2xpc3RFbnJvbGxtZW50c0ZvclVzZXInLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgfSk7XG4gICAgdGhpcy5jYW5jZWxFbnJvbGxtZW50Rm4gPSBjcmVhdGVIYW5kbGVyKHRoaXMsICdDYW5jZWxFbnJvbGxtZW50RnVuY3Rpb24nLCB7XG4gICAgICBkb21haW46ICdlbnJvbGxtZW50JyxcbiAgICAgIG5hbWU6ICdjYW5jZWxFbnJvbGxtZW50JyxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgcHJvcHMudGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuZW5yb2xsRm4pO1xuICAgIHByb3BzLnRhYmxlLmdyYW50UmVhZERhdGEodGhpcy5nZXRFbnJvbGxtZW50Rm4pO1xuICAgIHByb3BzLnRhYmxlLmdyYW50UmVhZERhdGEodGhpcy5saXN0RW5yb2xsbWVudHNGb3JVc2VyRm4pO1xuICAgIHByb3BzLnRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLmNhbmNlbEVucm9sbG1lbnRGbik7XG5cbiAgICBwcm9wcy5ldmVudEJ1cy5ncmFudFB1dEV2ZW50c1RvKHRoaXMuZW5yb2xsRm4pO1xuICAgIHByb3BzLmV2ZW50QnVzLmdyYW50UHV0RXZlbnRzVG8odGhpcy5jYW5jZWxFbnJvbGxtZW50Rm4pO1xuXG4gICAgLy8gRGVtby1zY29wZSBzaGFyZWQgc2VjcmV0IHN0YW5kaW5nIGluIGZvciB0aGUgcGF5bWVudCBwcm92aWRlcidzIHdlYmhvb2sgc2lnbmluZ1xuICAgIC8vIHNlY3JldCAoZS5nLiBTdHJpcGUncyB3aHNlY18qKSAtLSBhIHJlYWwgZGVwbG95bWVudCB3b3VsZCByb3RhdGUgdGhpcyBvdXQtb2YtYmFuZC5cbiAgICBjb25zdCB3ZWJob29rU2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnUGF5bWVudFdlYmhvb2tTZWNyZXQnLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ0hNQUMgc2VjcmV0IHVzZWQgdG8gdmVyaWZ5IGluYm91bmQgcGF5bWVudCB3ZWJob29rIHNpZ25hdHVyZXMnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcGF5bWVudFdlYmhvb2tGbiA9IGNyZWF0ZUhhbmRsZXIodGhpcywgJ1BheW1lbnRXZWJob29rRnVuY3Rpb24nLCB7XG4gICAgICBkb21haW46ICdlbnJvbGxtZW50JyxcbiAgICAgIG5hbWU6ICdwYXltZW50V2ViaG9vaycsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5lbnZpcm9ubWVudCxcbiAgICAgICAgV0VCSE9PS19TRUNSRVRfQVJOOiB3ZWJob29rU2VjcmV0LnNlY3JldEFybixcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgcHJvcHMudGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHBheW1lbnRXZWJob29rRm4pO1xuICAgIHByb3BzLmV2ZW50QnVzLmdyYW50UHV0RXZlbnRzVG8ocGF5bWVudFdlYmhvb2tGbik7XG4gICAgd2ViaG9va1NlY3JldC5ncmFudFJlYWQocGF5bWVudFdlYmhvb2tGbik7XG5cbiAgICBjb25zdCBodHRwQXBpID0gbmV3IGFwaWd3djIuSHR0cEFwaSh0aGlzLCAnUGF5bWVudFdlYmhvb2tBcGknLCB7XG4gICAgICBhcGlOYW1lOiBgY291cnNlLXBsYXRmb3JtLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9LXBheW1lbnQtd2ViaG9va2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1B1YmxpYyB3ZWJob29rIHJlY2VpdmVyIGZvciBwYXltZW50IHByb3ZpZGVyIGNhbGxiYWNrcycsXG4gICAgfSk7XG4gICAgaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy93ZWJob29rcy9wYXltZW50JyxcbiAgICAgIG1ldGhvZHM6IFthcGlnd3YyLkh0dHBNZXRob2QuUE9TVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogbmV3IGFwaWd3djJJbnRlZ3JhdGlvbnMuSHR0cExhbWJkYUludGVncmF0aW9uKCdQYXltZW50V2ViaG9va0ludGVncmF0aW9uJywgcGF5bWVudFdlYmhvb2tGbiksXG4gICAgfSk7XG4gICAgdGhpcy53ZWJob29rVXJsID0gYCR7aHR0cEFwaS5hcGlFbmRwb2ludH0vd2ViaG9va3MvcGF5bWVudGA7XG5cbiAgICBjcmVhdGVTdHJlYW1Ub0V2ZW50QnJpZGdlUGlwZSh0aGlzLCAnRW5yb2xsbWVudFN0cmVhbVBpcGUnLCB7XG4gICAgICB0YWJsZVN0cmVhbUFybjogcHJvcHMudGFibGVTdHJlYW1Bcm4sXG4gICAgICBldmVudEJ1czogcHJvcHMuZXZlbnRCdXMsXG4gICAgICBzb3VyY2U6IEVWRU5UX1NPVVJDRSxcbiAgICAgIGRldGFpbFR5cGU6ICdFbnJvbGxtZW50RGF0YUNoYW5nZWQnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY21TZXJ2aWNlID0gcHJvcHMubmFtZXNwYWNlLmNyZWF0ZVNlcnZpY2UoJ0Vucm9sbG1lbnRSZWdpc3RyeScsIHtcbiAgICAgIG5hbWU6ICdlbnJvbGxtZW50LXBheW1lbnRzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW5yb2xsbWVudCAmIFBheW1lbnRzIG1pY3Jvc2VydmljZScsXG4gICAgfSk7XG4gICAgY21TZXJ2aWNlLnJlZ2lzdGVyTm9uSXBJbnN0YW5jZSgnSW5zdGFuY2UnLCB7XG4gICAgICBjdXN0b21BdHRyaWJ1dGVzOiB7XG4gICAgICAgIFdFQkhPT0tfVVJMOiB0aGlzLndlYmhvb2tVcmwsXG4gICAgICAgIExBTUJEQV9FTlRSWVBPSU5UX0FSTjogdGhpcy5nZXRFbnJvbGxtZW50Rm4uZnVuY3Rpb25Bcm4sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1BheW1lbnRXZWJob29rVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMud2ViaG9va1VybCxcbiAgICAgIGV4cG9ydE5hbWU6IGBjb3Vyc2UtcGxhdGZvcm0tJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX0tUGF5bWVudFdlYmhvb2tVcmxgLFxuICAgIH0pO1xuXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ2NvdXJzZS1wbGF0Zm9ybScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZDb25maWcuZW52TmFtZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNaWNyb3NlcnZpY2UnLCAnZW5yb2xsbWVudCcpO1xuICB9XG59XG4iXX0=