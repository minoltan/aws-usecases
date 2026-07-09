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
exports.CatalogServiceStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const create_handler_1 = require("../../shared/create-handler");
const create_stream_pipe_1 = require("../../shared/create-stream-pipe");
const EVENT_SOURCE = 'course-platform.course-catalog';
/**
 * Stateless resources for the Course Catalog microservice -- safe to redeploy independently
 * of catalog-data-stack.ts (Serverless Architectures on AWS, 2nd Ed., Fig 5.4).
 */
class CatalogServiceStack extends cdk.Stack {
    createCourseFn;
    updateCourseFn;
    getCourseFn;
    listCoursesFn;
    addLessonFn;
    constructor(scope, id, props) {
        super(scope, id, props);
        const environment = {
            TABLE_NAME: props.table.tableName,
            EVENT_BUS_NAME: props.eventBus.eventBusName,
            EVENT_SOURCE,
        };
        this.createCourseFn = (0, create_handler_1.createHandler)(this, 'CreateCourseFunction', {
            domain: 'course-catalog',
            name: 'createCourse',
            environment,
        });
        this.updateCourseFn = (0, create_handler_1.createHandler)(this, 'UpdateCourseFunction', {
            domain: 'course-catalog',
            name: 'updateCourse',
            environment,
        });
        this.getCourseFn = (0, create_handler_1.createHandler)(this, 'GetCourseFunction', {
            domain: 'course-catalog',
            name: 'getCourse',
            environment,
        });
        this.listCoursesFn = (0, create_handler_1.createHandler)(this, 'ListCoursesFunction', {
            domain: 'course-catalog',
            name: 'listCourses',
            environment,
        });
        this.addLessonFn = (0, create_handler_1.createHandler)(this, 'AddLessonFunction', {
            domain: 'course-catalog',
            name: 'addLesson',
            environment,
        });
        const updateCourseStatsFn = (0, create_handler_1.createHandler)(this, 'UpdateCourseStatsFunction', {
            domain: 'course-catalog',
            name: 'updateCourseStats',
            environment,
        });
        props.table.grantReadWriteData(this.createCourseFn);
        props.table.grantReadWriteData(this.updateCourseFn);
        props.table.grantReadData(this.getCourseFn);
        props.table.grantReadData(this.listCoursesFn);
        props.table.grantReadWriteData(this.addLessonFn);
        props.table.grantReadWriteData(updateCourseStatsFn);
        props.eventBus.grantPutEventsTo(this.createCourseFn);
        props.eventBus.grantPutEventsTo(this.updateCourseFn);
        props.eventBus.grantPutEventsTo(this.addLessonFn);
        // Reacts to enrollments from another microservice purely off the shared bus -- Course
        // Catalog never calls the Enrollment microservice directly.
        new events.Rule(this, 'EnrollmentCreatedRule', {
            eventBus: props.eventBus,
            eventPattern: {
                source: ['course-platform.enrollment'],
                detailType: ['Enrollment.EnrollmentCreated'],
            },
            targets: [new targets.LambdaFunction(updateCourseStatsFn)],
        });
        (0, create_stream_pipe_1.createStreamToEventBridgePipe)(this, 'CourseCatalogStreamPipe', {
            tableStreamArn: props.tableStreamArn,
            eventBus: props.eventBus,
            source: EVENT_SOURCE,
            detailType: 'CourseCatalogDataChanged',
        });
        const cmService = props.namespace.createService('CourseCatalogRegistry', {
            name: 'course-catalog',
            description: 'Course Catalog microservice',
        });
        cmService.registerNonIpInstance('Instance', {
            customAttributes: {
                LAMBDA_ENTRYPOINT_ARN: this.getCourseFn.functionArn,
                SCHEMA_VERSION: '1.0',
            },
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        cdk.Tags.of(this).add('Microservice', 'course-catalog');
    }
}
exports.CatalogServiceStack = CatalogServiceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2F0YWxvZy1zZXJ2aWNlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2F0YWxvZy1zZXJ2aWNlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQywrREFBaUQ7QUFDakQsd0VBQTBEO0FBSzFELGdFQUE0RDtBQUM1RCx3RUFBZ0Y7QUFVaEYsTUFBTSxZQUFZLEdBQUcsZ0NBQWdDLENBQUM7QUFFdEQ7OztHQUdHO0FBQ0gsTUFBYSxtQkFBb0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNoQyxjQUFjLENBQWlCO0lBQy9CLGNBQWMsQ0FBaUI7SUFDL0IsV0FBVyxDQUFpQjtJQUM1QixhQUFhLENBQWlCO0lBQzlCLFdBQVcsQ0FBaUI7SUFFNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUErQjtRQUN2RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFdBQVcsR0FBRztZQUNsQixVQUFVLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTO1lBQ2pDLGNBQWMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLFlBQVk7WUFDM0MsWUFBWTtTQUNiLENBQUM7UUFFRixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUEsOEJBQWEsRUFBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDaEUsTUFBTSxFQUFFLGdCQUFnQjtZQUN4QixJQUFJLEVBQUUsY0FBYztZQUNwQixXQUFXO1NBQ1osQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFBLDhCQUFhLEVBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ2hFLE1BQU0sRUFBRSxnQkFBZ0I7WUFDeEIsSUFBSSxFQUFFLGNBQWM7WUFDcEIsV0FBVztTQUNaLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxXQUFXLEdBQUcsSUFB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LElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUNwRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzFELENBQUM7Q0FDRjtBQTNGRCxrREEyRkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgSVRhYmxlIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0ICogYXMgc2VydmljZWRpc2NvdmVyeSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VydmljZWRpc2NvdmVyeSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50JztcbmltcG9ydCB7IGNyZWF0ZUhhbmRsZXIgfSBmcm9tICcuLi8uLi9zaGFyZWQvY3JlYXRlLWhhbmRsZXInO1xuaW1wb3J0IHsgY3JlYXRlU3RyZWFtVG9FdmVudEJyaWRnZVBpcGUgfSBmcm9tICcuLi8uLi9zaGFyZWQvY3JlYXRlLXN0cmVhbS1waXBlJztcblxuZXhwb3J0IGludGVyZmFjZSBDYXRhbG9nU2VydmljZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudkNvbmZpZzogRW52aXJvbm1lbnRDb25maWc7XG4gIHRhYmxlOiBJVGFibGU7XG4gIHRhYmxlU3RyZWFtQXJuOiBzdHJpbmc7XG4gIGV2ZW50QnVzOiBldmVudHMuSUV2ZW50QnVzO1xuICBuYW1lc3BhY2U6IHNlcnZpY2VkaXNjb3ZlcnkuSHR0cE5hbWVzcGFjZTtcbn1cblxuY29uc3QgRVZFTlRfU09VUkNFID0gJ2NvdXJzZS1wbGF0Zm9ybS5jb3Vyc2UtY2F0YWxvZyc7XG5cbi8qKlxuICogU3RhdGVsZXNzIHJlc291cmNlcyBmb3IgdGhlIENvdXJzZSBDYXRhbG9nIG1pY3Jvc2VydmljZSAtLSBzYWZlIHRvIHJlZGVwbG95IGluZGVwZW5kZW50bHlcbiAqIG9mIGNhdGFsb2ctZGF0YS1zdGFjay50cyAoU2VydmVybGVzcyBBcmNoaXRlY3R1cmVzIG9uIEFXUywgMm5kIEVkLiwgRmlnIDUuNCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBDYXRhbG9nU2VydmljZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGNyZWF0ZUNvdXJzZUZuOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHVwZGF0ZUNvdXJzZUZuOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGdldENvdXJzZUZuOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGxpc3RDb3Vyc2VzRm46IE5vZGVqc0Z1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYWRkTGVzc29uRm46IE5vZGVqc0Z1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDYXRhbG9nU2VydmljZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGVudmlyb25tZW50ID0ge1xuICAgICAgVEFCTEVfTkFNRTogcHJvcHMudGFibGUudGFibGVOYW1lLFxuICAgICAgRVZFTlRfQlVTX05BTUU6IHByb3BzLmV2ZW50QnVzLmV2ZW50QnVzTmFtZSxcbiAgICAgIEVWRU5UX1NPVVJDRSxcbiAgICB9O1xuXG4gICAgdGhpcy5jcmVhdGVDb3Vyc2VGbiA9IGNyZWF0ZUhhbmRsZXIodGhpcywgJ0NyZWF0ZUNvdXJzZUZ1bmN0aW9uJywge1xuICAgICAgZG9tYWluOiAnY291cnNlLWNhdGFsb2cnLFxuICAgICAgbmFtZTogJ2NyZWF0ZUNvdXJzZScsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICB9KTtcbiAgICB0aGlzLnVwZGF0ZUNvdXJzZUZuID0gY3JlYXRlSGFuZGxlcih0aGlzLCAnVXBkYXRlQ291cnNlRnVuY3Rpb24nLCB7XG4gICAgICBkb21haW46ICdjb3Vyc2UtY2F0YWxvZycsXG4gICAgICBuYW1lOiAndXBkYXRlQ291cnNlJyxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0pO1xuICAgIHRoaXMuZ2V0Q291cnNlRm4gPSBjcmVhdGVIYW5kbGVyKHRoaXMsICdHZXRDb3Vyc2VGdW5jdGlvbicsIHtcbiAgICAgIGRvbWFpbjogJ2NvdXJzZS1jYXRhbG9nJyxcbiAgICAgIG5hbWU6ICdnZXRDb3Vyc2UnLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgfSk7XG4gICAgdGhpcy5saXN0Q291cnNlc0ZuID0gY3JlYXRlSGFuZGxlcih0aGlzLCAnTGlzdENvdXJzZXNGdW5jdGlvbicsIHtcbiAgICAgIGRvbWFpbjogJ2NvdXJzZS1jYXRhbG9nJyxcbiAgICAgIG5hbWU6ICdsaXN0Q291cnNlcycsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICB9KTtcbiAgICB0aGlzLmFkZExlc3NvbkZuID0gY3JlYXRlSGFuZGxlcih0aGlzLCAnQWRkTGVzc29uRnVuY3Rpb24nLCB7XG4gICAgICBkb21haW46ICdjb3Vyc2UtY2F0YWxvZycsXG4gICAgICBuYW1lOiAnYWRkTGVzc29uJyxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0pO1xuICAgIGNvbnN0IHVwZGF0ZUNvdXJzZVN0YXRzRm4gPSBjcmVhdGVIYW5kbGVyKHRoaXMsICdVcGRhdGVDb3Vyc2VTdGF0c0Z1bmN0aW9uJywge1xuICAgICAgZG9tYWluOiAnY291cnNlLWNhdGFsb2cnLFxuICAgICAgbmFtZTogJ3VwZGF0ZUNvdXJzZVN0YXRzJyxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgcHJvcHMudGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuY3JlYXRlQ291cnNlRm4pO1xuICAgIHByb3BzLnRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLnVwZGF0ZUNvdXJzZUZuKTtcbiAgICBwcm9wcy50YWJsZS5ncmFudFJlYWREYXRhKHRoaXMuZ2V0Q291cnNlRm4pO1xuICAgIHByb3BzLnRhYmxlLmdyYW50UmVhZERhdGEodGhpcy5saXN0Q291cnNlc0ZuKTtcbiAgICBwcm9wcy50YWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5hZGRMZXNzb25Gbik7XG4gICAgcHJvcHMudGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHVwZGF0ZUNvdXJzZVN0YXRzRm4pO1xuXG4gICAgcHJvcHMuZXZlbnRCdXMuZ3JhbnRQdXRFdmVudHNUbyh0aGlzLmNyZWF0ZUNvdXJzZUZuKTtcbiAgICBwcm9wcy5ldmVudEJ1cy5ncmFudFB1dEV2ZW50c1RvKHRoaXMudXBkYXRlQ291cnNlRm4pO1xuICAgIHByb3BzLmV2ZW50QnVzLmdyYW50UHV0RXZlbnRzVG8odGhpcy5hZGRMZXNzb25Gbik7XG5cbiAgICAvLyBSZWFjdHMgdG8gZW5yb2xsbWVudHMgZnJvbSBhbm90aGVyIG1pY3Jvc2VydmljZSBwdXJlbHkgb2ZmIHRoZSBzaGFyZWQgYnVzIC0tIENvdXJzZVxuICAgIC8vIENhdGFsb2cgbmV2ZXIgY2FsbHMgdGhlIEVucm9sbG1lbnQgbWljcm9zZXJ2aWNlIGRpcmVjdGx5LlxuICAgIG5ldyBldmVudHMuUnVsZSh0aGlzLCAnRW5yb2xsbWVudENyZWF0ZWRSdWxlJywge1xuICAgICAgZXZlbnRCdXM6IHByb3BzLmV2ZW50QnVzLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydjb3Vyc2UtcGxhdGZvcm0uZW5yb2xsbWVudCddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ0Vucm9sbG1lbnQuRW5yb2xsbWVudENyZWF0ZWQnXSxcbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odXBkYXRlQ291cnNlU3RhdHNGbildLFxuICAgIH0pO1xuXG4gICAgY3JlYXRlU3RyZWFtVG9FdmVudEJyaWRnZVBpcGUodGhpcywgJ0NvdXJzZUNhdGFsb2dTdHJlYW1QaXBlJywge1xuICAgICAgdGFibGVTdHJlYW1Bcm46IHByb3BzLnRhYmxlU3RyZWFtQXJuLFxuICAgICAgZXZlbnRCdXM6IHByb3BzLmV2ZW50QnVzLFxuICAgICAgc291cmNlOiBFVkVOVF9TT1VSQ0UsXG4gICAgICBkZXRhaWxUeXBlOiAnQ291cnNlQ2F0YWxvZ0RhdGFDaGFuZ2VkJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNtU2VydmljZSA9IHByb3BzLm5hbWVzcGFjZS5jcmVhdGVTZXJ2aWNlKCdDb3Vyc2VDYXRhbG9nUmVnaXN0cnknLCB7XG4gICAgICBuYW1lOiAnY291cnNlLWNhdGFsb2cnLFxuICAgICAgZGVzY3JpcHRpb246ICdDb3Vyc2UgQ2F0YWxvZyBtaWNyb3NlcnZpY2UnLFxuICAgIH0pO1xuICAgIGNtU2VydmljZS5yZWdpc3Rlck5vbklwSW5zdGFuY2UoJ0luc3RhbmNlJywge1xuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICBMQU1CREFfRU5UUllQT0lOVF9BUk46IHRoaXMuZ2V0Q291cnNlRm4uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFNDSEVNQV9WRVJTSU9OOiAnMS4wJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnY291cnNlLXBsYXRmb3JtJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIHByb3BzLmVudkNvbmZpZy5lbnZOYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01pY3Jvc2VydmljZScsICdjb3Vyc2UtY2F0YWxvZycpO1xuICB9XG59XG4iXX0=