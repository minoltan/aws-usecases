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
exports.VideoDataStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
/**
 * Stateful resources for Video Upload & Transcode. Replaces the book's raw
 * "upload/transcode start/finish" Lambda pair (Serverless Architectures on AWS, 2nd Ed.,
 * Fig 5.2) with buckets + CloudFront that a Step Functions/MediaConvert pipeline
 * (video-service-stack.ts) drives.
 */
class VideoDataStack extends cdk.Stack {
    table;
    rawUploadsBucket;
    transcodedBucket;
    distribution;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.table = new dynamodb.Table(this, 'VideoTable', {
            tableName: `video-${props.envConfig.envName}`,
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
            removalPolicy: props.envConfig.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Video-catalog-by-course lookups: GSI1PK = COURSE#<courseId>, GSI1SK = VIDEO#<videoId>
        this.table.addGlobalSecondaryIndex({
            indexName: 'GSI1',
            partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
        });
        this.rawUploadsBucket = new s3.Bucket(this, 'RawUploadsBucket', {
            bucketName: `course-platform-raw-uploads-${props.envConfig.envName}-${cdk.Aws.ACCOUNT_ID}`,
            eventBridgeEnabled: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.PUT],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                },
            ],
            lifecycleRules: [{ expiration: cdk.Duration.days(7) }],
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: props.envConfig.envName !== 'prod',
        });
        this.transcodedBucket = new s3.Bucket(this, 'TranscodedOutputBucket', {
            bucketName: `course-platform-transcoded-${props.envConfig.envName}-${cdk.Aws.ACCOUNT_ID}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: props.envConfig.envName !== 'prod',
        });
        this.distribution = new cloudfront.Distribution(this, 'VideoDistribution', {
            comment: `course-platform-${props.envConfig.envName} transcoded video delivery`,
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(this.transcodedBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        cdk.Tags.of(this).add('Microservice', 'video');
    }
}
exports.VideoDataStack = VideoDataStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlkZW8tZGF0YS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpZGVvLWRhdGEtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsbUVBQXFEO0FBQ3JELHVEQUF5QztBQVF6Qzs7Ozs7R0FLRztBQUNILE1BQWEsY0FBZSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNCLEtBQUssQ0FBaUI7SUFDdEIsZ0JBQWdCLENBQVk7SUFDNUIsZ0JBQWdCLENBQVk7SUFDNUIsWUFBWSxDQUEwQjtJQUV0RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTBCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDbEQsU0FBUyxFQUFFLFNBQVMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7WUFDN0MsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDakUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDNUQsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxNQUFNLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxrQkFBa0I7WUFDbEQsYUFBYSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdB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RUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDakQsQ0FBQztDQUNGO0FBL0RELHdDQStEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvZW52aXJvbm1lbnQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZpZGVvRGF0YVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudkNvbmZpZzogRW52aXJvbm1lbnRDb25maWc7XG59XG5cbi8qKlxuICogU3RhdGVmdWwgcmVzb3VyY2VzIGZvciBWaWRlbyBVcGxvYWQgJiBUcmFuc2NvZGUuIFJlcGxhY2VzIHRoZSBib29rJ3MgcmF3XG4gKiBcInVwbG9hZC90cmFuc2NvZGUgc3RhcnQvZmluaXNoXCIgTGFtYmRhIHBhaXIgKFNlcnZlcmxlc3MgQXJjaGl0ZWN0dXJlcyBvbiBBV1MsIDJuZCBFZC4sXG4gKiBGaWcgNS4yKSB3aXRoIGJ1Y2tldHMgKyBDbG91ZEZyb250IHRoYXQgYSBTdGVwIEZ1bmN0aW9ucy9NZWRpYUNvbnZlcnQgcGlwZWxpbmVcbiAqICh2aWRlby1zZXJ2aWNlLXN0YWNrLnRzKSBkcml2ZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBWaWRlb0RhdGFTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB0YWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSByYXdVcGxvYWRzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSB0cmFuc2NvZGVkQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWaWRlb0RhdGFTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICB0aGlzLnRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdWaWRlb1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgdmlkZW8tJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdQSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVMsXG4gICAgICByZW1vdmFsUG9saWN5OiBwcm9wcy5lbnZDb25maWcuZW52TmFtZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIFZpZGVvLWNhdGFsb2ctYnktY291cnNlIGxvb2t1cHM6IEdTSTFQSyA9IENPVVJTRSM8Y291cnNlSWQ+LCBHU0kxU0sgPSBWSURFTyM8dmlkZW9JZD5cbiAgICB0aGlzLnRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ0dTSTEnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdHU0kxUEsnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnR1NJMVNLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIHRoaXMucmF3VXBsb2Fkc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1Jhd1VwbG9hZHNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgY291cnNlLXBsYXRmb3JtLXJhdy11cGxvYWRzLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9LSR7Y2RrLkF3cy5BQ0NPVU5UX0lEfWAsXG4gICAgICBldmVudEJyaWRnZUVuYWJsZWQ6IHRydWUsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5QVVRdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFt7IGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDcpIH1dLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBwcm9wcy5lbnZDb25maWcuZW52TmFtZSAhPT0gJ3Byb2QnLFxuICAgIH0pO1xuXG4gICAgdGhpcy50cmFuc2NvZGVkQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnVHJhbnNjb2RlZE91dHB1dEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBjb3Vyc2UtcGxhdGZvcm0tdHJhbnNjb2RlZC0ke3Byb3BzLmVudkNvbmZpZy5lbnZOYW1lfS0ke2Nkay5Bd3MuQUNDT1VOVF9JRH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogcHJvcHMuZW52Q29uZmlnLmVudk5hbWUgIT09ICdwcm9kJyxcbiAgICB9KTtcblxuICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdWaWRlb0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGNvbW1lbnQ6IGBjb3Vyc2UtcGxhdGZvcm0tJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX0gdHJhbnNjb2RlZCB2aWRlbyBkZWxpdmVyeWAsXG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBvcmlnaW5zLlMzQnVja2V0T3JpZ2luLndpdGhPcmlnaW5BY2Nlc3NDb250cm9sKHRoaXMudHJhbnNjb2RlZEJ1Y2tldCksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnY291cnNlLXBsYXRmb3JtJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIHByb3BzLmVudkNvbmZpZy5lbnZOYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01pY3Jvc2VydmljZScsICd2aWRlbycpO1xuICB9XG59XG4iXX0=