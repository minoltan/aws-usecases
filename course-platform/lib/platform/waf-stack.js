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
exports.WafStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const wafv2 = __importStar(require("aws-cdk-lib/aws-wafv2"));
/**
 * REGIONAL WebACL (AppSync APIs, unlike CloudFront distributions, take a regional WAF
 * association -- no us-east-1/cross-region trick needed). This is the "global dependency
 * outside any individual microservice" the book calls out (Serverless Architectures on
 * AWS, 2nd Ed., Fig 5.5); every client request funnels through this single associated API.
 */
class WafStack extends cdk.Stack {
    webAcl;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.webAcl = new wafv2.CfnWebACL(this, 'CoursePlatformWebAcl', {
            scope: 'REGIONAL',
            defaultAction: { allow: {} },
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: `course-platform-${props.envConfig.envName}-waf`,
                sampledRequestsEnabled: true,
            },
            rules: [
                {
                    name: 'AWSManagedRulesCommonRuleSet',
                    priority: 0,
                    overrideAction: { none: {} },
                    statement: {
                        managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' },
                    },
                    visibilityConfig: {
                        cloudWatchMetricsEnabled: true,
                        metricName: 'CommonRuleSet',
                        sampledRequestsEnabled: true,
                    },
                },
                {
                    name: 'AWSManagedRulesRateLimit',
                    priority: 1,
                    statement: {
                        rateBasedStatement: { limit: 2000, aggregateKeyType: 'IP' },
                    },
                    action: { block: {} },
                    visibilityConfig: {
                        cloudWatchMetricsEnabled: true,
                        metricName: 'RateLimit',
                        sampledRequestsEnabled: true,
                    },
                },
            ],
        });
        new wafv2.CfnWebACLAssociation(this, 'GraphQLApiWebAclAssociation', {
            resourceArn: props.graphqlApiArn,
            webAclArn: this.webAcl.attrArn,
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        new cdk.CfnOutput(this, 'WebAclArn', {
            value: this.webAcl.attrArn,
            exportName: `course-platform-${props.envConfig.envName}-WebAclArn`,
        });
    }
}
exports.WafStack = WafStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FmLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2FmLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyw2REFBK0M7QUFTL0M7Ozs7O0dBS0c7QUFDSCxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNyQixNQUFNLENBQWtCO0lBRXhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlELEtBQUssRUFBRSxVQUFVO1lBQ2pCLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7WUFDNUIsZ0JBQWdCLEVBQUU7Z0JBQ2hCLHdCQUF3QixFQUFFLElBQUk7Z0JBQzlCLFVBQVUsRUFBRSxtQkFBbUIsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLE1BQU07Z0JBQzVELHNCQUFzQixFQUFFLElBQUk7YUFDN0I7WUFDRCxLQUFLLEVBQUU7Z0JBQ0w7b0JBQ0UsSUFBSSxFQUFFLDhCQUE4QjtvQkFDcEMsUUFBUSxFQUFFLENBQUM7b0JBQ1gsY0FBYyxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRTtvQkFDNUIsU0FBUyxFQUFFO3dCQUNULHlCQUF5QixFQUFFLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsOEJBQThCLEVBQUU7cUJBQ3ZGO29CQUNELGdCQUFnQixFQUFFO3dCQUNoQix3QkFBd0IsRUFBRSxJQUFJO3dCQUM5QixVQUFVLEVBQUUsZUFBZTt3QkFDM0Isc0JBQXNCLEVBQUUsSUFBSTtxQkFDN0I7aUJBQ0Y7Z0JBQ0Q7b0JBQ0UsSUFBSSxFQUFFLDBCQUEwQjtvQkFDaEMsUUFBUSxFQUFFLENBQUM7b0JBQ1gsU0FBUyxFQUFFO3dCQUNULGtCQUFrQixFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUU7cUJBQzVEO29CQUNELE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7b0JBQ3JCLGdCQUFnQixFQUFFO3dCQUNoQix3QkFBd0IsRUFBRSxJQUFJO3dCQUM5QixVQUFVLEVBQUUsV0FBVzt3QkFDdkIsc0JBQXNCLEVBQUUsSUFBSTtxQkFDN0I7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksS0FBSyxDQUFDLG9CQUFvQixDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUNsRSxXQUFXLEVBQUUsS0FBSyxDQUFDLGFBQWE7WUFDaEMsU0FBUyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTztTQUMvQixDQUFDLENBQUM7UUFFSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDcEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTlELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU87WUFDMUIsVUFBVSxFQUFFLG1CQUFtQixLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sWUFBWTtTQUNuRSxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6REQsNEJBeURDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHdhZnYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy13YWZ2Mic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vY29uZmlnL2Vudmlyb25tZW50JztcblxuZXhwb3J0IGludGVyZmFjZSBXYWZTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZDb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuICBncmFwaHFsQXBpQXJuOiBzdHJpbmc7XG59XG5cbi8qKlxuICogUkVHSU9OQUwgV2ViQUNMIChBcHBTeW5jIEFQSXMsIHVubGlrZSBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbnMsIHRha2UgYSByZWdpb25hbCBXQUZcbiAqIGFzc29jaWF0aW9uIC0tIG5vIHVzLWVhc3QtMS9jcm9zcy1yZWdpb24gdHJpY2sgbmVlZGVkKS4gVGhpcyBpcyB0aGUgXCJnbG9iYWwgZGVwZW5kZW5jeVxuICogb3V0c2lkZSBhbnkgaW5kaXZpZHVhbCBtaWNyb3NlcnZpY2VcIiB0aGUgYm9vayBjYWxscyBvdXQgKFNlcnZlcmxlc3MgQXJjaGl0ZWN0dXJlcyBvblxuICogQVdTLCAybmQgRWQuLCBGaWcgNS41KTsgZXZlcnkgY2xpZW50IHJlcXVlc3QgZnVubmVscyB0aHJvdWdoIHRoaXMgc2luZ2xlIGFzc29jaWF0ZWQgQVBJLlxuICovXG5leHBvcnQgY2xhc3MgV2FmU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViQWNsOiB3YWZ2Mi5DZm5XZWJBQ0w7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFdhZlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIHRoaXMud2ViQWNsID0gbmV3IHdhZnYyLkNmbldlYkFDTCh0aGlzLCAnQ291cnNlUGxhdGZvcm1XZWJBY2wnLCB7XG4gICAgICBzY29wZTogJ1JFR0lPTkFMJyxcbiAgICAgIGRlZmF1bHRBY3Rpb246IHsgYWxsb3c6IHt9IH0sXG4gICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljTmFtZTogYGNvdXJzZS1wbGF0Zm9ybS0ke3Byb3BzLmVudkNvbmZpZy5lbnZOYW1lfS13YWZgLFxuICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnQVdTTWFuYWdlZFJ1bGVzQ29tbW9uUnVsZVNldCcsXG4gICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgb3ZlcnJpZGVBY3Rpb246IHsgbm9uZToge30gfSxcbiAgICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgIG1hbmFnZWRSdWxlR3JvdXBTdGF0ZW1lbnQ6IHsgdmVuZG9yTmFtZTogJ0FXUycsIG5hbWU6ICdBV1NNYW5hZ2VkUnVsZXNDb21tb25SdWxlU2V0JyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgICAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0NvbW1vblJ1bGVTZXQnLFxuICAgICAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ0FXU01hbmFnZWRSdWxlc1JhdGVMaW1pdCcsXG4gICAgICAgICAgcHJpb3JpdHk6IDEsXG4gICAgICAgICAgc3RhdGVtZW50OiB7XG4gICAgICAgICAgICByYXRlQmFzZWRTdGF0ZW1lbnQ6IHsgbGltaXQ6IDIwMDAsIGFnZ3JlZ2F0ZUtleVR5cGU6ICdJUCcgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdGlvbjogeyBibG9jazoge30gfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUmF0ZUxpbWl0JyxcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBuZXcgd2FmdjIuQ2ZuV2ViQUNMQXNzb2NpYXRpb24odGhpcywgJ0dyYXBoUUxBcGlXZWJBY2xBc3NvY2lhdGlvbicsIHtcbiAgICAgIHJlc291cmNlQXJuOiBwcm9wcy5ncmFwaHFsQXBpQXJuLFxuICAgICAgd2ViQWNsQXJuOiB0aGlzLndlYkFjbC5hdHRyQXJuLFxuICAgIH0pO1xuXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ2NvdXJzZS1wbGF0Zm9ybScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZDb25maWcuZW52TmFtZSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViQWNsQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMud2ViQWNsLmF0dHJBcm4sXG4gICAgICBleHBvcnROYW1lOiBgY291cnNlLXBsYXRmb3JtLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9LVdlYkFjbEFybmAsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==