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
exports.EventBusStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
/**
 * Shared EventBridge bus every microservice publishes domain events onto and the
 * analytics microservice consumes from -- the "global dependency that no microservice
 * has a hard dependency on" (Serverless Architectures on AWS, 2nd Ed., Fig 5.5) applied
 * to event fan-out instead of the book's Redshift ETL pull.
 */
class EventBusStack extends cdk.Stack {
    bus;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.bus = new events.EventBus(this, 'CoursePlatformEventBus', {
            eventBusName: `course-platform-${props.envConfig.envName}`,
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        new cdk.CfnOutput(this, 'EventBusName', {
            value: this.bus.eventBusName,
            exportName: `course-platform-${props.envConfig.envName}-EventBusName`,
        });
    }
}
exports.EventBusStack = EventBusStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtYnVzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZXZlbnQtYnVzLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFRakQ7Ozs7O0dBS0c7QUFDSCxNQUFhLGFBQWMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMxQixHQUFHLENBQWtCO0lBRXJDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQzdELFlBQVksRUFBRSxtQkFBbUIsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7U0FDM0QsQ0FBQyxDQUFDO1FBRUgsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3BELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU5RCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZO1lBQzVCLFVBQVUsRUFBRSxtQkFBbUIsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLGVBQWU7U0FDdEUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbEJELHNDQWtCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vY29uZmlnL2Vudmlyb25tZW50JztcblxuZXhwb3J0IGludGVyZmFjZSBFdmVudEJ1c1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudkNvbmZpZzogRW52aXJvbm1lbnRDb25maWc7XG59XG5cbi8qKlxuICogU2hhcmVkIEV2ZW50QnJpZGdlIGJ1cyBldmVyeSBtaWNyb3NlcnZpY2UgcHVibGlzaGVzIGRvbWFpbiBldmVudHMgb250byBhbmQgdGhlXG4gKiBhbmFseXRpY3MgbWljcm9zZXJ2aWNlIGNvbnN1bWVzIGZyb20gLS0gdGhlIFwiZ2xvYmFsIGRlcGVuZGVuY3kgdGhhdCBubyBtaWNyb3NlcnZpY2VcbiAqIGhhcyBhIGhhcmQgZGVwZW5kZW5jeSBvblwiIChTZXJ2ZXJsZXNzIEFyY2hpdGVjdHVyZXMgb24gQVdTLCAybmQgRWQuLCBGaWcgNS41KSBhcHBsaWVkXG4gKiB0byBldmVudCBmYW4tb3V0IGluc3RlYWQgb2YgdGhlIGJvb2sncyBSZWRzaGlmdCBFVEwgcHVsbC5cbiAqL1xuZXhwb3J0IGNsYXNzIEV2ZW50QnVzU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYnVzOiBldmVudHMuRXZlbnRCdXM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEV2ZW50QnVzU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgdGhpcy5idXMgPSBuZXcgZXZlbnRzLkV2ZW50QnVzKHRoaXMsICdDb3Vyc2VQbGF0Zm9ybUV2ZW50QnVzJywge1xuICAgICAgZXZlbnRCdXNOYW1lOiBgY291cnNlLXBsYXRmb3JtLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9YCxcbiAgICB9KTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdjb3Vyc2UtcGxhdGZvcm0nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52Q29uZmlnLmVudk5hbWUpO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0V2ZW50QnVzTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmJ1cy5ldmVudEJ1c05hbWUsXG4gICAgICBleHBvcnROYW1lOiBgY291cnNlLXBsYXRmb3JtLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9LUV2ZW50QnVzTmFtZWAsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==