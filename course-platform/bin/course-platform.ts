#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { getEnvironmentConfig } from '../lib/config/environment';
import { AuthStack } from '../lib/platform/auth-stack';
import { EventBusStack } from '../lib/platform/event-bus-stack';
import { DiscoveryStack } from '../lib/platform/discovery-stack';
import { AppSyncStack } from '../lib/platform/appsync-stack';
import { WafStack } from '../lib/platform/waf-stack';
import { CatalogDataStack } from '../lib/microservices/course-catalog/catalog-data-stack';
import { CatalogServiceStack } from '../lib/microservices/course-catalog/catalog-service-stack';
import { VideoDataStack } from '../lib/microservices/video/video-data-stack';
import { VideoServiceStack } from '../lib/microservices/video/video-service-stack';
import { EnrollmentDataStack } from '../lib/microservices/enrollment/enrollment-data-stack';
import { EnrollmentServiceStack } from '../lib/microservices/enrollment/enrollment-service-stack';
import { DiscussionDataStack } from '../lib/microservices/discussion/discussion-data-stack';
import { DiscussionServiceStack } from '../lib/microservices/discussion/discussion-service-stack';
import { AnalyticsDataStack } from '../lib/microservices/analytics/analytics-data-stack';
import { AnalyticsServiceStack } from '../lib/microservices/analytics/analytics-service-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? process.env.ENVIRONMENT ?? 'dev';
const envConfig = getEnvironmentConfig(envName);
const env = { account: envConfig.account, region: envConfig.region };
const stackPrefix = `CoursePlatform-${envConfig.envName}`;

// -- 1. Platform (shared, no dependency on any microservice) -------------------------

const auth = new AuthStack(app, `${stackPrefix}-Auth`, { env, envConfig });
const eventBus = new EventBusStack(app, `${stackPrefix}-EventBus`, { env, envConfig });
const discovery = new DiscoveryStack(app, `${stackPrefix}-Discovery`, { env, envConfig });

// -- 2. Data stacks (stateful, independent of each other) ----------------------------

const catalogData = new CatalogDataStack(app, `${stackPrefix}-CourseCatalog-Data`, { env, envConfig });
const videoData = new VideoDataStack(app, `${stackPrefix}-Video-Data`, { env, envConfig });
const enrollmentData = new EnrollmentDataStack(app, `${stackPrefix}-Enrollment-Data`, { env, envConfig });
const discussionData = new DiscussionDataStack(app, `${stackPrefix}-Discussion-Data`, { env, envConfig });
const analyticsData = new AnalyticsDataStack(app, `${stackPrefix}-Analytics-Data`, { env, envConfig });

// -- 3. Service stacks (stateless, depend on their own data stack + platform) --------

const catalogService = new CatalogServiceStack(app, `${stackPrefix}-CourseCatalog-Service`, {
  env,
  envConfig,
  table: catalogData.table,
  tableStreamArn: catalogData.table.tableStreamArn!,
  eventBus: eventBus.bus,
  namespace: discovery.namespace,
});

const videoService = new VideoServiceStack(app, `${stackPrefix}-Video-Service`, {
  env,
  envConfig,
  table: videoData.table,
  tableStreamArn: videoData.table.tableStreamArn!,
  rawUploadsBucket: videoData.rawUploadsBucket,
  transcodedBucket: videoData.transcodedBucket,
  distribution: videoData.distribution,
  eventBus: eventBus.bus,
  namespace: discovery.namespace,
});

const enrollmentService = new EnrollmentServiceStack(app, `${stackPrefix}-Enrollment-Service`, {
  env,
  envConfig,
  table: enrollmentData.table,
  tableStreamArn: enrollmentData.table.tableStreamArn!,
  eventBus: eventBus.bus,
  namespace: discovery.namespace,
});

const discussionService = new DiscussionServiceStack(app, `${stackPrefix}-Discussion-Service`, {
  env,
  envConfig,
  table: discussionData.table,
  tableStreamArn: discussionData.table.tableStreamArn!,
  eventBus: eventBus.bus,
  namespace: discovery.namespace,
});

const analyticsService = new AnalyticsServiceStack(app, `${stackPrefix}-Analytics-Service`, {
  env,
  envConfig,
  dataLakeBucket: analyticsData.bucket,
  eventBus: eventBus.bus,
  namespace: discovery.namespace,
});

// -- 4. AppSync BFF (needs every service stack's Lambda refs + Cognito) --------------

const appsync = new AppSyncStack(app, `${stackPrefix}-AppSync`, {
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

new WafStack(app, `${stackPrefix}-Waf`, {
  env,
  envConfig,
  graphqlApiArn: appsync.api.arn,
});

app.synth();
