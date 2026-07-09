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
const cdk = __importStar(require("aws-cdk-lib"));
const assertions_1 = require("aws-cdk-lib/assertions");
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const appsync_stack_1 = require("../lib/platform/appsync-stack");
const fixtures_1 = require("./fixtures");
describe('AppSyncStack', () => {
    const app = new cdk.App();
    const supportStack = new cdk.Stack(app, 'TestSupportStack', {
        env: { account: fixtures_1.testEnvConfig.account, region: fixtures_1.testEnvConfig.region },
    });
    const userPool = new cognito.UserPool(supportStack, 'TestUserPool');
    const fn = (id) => lambda.Function.fromFunctionArn(supportStack, id, `arn:aws:lambda:${fixtures_1.testEnvConfig.region}:${fixtures_1.testEnvConfig.account}:function:${id}`);
    const stack = new appsync_stack_1.AppSyncStack(app, 'TestAppSyncStack', {
        env: { account: fixtures_1.testEnvConfig.account, region: fixtures_1.testEnvConfig.region },
        envConfig: fixtures_1.testEnvConfig,
        userPool,
        catalog: {
            createCourseFn: fn('CreateCourseFn'),
            updateCourseFn: fn('UpdateCourseFn'),
            getCourseFn: fn('GetCourseFn'),
            listCoursesFn: fn('ListCoursesFn'),
            addLessonFn: fn('AddLessonFn'),
        },
        video: {
            requestVideoUploadFn: fn('RequestVideoUploadFn'),
            getVideoFn: fn('GetVideoFn'),
            listVideosForCourseFn: fn('ListVideosForCourseFn'),
        },
        enrollment: {
            enrollFn: fn('EnrollFn'),
            getEnrollmentFn: fn('GetEnrollmentFn'),
            listEnrollmentsForUserFn: fn('ListEnrollmentsForUserFn'),
            cancelEnrollmentFn: fn('CancelEnrollmentFn'),
        },
        discussion: {
            createThreadFn: fn('CreateThreadFn'),
            postMessageFn: fn('PostMessageFn'),
            listMessagesFn: fn('ListMessagesFn'),
            listThreadsFn: fn('ListThreadsFn'),
        },
        analytics: {
            getCourseEnrollmentStatsFn: fn('GetCourseEnrollmentStatsFn'),
        },
    });
    const template = assertions_1.Template.fromStack(stack);
    test('defaults to Cognito user pool auth with IAM as an additional mode', () => {
        template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
            AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
            AdditionalAuthenticationProviders: [{ AuthenticationType: 'AWS_IAM' }],
        });
    });
    test('wires one Lambda data source and one resolver per operation', () => {
        template.resourceCountIs('AWS::AppSync::DataSource', 17);
        template.resourceCountIs('AWS::AppSync::Resolver', 17);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwc3luYy1zdGFjay50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwc3luYy1zdGFjay50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVEQUFrRDtBQUNsRCxpRUFBbUQ7QUFDbkQsK0RBQWlEO0FBQ2pELGlFQUE2RDtBQUM3RCx5Q0FBMkM7QUFFM0MsUUFBUSxDQUFDLGNBQWMsRUFBRSxHQUFHLEVBQUU7SUFDNUIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDMUIsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxrQkFBa0IsRUFBRTtRQUMxRCxHQUFHLEVBQUUsRUFBRSxPQUFPLEVBQUUsd0JBQWEsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLHdCQUFhLENBQUMsTUFBTSxFQUFFO0tBQ3RFLENBQUMsQ0FBQztJQUVILE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFFcEUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUFVLEVBQUUsRUFBRSxDQUN4QixNQUFNLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FDN0IsWUFBWSxFQUNaLEVBQUUsRUFDRixrQkFBa0Isd0JBQWEsQ0FBQyxNQUFNLElBQUksd0JBQWEsQ0FBQyxPQUFPLGFBQWEsRUFBRSxFQUFFLENBQ2pGLENBQUM7SUFFSixNQUFNLEtBQUssR0FBRyxJQUFJLDRCQUFZLENBQUMsR0FBRyxFQUFFLGtCQUFrQixFQUFFO1FBQ3RELEdBQUcsRUFBRSxFQUFFLE9BQU8sRUFBRSx3QkFBYSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsd0JBQWEsQ0FBQyxNQUFNLEVBQUU7UUFDckUsU0FBUyxFQUFFLHdCQUFhO1FBQ3hCLFFBQVE7UUFDUixPQUFPLEVBQUU7WUFDUCxjQUFjLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDO1lBQ3BDLGNBQWMsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUM7WUFDcEMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUM7WUFDOUIsYUFBYSxFQUFFLEVBQUUsQ0FBQyxlQUFlLENBQUM7WUFDbEMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUM7U0FDL0I7UUFDRCxLQUFLLEVBQUU7WUFDTCxvQkFBb0IsRUFBRSxFQUFFLENBQUMsc0JBQXNCLENBQUM7WUFDaEQsVUFBVSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUM7WUFDNUIscUJBQXFCLEVBQUUsRUFBRSxDQUFDLHVCQUF1QixDQUFDO1NBQ25EO1FBQ0QsVUFBVSxFQUFFO1lBQ1YsUUFBUSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUM7WUFDeEIsZUFBZSxFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQztZQUN0Qyx3QkFBd0IsRUFBRSxFQUFFLENBQUMsMEJBQTBCLENBQUM7WUFDeEQsa0JBQWtCLEVBQUUsRUFBRSxDQUFDLG9CQUFvQixDQUFDO1NBQzdDO1FBQ0QsVUFBVSxFQUFFO1lBQ1YsY0FBYyxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztZQUNwQyxhQUFhLEVBQUUsRUFBRSxDQUFDLGVBQWUsQ0FBQztZQUNsQyxjQUFjLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDO1lBQ3BDLGFBQWEsRUFBRSxFQUFFLENBQUMsZUFBZSxDQUFDO1NBQ25DO1FBQ0QsU0FBUyxFQUFFO1lBQ1QsMEJBQTBCLEVBQUUsRUFBRSxDQUFDLDRCQUE0QixDQUFDO1NBQzdEO0tBQ0YsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxRQUFRLEdBQUcscUJBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFM0MsSUFBSSxDQUFDLG1FQUFtRSxFQUFFLEdBQUcsRUFBRTtRQUM3RSxRQUFRLENBQUMscUJBQXFCLENBQUMsMEJBQTBCLEVBQUU7WUFDekQsa0JBQWtCLEVBQUUsMkJBQTJCO1lBQy9DLGlDQUFpQyxFQUFFLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLEVBQUUsQ0FBQztTQUN2RSxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw2REFBNkQsRUFBRSxHQUFHLEVBQUU7UUFDdkUsUUFBUSxDQUFDLGVBQWUsQ0FBQywwQkFBMEIsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN6RCxRQUFRLENBQUMsZUFBZSxDQUFDLHdCQUF3QixFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVGVtcGxhdGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hc3NlcnRpb25zJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgQXBwU3luY1N0YWNrIH0gZnJvbSAnLi4vbGliL3BsYXRmb3JtL2FwcHN5bmMtc3RhY2snO1xuaW1wb3J0IHsgdGVzdEVudkNvbmZpZyB9IGZyb20gJy4vZml4dHVyZXMnO1xuXG5kZXNjcmliZSgnQXBwU3luY1N0YWNrJywgKCkgPT4ge1xuICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICBjb25zdCBzdXBwb3J0U3RhY2sgPSBuZXcgY2RrLlN0YWNrKGFwcCwgJ1Rlc3RTdXBwb3J0U3RhY2snLCB7XG4gICAgZW52OiB7IGFjY291bnQ6IHRlc3RFbnZDb25maWcuYWNjb3VudCwgcmVnaW9uOiB0ZXN0RW52Q29uZmlnLnJlZ2lvbiB9LFxuICB9KTtcblxuICBjb25zdCB1c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHN1cHBvcnRTdGFjaywgJ1Rlc3RVc2VyUG9vbCcpO1xuXG4gIGNvbnN0IGZuID0gKGlkOiBzdHJpbmcpID0+XG4gICAgbGFtYmRhLkZ1bmN0aW9uLmZyb21GdW5jdGlvbkFybihcbiAgICAgIHN1cHBvcnRTdGFjayxcbiAgICAgIGlkLFxuICAgICAgYGFybjphd3M6bGFtYmRhOiR7dGVzdEVudkNvbmZpZy5yZWdpb259OiR7dGVzdEVudkNvbmZpZy5hY2NvdW50fTpmdW5jdGlvbjoke2lkfWBcbiAgICApO1xuXG4gIGNvbnN0IHN0YWNrID0gbmV3IEFwcFN5bmNTdGFjayhhcHAsICdUZXN0QXBwU3luY1N0YWNrJywge1xuICAgIGVudjogeyBhY2NvdW50OiB0ZXN0RW52Q29uZmlnLmFjY291bnQsIHJlZ2lvbjogdGVzdEVudkNvbmZpZy5yZWdpb24gfSxcbiAgICBlbnZDb25maWc6IHRlc3RFbnZDb25maWcsXG4gICAgdXNlclBvb2wsXG4gICAgY2F0YWxvZzoge1xuICAgICAgY3JlYXRlQ291cnNlRm46IGZuKCdDcmVhdGVDb3Vyc2VGbicpLFxuICAgICAgdXBkYXRlQ291cnNlRm46IGZuKCdVcGRhdGVDb3Vyc2VGbicpLFxuICAgICAgZ2V0Q291cnNlRm46IGZuKCdHZXRDb3Vyc2VGbicpLFxuICAgICAgbGlzdENvdXJzZXNGbjogZm4oJ0xpc3RDb3Vyc2VzRm4nKSxcbiAgICAgIGFkZExlc3NvbkZuOiBmbignQWRkTGVzc29uRm4nKSxcbiAgICB9LFxuICAgIHZpZGVvOiB7XG4gICAgICByZXF1ZXN0VmlkZW9VcGxvYWRGbjogZm4oJ1JlcXVlc3RWaWRlb1VwbG9hZEZuJyksXG4gICAgICBnZXRWaWRlb0ZuOiBmbignR2V0VmlkZW9GbicpLFxuICAgICAgbGlzdFZpZGVvc0ZvckNvdXJzZUZuOiBmbignTGlzdFZpZGVvc0ZvckNvdXJzZUZuJyksXG4gICAgfSxcbiAgICBlbnJvbGxtZW50OiB7XG4gICAgICBlbnJvbGxGbjogZm4oJ0Vucm9sbEZuJyksXG4gICAgICBnZXRFbnJvbGxtZW50Rm46IGZuKCdHZXRFbnJvbGxtZW50Rm4nKSxcbiAgICAgIGxpc3RFbnJvbGxtZW50c0ZvclVzZXJGbjogZm4oJ0xpc3RFbnJvbGxtZW50c0ZvclVzZXJGbicpLFxuICAgICAgY2FuY2VsRW5yb2xsbWVudEZuOiBmbignQ2FuY2VsRW5yb2xsbWVudEZuJyksXG4gICAgfSxcbiAgICBkaXNjdXNzaW9uOiB7XG4gICAgICBjcmVhdGVUaHJlYWRGbjogZm4oJ0NyZWF0ZVRocmVhZEZuJyksXG4gICAgICBwb3N0TWVzc2FnZUZuOiBmbignUG9zdE1lc3NhZ2VGbicpLFxuICAgICAgbGlzdE1lc3NhZ2VzRm46IGZuKCdMaXN0TWVzc2FnZXNGbicpLFxuICAgICAgbGlzdFRocmVhZHNGbjogZm4oJ0xpc3RUaHJlYWRzRm4nKSxcbiAgICB9LFxuICAgIGFuYWx5dGljczoge1xuICAgICAgZ2V0Q291cnNlRW5yb2xsbWVudFN0YXRzRm46IGZuKCdHZXRDb3Vyc2VFbnJvbGxtZW50U3RhdHNGbicpLFxuICAgIH0sXG4gIH0pO1xuICBjb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XG5cbiAgdGVzdCgnZGVmYXVsdHMgdG8gQ29nbml0byB1c2VyIHBvb2wgYXV0aCB3aXRoIElBTSBhcyBhbiBhZGRpdGlvbmFsIG1vZGUnLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkFwcFN5bmM6OkdyYXBoUUxBcGknLCB7XG4gICAgICBBdXRoZW50aWNhdGlvblR5cGU6ICdBTUFaT05fQ09HTklUT19VU0VSX1BPT0xTJyxcbiAgICAgIEFkZGl0aW9uYWxBdXRoZW50aWNhdGlvblByb3ZpZGVyczogW3sgQXV0aGVudGljYXRpb25UeXBlOiAnQVdTX0lBTScgfV0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ3dpcmVzIG9uZSBMYW1iZGEgZGF0YSBzb3VyY2UgYW5kIG9uZSByZXNvbHZlciBwZXIgb3BlcmF0aW9uJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLnJlc291cmNlQ291bnRJcygnQVdTOjpBcHBTeW5jOjpEYXRhU291cmNlJywgMTcpO1xuICAgIHRlbXBsYXRlLnJlc291cmNlQ291bnRJcygnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcicsIDE3KTtcbiAgfSk7XG59KTtcbiJdfQ==