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
exports.DiscussionServiceStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const create_handler_1 = require("../../shared/create-handler");
const create_stream_pipe_1 = require("../../shared/create-stream-pipe");
const EVENT_SOURCE = 'course-platform.discussion';
/**
 * Real-time forum -- the direct modern replacement for the book's Firebase-websocket
 * discussion forum (Serverless Architectures on AWS, 2nd Ed., 5.1). `postMessage` is
 * annotated `@aws_subscribe` in the AppSync schema, so posting *is* the thing clients
 * subscribe to; no separate "None" passthrough resolver is needed.
 */
class DiscussionServiceStack extends cdk.Stack {
    createThreadFn;
    postMessageFn;
    listMessagesFn;
    listThreadsFn;
    constructor(scope, id, props) {
        super(scope, id, props);
        const environment = {
            TABLE_NAME: props.table.tableName,
            EVENT_BUS_NAME: props.eventBus.eventBusName,
            EVENT_SOURCE,
        };
        this.createThreadFn = (0, create_handler_1.createHandler)(this, 'CreateThreadFunction', {
            domain: 'discussion',
            name: 'createThread',
            environment,
        });
        this.postMessageFn = (0, create_handler_1.createHandler)(this, 'PostMessageFunction', {
            domain: 'discussion',
            name: 'postMessage',
            environment,
        });
        this.listMessagesFn = (0, create_handler_1.createHandler)(this, 'ListMessagesFunction', {
            domain: 'discussion',
            name: 'listMessages',
            environment,
        });
        this.listThreadsFn = (0, create_handler_1.createHandler)(this, 'ListThreadsFunction', {
            domain: 'discussion',
            name: 'listThreads',
            environment,
        });
        props.table.grantReadWriteData(this.createThreadFn);
        props.table.grantReadWriteData(this.postMessageFn);
        props.table.grantReadData(this.listMessagesFn);
        props.table.grantReadData(this.listThreadsFn);
        props.eventBus.grantPutEventsTo(this.createThreadFn);
        props.eventBus.grantPutEventsTo(this.postMessageFn);
        (0, create_stream_pipe_1.createStreamToEventBridgePipe)(this, 'DiscussionStreamPipe', {
            tableStreamArn: props.tableStreamArn,
            eventBus: props.eventBus,
            source: EVENT_SOURCE,
            detailType: 'DiscussionDataChanged',
        });
        const cmService = props.namespace.createService('DiscussionRegistry', {
            name: 'discussion-forum',
            description: 'Discussion Forum microservice',
        });
        cmService.registerNonIpInstance('Instance', {
            customAttributes: {
                LAMBDA_ENTRYPOINT_ARN: this.listThreadsFn.functionArn,
                SCHEMA_VERSION: '1.0',
            },
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        cdk.Tags.of(this).add('Microservice', 'discussion');
    }
}
exports.DiscussionServiceStack = DiscussionServiceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlzY3Vzc2lvbi1zZXJ2aWNlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGlzY3Vzc2lvbi1zZXJ2aWNlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQU9uQyxnRUFBNEQ7QUFDNUQsd0VBQWdGO0FBVWhGLE1BQU0sWUFBWSxHQUFHLDRCQUE0QixDQUFDO0FBRWxEOzs7OztHQUtHO0FBQ0gsTUFBYSxzQkFBdUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNuQyxjQUFjLENBQWlCO0lBQy9CLGFBQWEsQ0FBaUI7SUFDOUIsY0FBYyxDQUFpQjtJQUMvQixhQUFhLENBQWlCO0lBRTlDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBa0M7UUFDMUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxXQUFXLEdBQUc7WUFDbEIsVUFBVSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUztZQUNqQyxjQUFjLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxZQUFZO1lBQzNDLFlBQVk7U0FDYixDQUFDO1FBRUYsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFBLDhCQUFhLEVBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ2hFLE1BQU0sRUFBRSxZQUFZO1lBQ3BCLElBQUksRUFBRSxjQUFjO1lBQ3BCLFdBQVc7U0FDWixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUEsOEJBQWEsRUFBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDOUQsTUFBTSxFQUFFLFlBQVk7WUFDcEIsSUFBSSxFQUFFLGFBQWE7WUFDbkIsV0FBVztTQUNaLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBQSw4QkFBYSxFQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUNoRSxNQUFNLEVBQUUsWUFBWTtZQUNwQixJQUFJLEVBQUUsY0FBYztZQUNwQixXQUFXO1NBQ1osQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFBLDhCQUFhLEVBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzlELE1BQU0sRUFBRSxZQUFZO1lBQ3BCLElBQUksRUFBRSxhQUFhO1lBQ25CLFdBQVc7U0FDWixDQUFDLENBQUM7UUFFSCxLQUFLLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNwRCxLQUFLLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNuRCxLQUFLLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDL0MsS0FBSyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRTlDLEtBQUssQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3JELEtBQUssQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRXBELElBQUEsa0RBQTZCLEVBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzFELGNBQWMsRUFBRSxLQUFLLENBQUMsY0FBYztZQUNwQyxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVE7WUFDeEIsTUFBTSxFQUFFLFlBQVk7WUFDcEIsVUFBVSxFQUFFLHVCQUF1QjtTQUNwQyxDQUFDLENBQUM7UUFFSCxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsRUFBRTtZQUNwRSxJQUFJLEVBQUUsa0JBQWtCO1lBQ3hCLFdBQVcsRUFBRSwrQkFBK0I7U0FDN0MsQ0FBQyxDQUFDO1FBQ0gsU0FBUyxDQUFDLHFCQUFxQixDQUFDLFVBQVUsRUFBRTtZQUMxQyxnQkFBZ0IsRUFBRTtnQkFDaEIscUJBQXFCLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXO2dCQUNyRCxjQUFjLEVBQUUsS0FBSzthQUN0QjtTQUNGLENBQUMsQ0FBQztRQUVILEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUNwRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUN0RCxDQUFDO0NBQ0Y7QUFsRUQsd0RBa0VDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IElUYWJsZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzJztcbmltcG9ydCAqIGFzIHNlcnZpY2VkaXNjb3ZlcnkgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlcnZpY2VkaXNjb3ZlcnknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uLy4uL2NvbmZpZy9lbnZpcm9ubWVudCc7XG5pbXBvcnQgeyBjcmVhdGVIYW5kbGVyIH0gZnJvbSAnLi4vLi4vc2hhcmVkL2NyZWF0ZS1oYW5kbGVyJztcbmltcG9ydCB7IGNyZWF0ZVN0cmVhbVRvRXZlbnRCcmlkZ2VQaXBlIH0gZnJvbSAnLi4vLi4vc2hhcmVkL2NyZWF0ZS1zdHJlYW0tcGlwZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlzY3Vzc2lvblNlcnZpY2VTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZDb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuICB0YWJsZTogSVRhYmxlO1xuICB0YWJsZVN0cmVhbUFybjogc3RyaW5nO1xuICBldmVudEJ1czogZXZlbnRzLklFdmVudEJ1cztcbiAgbmFtZXNwYWNlOiBzZXJ2aWNlZGlzY292ZXJ5Lkh0dHBOYW1lc3BhY2U7XG59XG5cbmNvbnN0IEVWRU5UX1NPVVJDRSA9ICdjb3Vyc2UtcGxhdGZvcm0uZGlzY3Vzc2lvbic7XG5cbi8qKlxuICogUmVhbC10aW1lIGZvcnVtIC0tIHRoZSBkaXJlY3QgbW9kZXJuIHJlcGxhY2VtZW50IGZvciB0aGUgYm9vaydzIEZpcmViYXNlLXdlYnNvY2tldFxuICogZGlzY3Vzc2lvbiBmb3J1bSAoU2VydmVybGVzcyBBcmNoaXRlY3R1cmVzIG9uIEFXUywgMm5kIEVkLiwgNS4xKS4gYHBvc3RNZXNzYWdlYCBpc1xuICogYW5ub3RhdGVkIGBAYXdzX3N1YnNjcmliZWAgaW4gdGhlIEFwcFN5bmMgc2NoZW1hLCBzbyBwb3N0aW5nICppcyogdGhlIHRoaW5nIGNsaWVudHNcbiAqIHN1YnNjcmliZSB0bzsgbm8gc2VwYXJhdGUgXCJOb25lXCIgcGFzc3Rocm91Z2ggcmVzb2x2ZXIgaXMgbmVlZGVkLlxuICovXG5leHBvcnQgY2xhc3MgRGlzY3Vzc2lvblNlcnZpY2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBjcmVhdGVUaHJlYWRGbjogTm9kZWpzRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBwb3N0TWVzc2FnZUZuOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGxpc3RNZXNzYWdlc0ZuOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGxpc3RUaHJlYWRzRm46IE5vZGVqc0Z1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBEaXNjdXNzaW9uU2VydmljZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGVudmlyb25tZW50ID0ge1xuICAgICAgVEFCTEVfTkFNRTogcHJvcHMudGFibGUudGFibGVOYW1lLFxuICAgICAgRVZFTlRfQlVTX05BTUU6IHByb3BzLmV2ZW50QnVzLmV2ZW50QnVzTmFtZSxcbiAgICAgIEVWRU5UX1NPVVJDRSxcbiAgICB9O1xuXG4gICAgdGhpcy5jcmVhdGVUaHJlYWRGbiA9IGNyZWF0ZUhhbmRsZXIodGhpcywgJ0NyZWF0ZVRocmVhZEZ1bmN0aW9uJywge1xuICAgICAgZG9tYWluOiAnZGlzY3Vzc2lvbicsXG4gICAgICBuYW1lOiAnY3JlYXRlVGhyZWFkJyxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0pO1xuICAgIHRoaXMucG9zdE1lc3NhZ2VGbiA9IGNyZWF0ZUhhbmRsZXIodGhpcywgJ1Bvc3RNZXNzYWdlRnVuY3Rpb24nLCB7XG4gICAgICBkb21haW46ICdkaXNjdXNzaW9uJyxcbiAgICAgIG5hbWU6ICdwb3N0TWVzc2FnZScsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICB9KTtcbiAgICB0aGlzLmxpc3RNZXNzYWdlc0ZuID0gY3JlYXRlSGFuZGxlcih0aGlzLCAnTGlzdE1lc3NhZ2VzRnVuY3Rpb24nLCB7XG4gICAgICBkb21haW46ICdkaXNjdXNzaW9uJyxcbiAgICAgIG5hbWU6ICdsaXN0TWVzc2FnZXMnLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgfSk7XG4gICAgdGhpcy5saXN0VGhyZWFkc0ZuID0gY3JlYXRlSGFuZGxlcih0aGlzLCAnTGlzdFRocmVhZHNGdW5jdGlvbicsIHtcbiAgICAgIGRvbWFpbjogJ2Rpc2N1c3Npb24nLFxuICAgICAgbmFtZTogJ2xpc3RUaHJlYWRzJyxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgcHJvcHMudGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuY3JlYXRlVGhyZWFkRm4pO1xuICAgIHByb3BzLnRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLnBvc3RNZXNzYWdlRm4pO1xuICAgIHByb3BzLnRhYmxlLmdyYW50UmVhZERhdGEodGhpcy5saXN0TWVzc2FnZXNGbik7XG4gICAgcHJvcHMudGFibGUuZ3JhbnRSZWFkRGF0YSh0aGlzLmxpc3RUaHJlYWRzRm4pO1xuXG4gICAgcHJvcHMuZXZlbnRCdXMuZ3JhbnRQdXRFdmVudHNUbyh0aGlzLmNyZWF0ZVRocmVhZEZuKTtcbiAgICBwcm9wcy5ldmVudEJ1cy5ncmFudFB1dEV2ZW50c1RvKHRoaXMucG9zdE1lc3NhZ2VGbik7XG5cbiAgICBjcmVhdGVTdHJlYW1Ub0V2ZW50QnJpZGdlUGlwZSh0aGlzLCAnRGlzY3Vzc2lvblN0cmVhbVBpcGUnLCB7XG4gICAgICB0YWJsZVN0cmVhbUFybjogcHJvcHMudGFibGVTdHJlYW1Bcm4sXG4gICAgICBldmVudEJ1czogcHJvcHMuZXZlbnRCdXMsXG4gICAgICBzb3VyY2U6IEVWRU5UX1NPVVJDRSxcbiAgICAgIGRldGFpbFR5cGU6ICdEaXNjdXNzaW9uRGF0YUNoYW5nZWQnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY21TZXJ2aWNlID0gcHJvcHMubmFtZXNwYWNlLmNyZWF0ZVNlcnZpY2UoJ0Rpc2N1c3Npb25SZWdpc3RyeScsIHtcbiAgICAgIG5hbWU6ICdkaXNjdXNzaW9uLWZvcnVtJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGlzY3Vzc2lvbiBGb3J1bSBtaWNyb3NlcnZpY2UnLFxuICAgIH0pO1xuICAgIGNtU2VydmljZS5yZWdpc3Rlck5vbklwSW5zdGFuY2UoJ0luc3RhbmNlJywge1xuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICBMQU1CREFfRU5UUllQT0lOVF9BUk46IHRoaXMubGlzdFRocmVhZHNGbi5mdW5jdGlvbkFybixcbiAgICAgICAgU0NIRU1BX1ZFUlNJT046ICcxLjAnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdjb3Vyc2UtcGxhdGZvcm0nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52Q29uZmlnLmVudk5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTWljcm9zZXJ2aWNlJywgJ2Rpc2N1c3Npb24nKTtcbiAgfVxufVxuIl19