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
exports.AppSyncStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const appsync = __importStar(require("aws-cdk-lib/aws-appsync"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const path_1 = require("path");
const RESOLVER_CODE = (0, path_1.join)(__dirname, '../../src/resolvers/invoke-lambda.js');
/**
 * The GraphQL BFF -- the direct modern replacement for the book's Apollo GraphQL library
 * running inside a Lambda behind API Gateway (Serverless Architectures on AWS, 2nd Ed.,
 * 5.1.3), which the book itself says to replace with AppSync once it existed. Every
 * operation gets its own Lambda data source but shares one unit resolver
 * (src/resolvers/invoke-lambda.js): this API invokes each microservice's Lambda directly,
 * skipping the book's inner API-Gateway-per-microservice hop -- an intentional latency/cost
 * optimization made possible by having every microservice inside the same CDK app.
 */
class AppSyncStack extends cdk.Stack {
    api;
    internalServiceRole;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.api = new appsync.GraphqlApi(this, 'CoursePlatformGraphQL', {
            name: `course-platform-${props.envConfig.envName}`,
            definition: appsync.Definition.fromFile((0, path_1.join)(__dirname, 'appsync/schema.graphql')),
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: appsync.AuthorizationType.USER_POOL,
                    userPoolConfig: { userPool: props.userPool },
                },
                additionalAuthorizationModes: [{ authorizationType: appsync.AuthorizationType.IAM }],
            },
            xrayEnabled: true,
            logConfig: { fieldLogLevel: appsync.FieldLogLevel.ALL },
        });
        // Replaces the book's X-API-Key header between the BFF and each microservice: an
        // internal Lambda (e.g. a future ops tool, or a service reacting to a webhook) would
        // assume this role to call this API under the AWS_IAM auth mode instead of a user's
        // Cognito JWT. Lives here, not in auth-stack.ts, so the role and its grant on this API
        // are in the same stack -- granting cross-stack would create a cyclic dependency, since
        // this stack already depends on auth-stack.ts for the Cognito user pool.
        this.internalServiceRole = new iam.Role(this, 'InternalServiceRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Assumed by internal microservice Lambdas that need to call AppSync via AWS_IAM auth',
        });
        this.api.grant(this.internalServiceRole, appsync.IamResource.all(), 'appsync:GraphQL');
        const { catalog, video, enrollment, discussion, analytics } = props;
        // Course Catalog
        this.addOperation('Query', 'getCourse', catalog.getCourseFn);
        this.addOperation('Query', 'listCourses', catalog.listCoursesFn);
        this.addOperation('Mutation', 'createCourse', catalog.createCourseFn);
        this.addOperation('Mutation', 'updateCourse', catalog.updateCourseFn);
        this.addOperation('Mutation', 'addLesson', catalog.addLessonFn);
        // Video Upload & Transcode
        this.addOperation('Query', 'getVideo', video.getVideoFn);
        this.addOperation('Query', 'listVideosForCourse', video.listVideosForCourseFn);
        this.addOperation('Mutation', 'requestVideoUpload', video.requestVideoUploadFn);
        // Enrollment & Payments
        this.addOperation('Query', 'getEnrollment', enrollment.getEnrollmentFn);
        this.addOperation('Query', 'listEnrollmentsForUser', enrollment.listEnrollmentsForUserFn);
        this.addOperation('Mutation', 'enroll', enrollment.enrollFn);
        this.addOperation('Mutation', 'cancelEnrollment', enrollment.cancelEnrollmentFn);
        // Discussion Forum
        this.addOperation('Query', 'listThreads', discussion.listThreadsFn);
        this.addOperation('Query', 'listMessages', discussion.listMessagesFn);
        this.addOperation('Mutation', 'createThread', discussion.createThreadFn);
        this.addOperation('Mutation', 'postMessage', discussion.postMessageFn);
        // Reporting & Analytics
        this.addOperation('Query', 'getCourseEnrollmentStats', analytics.getCourseEnrollmentStatsFn);
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        new cdk.CfnOutput(this, 'GraphQLApiUrl', {
            value: this.api.graphqlUrl,
            exportName: `course-platform-${props.envConfig.envName}-GraphQLApiUrl`,
        });
        new cdk.CfnOutput(this, 'GraphQLApiId', {
            value: this.api.apiId,
            exportName: `course-platform-${props.envConfig.envName}-GraphQLApiId`,
        });
    }
    addOperation(typeName, fieldName, fn) {
        const dataSource = this.api.addLambdaDataSource(`${fieldName}DataSource`, fn);
        dataSource.createResolver(`${fieldName}Resolver`, {
            typeName,
            fieldName,
            runtime: appsync.FunctionRuntime.JS_1_0_0,
            code: appsync.Code.fromAsset(RESOLVER_CODE),
        });
    }
}
exports.AppSyncStack = AppSyncStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwc3luYy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFwcHN5bmMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLGlFQUFtRDtBQUVuRCx5REFBMkM7QUFHM0MsK0JBQTRCO0FBbUM1QixNQUFNLGFBQWEsR0FBRyxJQUFBLFdBQUksRUFBQyxTQUFTLEVBQUUsc0NBQXNDLENBQUMsQ0FBQztBQUU5RTs7Ozs7Ozs7R0FRRztBQUNILE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3pCLEdBQUcsQ0FBcUI7SUFDeEIsbUJBQW1CLENBQVc7SUFFOUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0QsSUFBSSxFQUFFLG1CQUFtQixLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRTtZQUNsRCxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLHdCQUF3QixDQUFDLENBQUM7WUFDbEYsbUJBQW1CLEVBQUU7Z0JBQ25CLG9CQUFvQixFQUFFO29CQUNwQixpQkFBaUIsRUFBRSxPQUFPLENBQUMsaUJBQWlCLENBQUMsU0FBUztvQkFDdEQsY0FBYyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRLEVBQUU7aUJBQzdDO2dCQUNELDRCQUE0QixFQUFFLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxPQUFPLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFLENBQUM7YUFDckY7WUFDRCxXQUFXLEVBQUUsSUFBSTtZQUNq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IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFwcHN5bmMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwcHN5bmMnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBJRnVuY3Rpb24gfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi9jb25maWcvZW52aXJvbm1lbnQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFwcFN5bmNTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZDb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuICB1c2VyUG9vbDogY29nbml0by5JVXNlclBvb2w7XG4gIGNhdGFsb2c6IHtcbiAgICBjcmVhdGVDb3Vyc2VGbjogSUZ1bmN0aW9uO1xuICAgIHVwZGF0ZUNvdXJzZUZuOiBJRnVuY3Rpb247XG4gICAgZ2V0Q291cnNlRm46IElGdW5jdGlvbjtcbiAgICBsaXN0Q291cnNlc0ZuOiBJRnVuY3Rpb247XG4gICAgYWRkTGVzc29uRm46IElGdW5jdGlvbjtcbiAgfTtcbiAgdmlkZW86IHtcbiAgICByZXF1ZXN0VmlkZW9VcGxvYWRGbjogSUZ1bmN0aW9uO1xuICAgIGdldFZpZGVvRm46IElGdW5jdGlvbjtcbiAgICBsaXN0VmlkZW9zRm9yQ291cnNlRm46IElGdW5jdGlvbjtcbiAgfTtcbiAgZW5yb2xsbWVudDoge1xuICAgIGVucm9sbEZuOiBJRnVuY3Rpb247XG4gICAgZ2V0RW5yb2xsbWVudEZuOiBJRnVuY3Rpb247XG4gICAgbGlzdEVucm9sbG1lbnRzRm9yVXNlckZuOiBJRnVuY3Rpb247XG4gICAgY2FuY2VsRW5yb2xsbWVudEZuOiBJRnVuY3Rpb247XG4gIH07XG4gIGRpc2N1c3Npb246IHtcbiAgICBjcmVhdGVUaHJlYWRGbjogSUZ1bmN0aW9uO1xuICAgIHBvc3RNZXNzYWdlRm46IElGdW5jdGlvbjtcbiAgICBsaXN0TWVzc2FnZXNGbjogSUZ1bmN0aW9uO1xuICAgIGxpc3RUaHJlYWRzRm46IElGdW5jdGlvbjtcbiAgfTtcbiAgYW5hbHl0aWNzOiB7XG4gICAgZ2V0Q291cnNlRW5yb2xsbWVudFN0YXRzRm46IElGdW5jdGlvbjtcbiAgfTtcbn1cblxuY29uc3QgUkVTT0xWRVJfQ09ERSA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vc3JjL3Jlc29sdmVycy9pbnZva2UtbGFtYmRhLmpzJyk7XG5cbi8qKlxuICogVGhlIEdyYXBoUUwgQkZGIC0tIHRoZSBkaXJlY3QgbW9kZXJuIHJlcGxhY2VtZW50IGZvciB0aGUgYm9vaydzIEFwb2xsbyBHcmFwaFFMIGxpYnJhcnlcbiAqIHJ1bm5pbmcgaW5zaWRlIGEgTGFtYmRhIGJlaGluZCBBUEkgR2F0ZXdheSAoU2VydmVybGVzcyBBcmNoaXRlY3R1cmVzIG9uIEFXUywgMm5kIEVkLixcbiAqIDUuMS4zKSwgd2hpY2ggdGhlIGJvb2sgaXRzZWxmIHNheXMgdG8gcmVwbGFjZSB3aXRoIEFwcFN5bmMgb25jZSBpdCBleGlzdGVkLiBFdmVyeVxuICogb3BlcmF0aW9uIGdldHMgaXRzIG93biBMYW1iZGEgZGF0YSBzb3VyY2UgYnV0IHNoYXJlcyBvbmUgdW5pdCByZXNvbHZlclxuICogKHNyYy9yZXNvbHZlcnMvaW52b2tlLWxhbWJkYS5qcyk6IHRoaXMgQVBJIGludm9rZXMgZWFjaCBtaWNyb3NlcnZpY2UncyBMYW1iZGEgZGlyZWN0bHksXG4gKiBza2lwcGluZyB0aGUgYm9vaydzIGlubmVyIEFQSS1HYXRld2F5LXBlci1taWNyb3NlcnZpY2UgaG9wIC0tIGFuIGludGVudGlvbmFsIGxhdGVuY3kvY29zdFxuICogb3B0aW1pemF0aW9uIG1hZGUgcG9zc2libGUgYnkgaGF2aW5nIGV2ZXJ5IG1pY3Jvc2VydmljZSBpbnNpZGUgdGhlIHNhbWUgQ0RLIGFwcC5cbiAqL1xuZXhwb3J0IGNsYXNzIEFwcFN5bmNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwcHN5bmMuR3JhcGhxbEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IGludGVybmFsU2VydmljZVJvbGU6IGlhbS5Sb2xlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBcHBTeW5jU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgdGhpcy5hcGkgPSBuZXcgYXBwc3luYy5HcmFwaHFsQXBpKHRoaXMsICdDb3Vyc2VQbGF0Zm9ybUdyYXBoUUwnLCB7XG4gICAgICBuYW1lOiBgY291cnNlLXBsYXRmb3JtLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9YCxcbiAgICAgIGRlZmluaXRpb246IGFwcHN5bmMuRGVmaW5pdGlvbi5mcm9tRmlsZShqb2luKF9fZGlybmFtZSwgJ2FwcHN5bmMvc2NoZW1hLmdyYXBocWwnKSksXG4gICAgICBhdXRob3JpemF0aW9uQ29uZmlnOiB7XG4gICAgICAgIGRlZmF1bHRBdXRob3JpemF0aW9uOiB7XG4gICAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwcHN5bmMuQXV0aG9yaXphdGlvblR5cGUuVVNFUl9QT09MLFxuICAgICAgICAgIHVzZXJQb29sQ29uZmlnOiB7IHVzZXJQb29sOiBwcm9wcy51c2VyUG9vbCB9LFxuICAgICAgICB9LFxuICAgICAgICBhZGRpdGlvbmFsQXV0aG9yaXphdGlvbk1vZGVzOiBbeyBhdXRob3JpemF0aW9uVHlwZTogYXBwc3luYy5BdXRob3JpemF0aW9uVHlwZS5JQU0gfV0sXG4gICAgICB9LFxuICAgICAgeHJheUVuYWJsZWQ6IHRydWUsXG4gICAgICBsb2dDb25maWc6IHsgZmllbGRMb2dMZXZlbDogYXBwc3luYy5GaWVsZExvZ0xldmVsLkFMTCB9LFxuICAgIH0pO1xuXG4gICAgLy8gUmVwbGFjZXMgdGhlIGJvb2sncyBYLUFQSS1LZXkgaGVhZGVyIGJldHdlZW4gdGhlIEJGRiBhbmQgZWFjaCBtaWNyb3NlcnZpY2U6IGFuXG4gICAgLy8gaW50ZXJuYWwgTGFtYmRhIChlLmcuIGEgZnV0dXJlIG9wcyB0b29sLCBvciBhIHNlcnZpY2UgcmVhY3RpbmcgdG8gYSB3ZWJob29rKSB3b3VsZFxuICAgIC8vIGFzc3VtZSB0aGlzIHJvbGUgdG8gY2FsbCB0aGlzIEFQSSB1bmRlciB0aGUgQVdTX0lBTSBhdXRoIG1vZGUgaW5zdGVhZCBvZiBhIHVzZXInc1xuICAgIC8vIENvZ25pdG8gSldULiBMaXZlcyBoZXJlLCBub3QgaW4gYXV0aC1zdGFjay50cywgc28gdGhlIHJvbGUgYW5kIGl0cyBncmFudCBvbiB0aGlzIEFQSVxuICAgIC8vIGFyZSBpbiB0aGUgc2FtZSBzdGFjayAtLSBncmFudGluZyBjcm9zcy1zdGFjayB3b3VsZCBjcmVhdGUgYSBjeWNsaWMgZGVwZW5kZW5jeSwgc2luY2VcbiAgICAvLyB0aGlzIHN0YWNrIGFscmVhZHkgZGVwZW5kcyBvbiBhdXRoLXN0YWNrLnRzIGZvciB0aGUgQ29nbml0byB1c2VyIHBvb2wuXG4gICAgdGhpcy5pbnRlcm5hbFNlcnZpY2VSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdJbnRlcm5hbFNlcnZpY2VSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0Fzc3VtZWQgYnkgaW50ZXJuYWwgbWljcm9zZXJ2aWNlIExhbWJkYXMgdGhhdCBuZWVkIHRvIGNhbGwgQXBwU3luYyB2aWEgQVdTX0lBTSBhdXRoJyxcbiAgICB9KTtcbiAgICB0aGlzLmFwaS5ncmFudCh0aGlzLmludGVybmFsU2VydmljZVJvbGUsIGFwcHN5bmMuSWFtUmVzb3VyY2UuYWxsKCksICdhcHBzeW5jOkdyYXBoUUwnKTtcblxuICAgIGNvbnN0IHsgY2F0YWxvZywgdmlkZW8sIGVucm9sbG1lbnQsIGRpc2N1c3Npb24sIGFuYWx5dGljcyB9ID0gcHJvcHM7XG5cbiAgICAvLyBDb3Vyc2UgQ2F0YWxvZ1xuICAgIHRoaXMuYWRkT3BlcmF0aW9uKCdRdWVyeScsICdnZXRDb3Vyc2UnLCBjYXRhbG9nLmdldENvdXJzZUZuKTtcbiAgICB0aGlzLmFkZE9wZXJhdGlvbignUXVlcnknLCAnbGlzdENvdXJzZXMnLCBjYXRhbG9nLmxpc3RDb3Vyc2VzRm4pO1xuICAgIHRoaXMuYWRkT3BlcmF0aW9uKCdNdXRhdGlvbicsICdjcmVhdGVDb3Vyc2UnLCBjYXRhbG9nLmNyZWF0ZUNvdXJzZUZuKTtcbiAgICB0aGlzLmFkZE9wZXJhdGlvbignTXV0YXRpb24nLCAndXBkYXRlQ291cnNlJywgY2F0YWxvZy51cGRhdGVDb3Vyc2VGbik7XG4gICAgdGhpcy5hZGRPcGVyYXRpb24oJ011dGF0aW9uJywgJ2FkZExlc3NvbicsIGNhdGFsb2cuYWRkTGVzc29uRm4pO1xuXG4gICAgLy8gVmlkZW8gVXBsb2FkICYgVHJhbnNjb2RlXG4gICAgdGhpcy5hZGRPcGVyYXRpb24oJ1F1ZXJ5JywgJ2dldFZpZGVvJywgdmlkZW8uZ2V0VmlkZW9Gbik7XG4gICAgdGhpcy5hZGRPcGVyYXRpb24oJ1F1ZXJ5JywgJ2xpc3RWaWRlb3NGb3JDb3Vyc2UnLCB2aWRlby5saXN0VmlkZW9zRm9yQ291cnNlRm4pO1xuICAgIHRoaXMuYWRkT3BlcmF0aW9uKCdNdXRhdGlvbicsICdyZXF1ZXN0VmlkZW9VcGxvYWQnLCB2aWRlby5yZXF1ZXN0VmlkZW9VcGxvYWRGbik7XG5cbiAgICAvLyBFbnJvbGxtZW50ICYgUGF5bWVudHNcbiAgICB0aGlzLmFkZE9wZXJhdGlvbignUXVlcnknLCAnZ2V0RW5yb2xsbWVudCcsIGVucm9sbG1lbnQuZ2V0RW5yb2xsbWVudEZuKTtcbiAgICB0aGlzLmFkZE9wZXJhdGlvbignUXVlcnknLCAnbGlzdEVucm9sbG1lbnRzRm9yVXNlcicsIGVucm9sbG1lbnQubGlzdEVucm9sbG1lbnRzRm9yVXNlckZuKTtcbiAgICB0aGlzLmFkZE9wZXJhdGlvbignTXV0YXRpb24nLCAnZW5yb2xsJywgZW5yb2xsbWVudC5lbnJvbGxGbik7XG4gICAgdGhpcy5hZGRPcGVyYXRpb24oJ011dGF0aW9uJywgJ2NhbmNlbEVucm9sbG1lbnQnLCBlbnJvbGxtZW50LmNhbmNlbEVucm9sbG1lbnRGbik7XG5cbiAgICAvLyBEaXNjdXNzaW9uIEZvcnVtXG4gICAgdGhpcy5hZGRPcGVyYXRpb24oJ1F1ZXJ5JywgJ2xpc3RUaHJlYWRzJywgZGlzY3Vzc2lvbi5saXN0VGhyZWFkc0ZuKTtcbiAgICB0aGlzLmFkZE9wZXJhdGlvbignUXVlcnknLCAnbGlzdE1lc3NhZ2VzJywgZGlzY3Vzc2lvbi5saXN0TWVzc2FnZXNGbik7XG4gICAgdGhpcy5hZGRPcGVyYXRpb24oJ011dGF0aW9uJywgJ2NyZWF0ZVRocmVhZCcsIGRpc2N1c3Npb24uY3JlYXRlVGhyZWFkRm4pO1xuICAgIHRoaXMuYWRkT3BlcmF0aW9uKCdNdXRhdGlvbicsICdwb3N0TWVzc2FnZScsIGRpc2N1c3Npb24ucG9zdE1lc3NhZ2VGbik7XG5cbiAgICAvLyBSZXBvcnRpbmcgJiBBbmFseXRpY3NcbiAgICB0aGlzLmFkZE9wZXJhdGlvbignUXVlcnknLCAnZ2V0Q291cnNlRW5yb2xsbWVudFN0YXRzJywgYW5hbHl0aWNzLmdldENvdXJzZUVucm9sbG1lbnRTdGF0c0ZuKTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdjb3Vyc2UtcGxhdGZvcm0nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52Q29uZmlnLmVudk5hbWUpO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0dyYXBoUUxBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkuZ3JhcGhxbFVybCxcbiAgICAgIGV4cG9ydE5hbWU6IGBjb3Vyc2UtcGxhdGZvcm0tJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX0tR3JhcGhRTEFwaVVybGAsXG4gICAgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0dyYXBoUUxBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgIGV4cG9ydE5hbWU6IGBjb3Vyc2UtcGxhdGZvcm0tJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX0tR3JhcGhRTEFwaUlkYCxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkT3BlcmF0aW9uKHR5cGVOYW1lOiAnUXVlcnknIHwgJ011dGF0aW9uJywgZmllbGROYW1lOiBzdHJpbmcsIGZuOiBJRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBjb25zdCBkYXRhU291cmNlID0gdGhpcy5hcGkuYWRkTGFtYmRhRGF0YVNvdXJjZShgJHtmaWVsZE5hbWV9RGF0YVNvdXJjZWAsIGZuKTtcbiAgICBkYXRhU291cmNlLmNyZWF0ZVJlc29sdmVyKGAke2ZpZWxkTmFtZX1SZXNvbHZlcmAsIHtcbiAgICAgIHR5cGVOYW1lLFxuICAgICAgZmllbGROYW1lLFxuICAgICAgcnVudGltZTogYXBwc3luYy5GdW5jdGlvblJ1bnRpbWUuSlNfMV8wXzAsXG4gICAgICBjb2RlOiBhcHBzeW5jLkNvZGUuZnJvbUFzc2V0KFJFU09MVkVSX0NPREUpLFxuICAgIH0pO1xuICB9XG59XG4iXX0=