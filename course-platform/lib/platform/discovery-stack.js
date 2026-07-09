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
exports.DiscoveryStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const servicediscovery = __importStar(require("aws-cdk-lib/aws-servicediscovery"));
/**
 * AWS Cloud Map service registry -- the direct modern replacement for the book's in-house
 * "Sputnik" service discovery service (Serverless Architectures on AWS, 2nd Ed., 5.1.4: "AWS
 * has a service called Cloud Map... if you're looking for something like Sputnik, check out
 * Cloud Map"). Each microservice's service-stack registers itself here so the registry stays
 * an accurate directory of what services/schemas exist -- the AppSync BFF's actual routing to
 * each microservice's Lambda still uses direct CDK construct references (deploy-time, not a
 * runtime lookup), matching the scope Sputnik itself had in the book (a directory, not the
 * invocation path).
 */
class DiscoveryStack extends cdk.Stack {
    namespace;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.namespace = new servicediscovery.HttpNamespace(this, 'CoursePlatformNamespace', {
            name: 'course-platform.local',
            description: 'Service registry for course-platform microservices (Sputnik replacement)',
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    }
}
exports.DiscoveryStack = DiscoveryStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlzY292ZXJ5LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGlzY292ZXJ5LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxtRkFBcUU7QUFRckU7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSxjQUFlLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDM0IsU0FBUyxDQUFpQztJQUUxRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTBCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ25GLElBQUksRUFBRSx1QkFBdUI7WUFDN0IsV0FBVyxFQUFFLDBFQUEwRTtTQUN4RixDQUFDLENBQUM7UUFFSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDcEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2hFLENBQUM7Q0FDRjtBQWRELHdDQWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHNlcnZpY2VkaXNjb3ZlcnkgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlcnZpY2VkaXNjb3ZlcnknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uL2NvbmZpZy9lbnZpcm9ubWVudCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlzY292ZXJ5U3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52Q29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbn1cblxuLyoqXG4gKiBBV1MgQ2xvdWQgTWFwIHNlcnZpY2UgcmVnaXN0cnkgLS0gdGhlIGRpcmVjdCBtb2Rlcm4gcmVwbGFjZW1lbnQgZm9yIHRoZSBib29rJ3MgaW4taG91c2VcbiAqIFwiU3B1dG5pa1wiIHNlcnZpY2UgZGlzY292ZXJ5IHNlcnZpY2UgKFNlcnZlcmxlc3MgQXJjaGl0ZWN0dXJlcyBvbiBBV1MsIDJuZCBFZC4sIDUuMS40OiBcIkFXU1xuICogaGFzIGEgc2VydmljZSBjYWxsZWQgQ2xvdWQgTWFwLi4uIGlmIHlvdSdyZSBsb29raW5nIGZvciBzb21ldGhpbmcgbGlrZSBTcHV0bmlrLCBjaGVjayBvdXRcbiAqIENsb3VkIE1hcFwiKS4gRWFjaCBtaWNyb3NlcnZpY2UncyBzZXJ2aWNlLXN0YWNrIHJlZ2lzdGVycyBpdHNlbGYgaGVyZSBzbyB0aGUgcmVnaXN0cnkgc3RheXNcbiAqIGFuIGFjY3VyYXRlIGRpcmVjdG9yeSBvZiB3aGF0IHNlcnZpY2VzL3NjaGVtYXMgZXhpc3QgLS0gdGhlIEFwcFN5bmMgQkZGJ3MgYWN0dWFsIHJvdXRpbmcgdG9cbiAqIGVhY2ggbWljcm9zZXJ2aWNlJ3MgTGFtYmRhIHN0aWxsIHVzZXMgZGlyZWN0IENESyBjb25zdHJ1Y3QgcmVmZXJlbmNlcyAoZGVwbG95LXRpbWUsIG5vdCBhXG4gKiBydW50aW1lIGxvb2t1cCksIG1hdGNoaW5nIHRoZSBzY29wZSBTcHV0bmlrIGl0c2VsZiBoYWQgaW4gdGhlIGJvb2sgKGEgZGlyZWN0b3J5LCBub3QgdGhlXG4gKiBpbnZvY2F0aW9uIHBhdGgpLlxuICovXG5leHBvcnQgY2xhc3MgRGlzY292ZXJ5U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgbmFtZXNwYWNlOiBzZXJ2aWNlZGlzY292ZXJ5Lkh0dHBOYW1lc3BhY2U7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IERpc2NvdmVyeVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIHRoaXMubmFtZXNwYWNlID0gbmV3IHNlcnZpY2VkaXNjb3ZlcnkuSHR0cE5hbWVzcGFjZSh0aGlzLCAnQ291cnNlUGxhdGZvcm1OYW1lc3BhY2UnLCB7XG4gICAgICBuYW1lOiAnY291cnNlLXBsYXRmb3JtLmxvY2FsJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VydmljZSByZWdpc3RyeSBmb3IgY291cnNlLXBsYXRmb3JtIG1pY3Jvc2VydmljZXMgKFNwdXRuaWsgcmVwbGFjZW1lbnQpJyxcbiAgICB9KTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdjb3Vyc2UtcGxhdGZvcm0nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52Q29uZmlnLmVudk5hbWUpO1xuICB9XG59XG4iXX0=