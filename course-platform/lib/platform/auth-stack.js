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
exports.AuthStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
/**
 * Cognito replaces the book's Auth0 (Serverless Architectures on AWS, 2nd Ed., 5.1.5).
 * The internal/service-to-service role (the AWS_IAM-auth replacement for the book's
 * X-API-Key header) lives in appsync-stack.ts instead of here: it's granted permission
 * on the GraphQL API, and a role + a same-stack grant on a resource from a *different*
 * stack would create a cyclic stack dependency (AppSync already depends on this stack's
 * user pool).
 */
class AuthStack extends cdk.Stack {
    userPool;
    userPoolClient;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.userPool = new cognito.UserPool(this, 'CoursePlatformUserPool', {
            userPoolName: `course-platform-${props.envConfig.envName}`,
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            autoVerify: { email: true },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: props.envConfig.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        this.userPoolClient = this.userPool.addClient('CoursePlatformWebClient', {
            authFlows: { userPassword: true, userSrp: true },
            generateSecret: false,
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
            exportName: `course-platform-${props.envConfig.envName}-UserPoolId`,
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: this.userPoolClient.userPoolClientId,
            exportName: `course-platform-${props.envConfig.envName}-UserPoolClientId`,
        });
    }
}
exports.AuthStack = AuthStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF1dGgtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLGlFQUFtRDtBQVFuRDs7Ozs7OztHQU9HO0FBQ0gsTUFBYSxTQUFVLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdEIsUUFBUSxDQUFtQjtJQUMzQixjQUFjLENBQXlCO0lBRXZELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBcUI7UUFDN0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQ25FLFlBQVksRUFBRSxtQkFBbUIsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7WUFDMUQsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO1lBQzlCLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7WUFDM0IsY0FBYyxFQUFFO2dCQUNkLFNBQVMsRUFBRSxDQUFDO2dCQUNaLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLGFBQWEsRUFBRSxJQUFJO2dCQUNuQixjQUFjLEVBQUUsS0FBSzthQUN0QjtZQUNELGVBQWUsRUFBRSxPQUFPLENBQUMsZUFBZSxDQUFDLFVBQVU7WUFDbkQsYUFBYSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6RyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLHlCQUF5QixFQUFFO1lBQ3ZFLFNBQVMsRUFBRSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtZQUNoRCxjQUFjLEVBQUUsS0FBSztTQUN0QixDQUFDLENBQUM7UUFFSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDcEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTlELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVU7WUFDL0IsVUFBVSxFQUFFLG1CQUFtQixLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sYUFBYTtTQUNwRSxDQUFDLENBQUM7UUFDSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLGdCQUFnQjtZQUMzQyxVQUFVLEVBQUUsbUJBQW1CLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxtQkFBbUI7U0FDMUUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBeENELDhCQXdDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi9jb25maWcvZW52aXJvbm1lbnQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZDb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xufVxuXG4vKipcbiAqIENvZ25pdG8gcmVwbGFjZXMgdGhlIGJvb2sncyBBdXRoMCAoU2VydmVybGVzcyBBcmNoaXRlY3R1cmVzIG9uIEFXUywgMm5kIEVkLiwgNS4xLjUpLlxuICogVGhlIGludGVybmFsL3NlcnZpY2UtdG8tc2VydmljZSByb2xlICh0aGUgQVdTX0lBTS1hdXRoIHJlcGxhY2VtZW50IGZvciB0aGUgYm9vaydzXG4gKiBYLUFQSS1LZXkgaGVhZGVyKSBsaXZlcyBpbiBhcHBzeW5jLXN0YWNrLnRzIGluc3RlYWQgb2YgaGVyZTogaXQncyBncmFudGVkIHBlcm1pc3Npb25cbiAqIG9uIHRoZSBHcmFwaFFMIEFQSSwgYW5kIGEgcm9sZSArIGEgc2FtZS1zdGFjayBncmFudCBvbiBhIHJlc291cmNlIGZyb20gYSAqZGlmZmVyZW50KlxuICogc3RhY2sgd291bGQgY3JlYXRlIGEgY3ljbGljIHN0YWNrIGRlcGVuZGVuY3kgKEFwcFN5bmMgYWxyZWFkeSBkZXBlbmRzIG9uIHRoaXMgc3RhY2snc1xuICogdXNlciBwb29sKS5cbiAqL1xuZXhwb3J0IGNsYXNzIEF1dGhTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBdXRoU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdDb3Vyc2VQbGF0Zm9ybVVzZXJQb29sJywge1xuICAgICAgdXNlclBvb2xOYW1lOiBgY291cnNlLXBsYXRmb3JtLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9YCxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgYXV0b1ZlcmlmeTogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2UsXG4gICAgICB9LFxuICAgICAgYWNjb3VudFJlY292ZXJ5OiBjb2duaXRvLkFjY291bnRSZWNvdmVyeS5FTUFJTF9PTkxZLFxuICAgICAgcmVtb3ZhbFBvbGljeTogcHJvcHMuZW52Q29uZmlnLmVudk5hbWUgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gdGhpcy51c2VyUG9vbC5hZGRDbGllbnQoJ0NvdXJzZVBsYXRmb3JtV2ViQ2xpZW50Jywge1xuICAgICAgYXV0aEZsb3dzOiB7IHVzZXJQYXNzd29yZDogdHJ1ZSwgdXNlclNycDogdHJ1ZSB9LFxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ2NvdXJzZS1wbGF0Zm9ybScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZDb25maWcuZW52TmFtZSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBleHBvcnROYW1lOiBgY291cnNlLXBsYXRmb3JtLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9LVVzZXJQb29sSWRgLFxuICAgIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGV4cG9ydE5hbWU6IGBjb3Vyc2UtcGxhdGZvcm0tJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX0tVXNlclBvb2xDbGllbnRJZGAsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==