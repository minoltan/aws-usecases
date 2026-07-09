#!/usr/bin/env node
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
const environment_1 = require("../lib/config/environment");
const auth_stack_1 = require("../lib/platform/auth-stack");
const event_bus_stack_1 = require("../lib/platform/event-bus-stack");
const discovery_stack_1 = require("../lib/platform/discovery-stack");
const appsync_stack_1 = require("../lib/platform/appsync-stack");
const waf_stack_1 = require("../lib/platform/waf-stack");
const catalog_data_stack_1 = require("../lib/microservices/course-catalog/catalog-data-stack");
const catalog_service_stack_1 = require("../lib/microservices/course-catalog/catalog-service-stack");
const video_data_stack_1 = require("../lib/microservices/video/video-data-stack");
const video_service_stack_1 = require("../lib/microservices/video/video-service-stack");
const enrollment_data_stack_1 = require("../lib/microservices/enrollment/enrollment-data-stack");
const enrollment_service_stack_1 = require("../lib/microservices/enrollment/enrollment-service-stack");
const discussion_data_stack_1 = require("../lib/microservices/discussion/discussion-data-stack");
const discussion_service_stack_1 = require("../lib/microservices/discussion/discussion-service-stack");
const analytics_data_stack_1 = require("../lib/microservices/analytics/analytics-data-stack");
const analytics_service_stack_1 = require("../lib/microservices/analytics/analytics-service-stack");
const app = new cdk.App();
const envName = app.node.tryGetContext('env') ?? process.env.ENVIRONMENT ?? 'dev';
const envConfig = (0, environment_1.getEnvironmentConfig)(envName);
const env = { account: envConfig.account, region: envConfig.region };
const stackPrefix = `CoursePlatform-${envConfig.envName}`;
// -- 1. Platform (shared, no dependency on any microservice) -------------------------
const auth = new auth_stack_1.AuthStack(app, `${stackPrefix}-Auth`, { env, envConfig });
const eventBus = new event_bus_stack_1.EventBusStack(app, `${stackPrefix}-EventBus`, { env, envConfig });
const discovery = new discovery_stack_1.DiscoveryStack(app, `${stackPrefix}-Discovery`, { env, envConfig });
// -- 2. Data stacks (stateful, independent of each other) ----------------------------
const catalogData = new catalog_data_stack_1.CatalogDataStack(app, `${stackPrefix}-CourseCatalog-Data`, { env, envConfig });
const videoData = new video_data_stack_1.VideoDataStack(app, `${stackPrefix}-Video-Data`, { env, envConfig });
const enrollmentData = new enrollment_data_stack_1.EnrollmentDataStack(app, `${stackPrefix}-Enrollment-Data`, { env, envConfig });
const discussionData = new discussion_data_stack_1.DiscussionDataStack(app, `${stackPrefix}-Discussion-Data`, { env, envConfig });
const analyticsData = new analytics_data_stack_1.AnalyticsDataStack(app, `${stackPrefix}-Analytics-Data`, { env, envConfig });
// -- 3. Service stacks (stateless, depend on their own data stack + platform) --------
const catalogService = new catalog_service_stack_1.CatalogServiceStack(app, `${stackPrefix}-CourseCatalog-Service`, {
    env,
    envConfig,
    table: catalogData.table,
    tableStreamArn: catalogData.table.tableStreamArn,
    eventBus: eventBus.bus,
    namespace: discovery.namespace,
});
const videoService = new video_service_stack_1.VideoServiceStack(app, `${stackPrefix}-Video-Service`, {
    env,
    envConfig,
    table: videoData.table,
    tableStreamArn: videoData.table.tableStreamArn,
    rawUploadsBucket: videoData.rawUploadsBucket,
    transcodedBucket: videoData.transcodedBucket,
    distribution: videoData.distribution,
    eventBus: eventBus.bus,
    namespace: discovery.namespace,
});
const enrollmentService = new enrollment_service_stack_1.EnrollmentServiceStack(app, `${stackPrefix}-Enrollment-Service`, {
    env,
    envConfig,
    table: enrollmentData.table,
    tableStreamArn: enrollmentData.table.tableStreamArn,
    eventBus: eventBus.bus,
    namespace: discovery.namespace,
});
const discussionService = new discussion_service_stack_1.DiscussionServiceStack(app, `${stackPrefix}-Discussion-Service`, {
    env,
    envConfig,
    table: discussionData.table,
    tableStreamArn: discussionData.table.tableStreamArn,
    eventBus: eventBus.bus,
    namespace: discovery.namespace,
});
const analyticsService = new analytics_service_stack_1.AnalyticsServiceStack(app, `${stackPrefix}-Analytics-Service`, {
    env,
    envConfig,
    dataLakeBucket: analyticsData.bucket,
    eventBus: eventBus.bus,
    namespace: discovery.namespace,
});
// -- 4. AppSync BFF (needs every service stack's Lambda refs + Cognito) --------------
const appsync = new appsync_stack_1.AppSyncStack(app, `${stackPrefix}-AppSync`, {
    env,
    envConfig,
    userPool: auth.userPool,
    catalog: {
        createCourseFn: catalogService.createCourseFn,
        updateCourseFn: catalogService.updateCourseFn,
        getCourseFn: catalogService.getCourseFn,
        listCoursesFn: catalogService.listCoursesFn,
        addLessonFn: catalogService.addLessonFn,
    },
    video: {
        requestVideoUploadFn: videoService.requestVideoUploadFn,
        getVideoFn: videoService.getVideoFn,
        listVideosForCourseFn: videoService.listVideosForCourseFn,
    },
    enrollment: {
        enrollFn: enrollmentService.enrollFn,
        getEnrollmentFn: enrollmentService.getEnrollmentFn,
        listEnrollmentsForUserFn: enrollmentService.listEnrollmentsForUserFn,
        cancelEnrollmentFn: enrollmentService.cancelEnrollmentFn,
    },
    discussion: {
        createThreadFn: discussionService.createThreadFn,
        postMessageFn: discussionService.postMessageFn,
        listMessagesFn: discussionService.listMessagesFn,
        listThreadsFn: discussionService.listThreadsFn,
    },
    analytics: {
        getCourseEnrollmentStatsFn: analyticsService.getCourseEnrollmentStatsFn,
    },
});
// -- 5. WAF (regional, associates directly to the AppSync API) -----------------------
new waf_stack_1.WafStack(app, `${stackPrefix}-Waf`, {
    env,
    envConfig,
    graphqlApiArn: appsync.api.arn,
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY291cnNlLXBsYXRmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY291cnNlLXBsYXRmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLGlEQUFtQztBQUNuQywyREFBaUU7QUFDakUsMkRBQXVEO0FBQ3ZELHFFQUFnRTtBQUNoRSxxRUFBaUU7QUFDakUsaUVBQTZEO0FBQzdELHlEQUFxRDtBQUNyRCwrRkFBMEY7QUFDMUYscUdBQWdHO0FBQ2hHLGtGQUE2RTtBQUM3RSx3RkFBbUY7QUFDbkYsaUdBQTRGO0FBQzVGLHVHQUFrRztBQUNsRyxpR0FBNEY7QUFDNUYsdUdBQWtHO0FBQ2xHLDhGQUF5RjtBQUN6RixvR0FBK0Y7QUFFL0YsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDO0FBQ2xGLE1BQU0sU0FBUyxHQUFHLElBQUEsa0NBQW9CLEVBQUMsT0FBTyxDQUFDLENBQUM7QUFDaEQsTUFBTSxHQUFHLEdBQUcsRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3JFLE1BQU0sV0FBVyxHQUFHLGtCQUFrQixTQUFTLENBQUMsT0FBTyxFQUFFLENBQUM7QUFFMUQsdUZBQXVGO0FBRXZGLE1BQU0sSUFBSSxHQUFHLElBQUksc0JBQVMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxXQUFXLE9BQU8sRUFBRSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0FBQzNFLE1BQU0sUUFBUSxHQUFHLElBQUksK0JBQWEsQ0FBQyxHQUFHLEVBQUUsR0FBRyxXQUFXLFdBQVcs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LEVBQUU7UUFDVCwwQkFBMEIsRUFBRSxnQkFBZ0IsQ0FBQywwQkFBMEI7S0FDeEU7Q0FDRixDQUFDLENBQUM7QUFFSCx1RkFBdUY7QUFFdkYsSUFBSSxvQkFBUSxDQUFDLEdBQUcsRUFBRSxHQUFHLFdBQVcsTUFBTSxFQUFFO0lBQ3RDLEdBQUc7SUFDSCxTQUFTO0lBQ1QsYUFBYSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRztDQUMvQixDQUFDLENBQUM7QUFFSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgZ2V0RW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi9saWIvY29uZmlnL2Vudmlyb25tZW50JztcbmltcG9ydCB7IEF1dGhTdGFjayB9IGZyb20gJy4uL2xpYi9wbGF0Zm9ybS9hdXRoLXN0YWNrJztcbmltcG9ydCB7IEV2ZW50QnVzU3RhY2sgfSBmcm9tICcuLi9saWIvcGxhdGZvcm0vZXZlbnQtYnVzLXN0YWNrJztcbmltcG9ydCB7IERpc2NvdmVyeVN0YWNrIH0gZnJvbSAnLi4vbGliL3BsYXRmb3JtL2Rpc2NvdmVyeS1zdGFjayc7XG5pbXBvcnQgeyBBcHBTeW5jU3RhY2sgfSBmcm9tICcuLi9saWIvcGxhdGZvcm0vYXBwc3luYy1zdGFjayc7XG5pbXBvcnQgeyBXYWZTdGFjayB9IGZyb20gJy4uL2xpYi9wbGF0Zm9ybS93YWYtc3RhY2snO1xuaW1wb3J0IHsgQ2F0YWxvZ0RhdGFTdGFjayB9IGZyb20gJy4uL2xpYi9taWNyb3NlcnZpY2VzL2NvdXJzZS1jYXRhbG9nL2NhdGFsb2ctZGF0YS1zdGFjayc7XG5pbXBvcnQgeyBDYXRhbG9nU2VydmljZVN0YWNrIH0gZnJvbSAnLi4vbGliL21pY3Jvc2VydmljZXMvY291cnNlLWNhdGFsb2cvY2F0YWxvZy1zZXJ2aWNlLXN0YWNrJztcbmltcG9ydCB7IFZpZGVvRGF0YVN0YWNrIH0gZnJvbSAnLi4vbGliL21pY3Jvc2VydmljZXMvdmlkZW8vdmlkZW8tZGF0YS1zdGFjayc7XG5pbXBvcnQgeyBWaWRlb1NlcnZpY2VTdGFjayB9IGZyb20gJy4uL2xpYi9taWNyb3NlcnZpY2VzL3ZpZGVvL3ZpZGVvLXNlcnZpY2Utc3RhY2snO1xuaW1wb3J0IHsgRW5yb2xsbWVudERhdGFTdGFjayB9IGZyb20gJy4uL2xpYi9taWNyb3NlcnZpY2VzL2Vucm9sbG1lbnQvZW5yb2xsbWVudC1kYXRhLXN0YWNrJztcbmltcG9ydCB7IEVucm9sbG1lbnRTZXJ2aWNlU3RhY2sgfSBmcm9tICcuLi9saWIvbWljcm9zZXJ2aWNlcy9lbnJvbGxtZW50L2Vucm9sbG1lbnQtc2VydmljZS1zdGFjayc7XG5pbXBvcnQgeyBEaXNjdXNzaW9uRGF0YVN0YWNrIH0gZnJvbSAnLi4vbGliL21pY3Jvc2VydmljZXMvZGlzY3Vzc2lvbi9kaXNjdXNzaW9uLWRhdGEtc3RhY2snO1xuaW1wb3J0IHsgRGlzY3Vzc2lvblNlcnZpY2VTdGFjayB9IGZyb20gJy4uL2xpYi9taWNyb3NlcnZpY2VzL2Rpc2N1c3Npb24vZGlzY3Vzc2lvbi1zZXJ2aWNlLXN0YWNrJztcbmltcG9ydCB7IEFuYWx5dGljc0RhdGFTdGFjayB9IGZyb20gJy4uL2xpYi9taWNyb3NlcnZpY2VzL2FuYWx5dGljcy9hbmFseXRpY3MtZGF0YS1zdGFjayc7XG5pbXBvcnQgeyBBbmFseXRpY3NTZXJ2aWNlU3RhY2sgfSBmcm9tICcuLi9saWIvbWljcm9zZXJ2aWNlcy9hbmFseXRpY3MvYW5hbHl0aWNzLXNlcnZpY2Utc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG5jb25zdCBlbnZOYW1lID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52JykgPz8gcHJvY2Vzcy5lbnYuRU5WSVJPTk1FTlQgPz8gJ2Rldic7XG5jb25zdCBlbnZDb25maWcgPSBnZXRFbnZpcm9ubWVudENvbmZpZyhlbnZOYW1lKTtcbmNvbnN0IGVudiA9IHsgYWNjb3VudDogZW52Q29uZmlnLmFjY291bnQsIHJlZ2lvbjogZW52Q29uZmlnLnJlZ2lvbiB9O1xuY29uc3Qgc3RhY2tQcmVmaXggPSBgQ291cnNlUGxhdGZvcm0tJHtlbnZDb25maWcuZW52TmFtZX1gO1xuXG4vLyAtLSAxLiBQbGF0Zm9ybSAoc2hhcmVkLCBubyBkZXBlbmRlbmN5IG9uIGFueSBtaWNyb3NlcnZpY2UpIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuY29uc3QgYXV0aCA9IG5ldyBBdXRoU3RhY2soYXBwLCBgJHtzdGFja1ByZWZpeH0tQXV0aGAsIHsgZW52LCBlbnZDb25maWcgfSk7XG5jb25zdCBldmVudEJ1cyA9IG5ldyBFdmVudEJ1c1N0YWNrKGFwcCwgYCR7c3RhY2tQcmVmaXh9LUV2ZW50QnVzYCwgeyBlbnYsIGVudkNvbmZpZyB9KTtcbmNvbnN0IGRpc2NvdmVyeSA9IG5ldyBEaXNjb3ZlcnlTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1EaXNjb3ZlcnlgLCB7IGVudiwgZW52Q29uZmlnIH0pO1xuXG4vLyAtLSAyLiBEYXRhIHN0YWNrcyAoc3RhdGVmdWwsIGluZGVwZW5kZW50IG9mIGVhY2ggb3RoZXIpIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuY29uc3QgY2F0YWxvZ0RhdGEgPSBuZXcgQ2F0YWxvZ0RhdGFTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1Db3Vyc2VDYXRhbG9nLURhdGFgLCB7IGVudiwgZW52Q29uZmlnIH0pO1xuY29uc3QgdmlkZW9EYXRhID0gbmV3IFZpZGVvRGF0YVN0YWNrKGFwcCwgYCR7c3RhY2tQcmVmaXh9LVZpZGVvLURhdGFgLCB7IGVudiwgZW52Q29uZmlnIH0pO1xuY29uc3QgZW5yb2xsbWVudERhdGEgPSBuZXcgRW5yb2xsbWVudERhdGFTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1FbnJvbGxtZW50LURhdGFgLCB7IGVudiwgZW52Q29uZmlnIH0pO1xuY29uc3QgZGlzY3Vzc2lvbkRhdGEgPSBuZXcgRGlzY3Vzc2lvbkRhdGFTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1EaXNjdXNzaW9uLURhdGFgLCB7IGVudiwgZW52Q29uZmlnIH0pO1xuY29uc3QgYW5hbHl0aWNzRGF0YSA9IG5ldyBBbmFseXRpY3NEYXRhU3RhY2soYXBwLCBgJHtzdGFja1ByZWZpeH0tQW5hbHl0aWNzLURhdGFgLCB7IGVudiwgZW52Q29uZmlnIH0pO1xuXG4vLyAtLSAzLiBTZXJ2aWNlIHN0YWNrcyAoc3RhdGVsZXNzLCBkZXBlbmQgb24gdGhlaXIgb3duIGRhdGEgc3RhY2sgKyBwbGF0Zm9ybSkgLS0tLS0tLS1cblxuY29uc3QgY2F0YWxvZ1NlcnZpY2UgPSBuZXcgQ2F0YWxvZ1NlcnZpY2VTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1Db3Vyc2VDYXRhbG9nLVNlcnZpY2VgLCB7XG4gIGVudixcbiAgZW52Q29uZmlnLFxuICB0YWJsZTogY2F0YWxvZ0RhdGEudGFibGUsXG4gIHRhYmxlU3RyZWFtQXJuOiBjYXRhbG9nRGF0YS50YWJsZS50YWJsZVN0cmVhbUFybiEsXG4gIGV2ZW50QnVzOiBldmVudEJ1cy5idXMsXG4gIG5hbWVzcGFjZTogZGlzY292ZXJ5Lm5hbWVzcGFjZSxcbn0pO1xuXG5jb25zdCB2aWRlb1NlcnZpY2UgPSBuZXcgVmlkZW9TZXJ2aWNlU3RhY2soYXBwLCBgJHtzdGFja1ByZWZpeH0tVmlkZW8tU2VydmljZWAsIHtcbiAgZW52LFxuICBlbnZDb25maWcsXG4gIHRhYmxlOiB2aWRlb0RhdGEudGFibGUsXG4gIHRhYmxlU3RyZWFtQXJuOiB2aWRlb0RhdGEudGFibGUudGFibGVTdHJlYW1Bcm4hLFxuICByYXdVcGxvYWRzQnVja2V0OiB2aWRlb0RhdGEucmF3VXBsb2Fkc0J1Y2tldCxcbiAgdHJhbnNjb2RlZEJ1Y2tldDogdmlkZW9EYXRhLnRyYW5zY29kZWRCdWNrZXQsXG4gIGRpc3RyaWJ1dGlvbjogdmlkZW9EYXRhLmRpc3RyaWJ1dGlvbixcbiAgZXZlbnRCdXM6IGV2ZW50QnVzLmJ1cyxcbiAgbmFtZXNwYWNlOiBkaXNjb3ZlcnkubmFtZXNwYWNlLFxufSk7XG5cbmNvbnN0IGVucm9sbG1lbnRTZXJ2aWNlID0gbmV3IEVucm9sbG1lbnRTZXJ2aWNlU3RhY2soYXBwLCBgJHtzdGFja1ByZWZpeH0tRW5yb2xsbWVudC1TZXJ2aWNlYCwge1xuICBlbnYsXG4gIGVudkNvbmZpZyxcbiAgdGFibGU6IGVucm9sbG1lbnREYXRhLnRhYmxlLFxuICB0YWJsZVN0cmVhbUFybjogZW5yb2xsbWVudERhdGEudGFibGUudGFibGVTdHJlYW1Bcm4hLFxuICBldmVudEJ1czogZXZlbnRCdXMuYnVzLFxuICBuYW1lc3BhY2U6IGRpc2NvdmVyeS5uYW1lc3BhY2UsXG59KTtcblxuY29uc3QgZGlzY3Vzc2lvblNlcnZpY2UgPSBuZXcgRGlzY3Vzc2lvblNlcnZpY2VTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1EaXNjdXNzaW9uLVNlcnZpY2VgLCB7XG4gIGVudixcbiAgZW52Q29uZmlnLFxuICB0YWJsZTogZGlzY3Vzc2lvbkRhdGEudGFibGUsXG4gIHRhYmxlU3RyZWFtQXJuOiBkaXNjdXNzaW9uRGF0YS50YWJsZS50YWJsZVN0cmVhbUFybiEsXG4gIGV2ZW50QnVzOiBldmVudEJ1cy5idXMsXG4gIG5hbWVzcGFjZTogZGlzY292ZXJ5Lm5hbWVzcGFjZSxcbn0pO1xuXG5jb25zdCBhbmFseXRpY3NTZXJ2aWNlID0gbmV3IEFuYWx5dGljc1NlcnZpY2VTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1BbmFseXRpY3MtU2VydmljZWAsIHtcbiAgZW52LFxuICBlbnZDb25maWcsXG4gIGRhdGFMYWtlQnVja2V0OiBhbmFseXRpY3NEYXRhLmJ1Y2tldCxcbiAgZXZlbnRCdXM6IGV2ZW50QnVzLmJ1cyxcbiAgbmFtZXNwYWNlOiBkaXNjb3ZlcnkubmFtZXNwYWNlLFxufSk7XG5cbi8vIC0tIDQuIEFwcFN5bmMgQkZGIChuZWVkcyBldmVyeSBzZXJ2aWNlIHN0YWNrJ3MgTGFtYmRhIHJlZnMgKyBDb2duaXRvKSAtLS0tLS0tLS0tLS0tLVxuXG5jb25zdCBhcHBzeW5jID0gbmV3IEFwcFN5bmNTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1BcHBTeW5jYCwge1xuICBlbnYsXG4gIGVudkNvbmZpZyxcbiAgdXNlclBvb2w6IGF1dGgudXNlclBvb2wsXG4gIGNhdGFsb2c6IHtcbiAgICBjcmVhdGVDb3Vyc2VGbjogY2F0YWxvZ1NlcnZpY2UuY3JlYXRlQ291cnNlRm4sXG4gICAgdXBkYXRlQ291cnNlRm46IGNhdGFsb2dTZXJ2aWNlLnVwZGF0ZUNvdXJzZUZuLFxuICAgIGdldENvdXJzZUZuOiBjYXRhbG9nU2VydmljZS5nZXRDb3Vyc2VGbixcbiAgICBsaXN0Q291cnNlc0ZuOiBjYXRhbG9nU2VydmljZS5saXN0Q291cnNlc0ZuLFxuICAgIGFkZExlc3NvbkZuOiBjYXRhbG9nU2VydmljZS5hZGRMZXNzb25GbixcbiAgfSxcbiAgdmlkZW86IHtcbiAgICByZXF1ZXN0VmlkZW9VcGxvYWRGbjogdmlkZW9TZXJ2aWNlLnJlcXVlc3RWaWRlb1VwbG9hZEZuLFxuICAgIGdldFZpZGVvRm46IHZpZGVvU2VydmljZS5nZXRWaWRlb0ZuLFxuICAgIGxpc3RWaWRlb3NGb3JDb3Vyc2VGbjogdmlkZW9TZXJ2aWNlLmxpc3RWaWRlb3NGb3JDb3Vyc2VGbixcbiAgfSxcbiAgZW5yb2xsbWVudDoge1xuICAgIGVucm9sbEZuOiBlbnJvbGxtZW50U2VydmljZS5lbnJvbGxGbixcbiAgICBnZXRFbnJvbGxtZW50Rm46IGVucm9sbG1lbnRTZXJ2aWNlLmdldEVucm9sbG1lbnRGbixcbiAgICBsaXN0RW5yb2xsbWVudHNGb3JVc2VyRm46IGVucm9sbG1lbnRTZXJ2aWNlLmxpc3RFbnJvbGxtZW50c0ZvclVzZXJGbixcbiAgICBjYW5jZWxFbnJvbGxtZW50Rm46IGVucm9sbG1lbnRTZXJ2aWNlLmNhbmNlbEVucm9sbG1lbnRGbixcbiAgfSxcbiAgZGlzY3Vzc2lvbjoge1xuICAgIGNyZWF0ZVRocmVhZEZuOiBkaXNjdXNzaW9uU2VydmljZS5jcmVhdGVUaHJlYWRGbixcbiAgICBwb3N0TWVzc2FnZUZuOiBkaXNjdXNzaW9uU2VydmljZS5wb3N0TWVzc2FnZUZuLFxuICAgIGxpc3RNZXNzYWdlc0ZuOiBkaXNjdXNzaW9uU2VydmljZS5saXN0TWVzc2FnZXNGbixcbiAgICBsaXN0VGhyZWFkc0ZuOiBkaXNjdXNzaW9uU2VydmljZS5saXN0VGhyZWFkc0ZuLFxuICB9LFxuICBhbmFseXRpY3M6IHtcbiAgICBnZXRDb3Vyc2VFbnJvbGxtZW50U3RhdHNGbjogYW5hbHl0aWNzU2VydmljZS5nZXRDb3Vyc2VFbnJvbGxtZW50U3RhdHNGbixcbiAgfSxcbn0pO1xuXG4vLyAtLSA1LiBXQUYgKHJlZ2lvbmFsLCBhc3NvY2lhdGVzIGRpcmVjdGx5IHRvIHRoZSBBcHBTeW5jIEFQSSkgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxubmV3IFdhZlN0YWNrKGFwcCwgYCR7c3RhY2tQcmVmaXh9LVdhZmAsIHtcbiAgZW52LFxuICBlbnZDb25maWcsXG4gIGdyYXBocWxBcGlBcm46IGFwcHN5bmMuYXBpLmFybixcbn0pO1xuXG5hcHAuc3ludGgoKTtcbiJdfQ==