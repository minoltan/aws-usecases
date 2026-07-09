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
exports.AnalyticsDataStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
/**
 * Analytics has no business-entity table of its own -- it's a pure sink, mirroring the
 * book's rule that the Redshift warehouse was never queried directly by other
 * microservices (Serverless Architectures on AWS, 2nd Ed., Fig 5.5). Just a data lake bucket.
 */
class AnalyticsDataStack extends cdk.Stack {
    bucket;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.bucket = new s3.Bucket(this, 'AnalyticsDataLakeBucket', {
            bucketName: `course-platform-analytics-${props.envConfig.envName}-${cdk.Aws.ACCOUNT_ID}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            lifecycleRules: [
                {
                    transitions: [
                        { storageClass: s3.StorageClass.INTELLIGENT_TIERING, transitionAfter: cdk.Duration.days(30) },
                    ],
                },
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: props.envConfig.envName !== 'prod',
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        cdk.Tags.of(this).add('Microservice', 'analytics');
    }
}
exports.AnalyticsDataStack = AnalyticsDataStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5hbHl0aWNzLWRhdGEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhbmFseXRpY3MtZGF0YS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBUXpDOzs7O0dBSUc7QUFDSCxNQUFhLGtCQUFtQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQy9CLE1BQU0sQ0FBWTtJQUVsQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQThCO1FBQ3RFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUMzRCxVQUFVLEVBQUUsNkJBQTZCLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFO1lBQ3hGLFVBQVUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtZQUMxQyxpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUNqRCxjQUFjLEVBQUU7Z0JBQ2Q7b0JBQ0UsV0FBVyxFQUFFO3dCQUNYLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsbUJBQW1CLEVBQUUsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFO3FCQUM5RjtpQkFDRjthQUNGO1lBQ0QsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpQkFBaUIsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sS0FBSyxNQUFNO1NBQ3RELENBQUMsQ0FBQztRQUVILEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUNwRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUNyRCxDQUFDO0NBQ0Y7QUF6QkQsZ0RBeUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50JztcblxuZXhwb3J0IGludGVyZmFjZSBBbmFseXRpY3NEYXRhU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52Q29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbn1cblxuLyoqXG4gKiBBbmFseXRpY3MgaGFzIG5vIGJ1c2luZXNzLWVudGl0eSB0YWJsZSBvZiBpdHMgb3duIC0tIGl0J3MgYSBwdXJlIHNpbmssIG1pcnJvcmluZyB0aGVcbiAqIGJvb2sncyBydWxlIHRoYXQgdGhlIFJlZHNoaWZ0IHdhcmVob3VzZSB3YXMgbmV2ZXIgcXVlcmllZCBkaXJlY3RseSBieSBvdGhlclxuICogbWljcm9zZXJ2aWNlcyAoU2VydmVybGVzcyBBcmNoaXRlY3R1cmVzIG9uIEFXUywgMm5kIEVkLiwgRmlnIDUuNSkuIEp1c3QgYSBkYXRhIGxha2UgYnVja2V0LlxuICovXG5leHBvcnQgY2xhc3MgQW5hbHl0aWNzRGF0YVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGJ1Y2tldDogczMuQnVja2V0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBbmFseXRpY3NEYXRhU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgdGhpcy5idWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBbmFseXRpY3NEYXRhTGFrZUJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBjb3Vyc2UtcGxhdGZvcm0tYW5hbHl0aWNzLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9LSR7Y2RrLkF3cy5BQ0NPVU5UX0lEfWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7IHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLklOVEVMTElHRU5UX1RJRVJJTkcsIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHByb3BzLmVudkNvbmZpZy5lbnZOYW1lICE9PSAncHJvZCcsXG4gICAgfSk7XG5cbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnY291cnNlLXBsYXRmb3JtJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIHByb3BzLmVudkNvbmZpZy5lbnZOYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01pY3Jvc2VydmljZScsICdhbmFseXRpY3MnKTtcbiAgfVxufVxuIl19