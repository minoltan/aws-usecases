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
const assertions_1 = require("aws-cdk-lib/assertions");
const catalog_data_stack_1 = require("../lib/microservices/course-catalog/catalog-data-stack");
const fixtures_1 = require("./fixtures");
describe('CatalogDataStack', () => {
    const app = new cdk.App();
    const stack = new catalog_data_stack_1.CatalogDataStack(app, 'TestCatalogDataStack', {
        env: { account: fixtures_1.testEnvConfig.account, region: fixtures_1.testEnvConfig.region },
        envConfig: fixtures_1.testEnvConfig,
    });
    const template = assertions_1.Template.fromStack(stack);
    test('creates a single PAY_PER_REQUEST table with PK/SK and streams enabled', () => {
        template.resourceCountIs('AWS::DynamoDB::Table', 1);
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            TableName: 'course-catalog-dev',
            BillingMode: 'PAY_PER_REQUEST',
            KeySchema: [
                { AttributeName: 'PK', KeyType: 'HASH' },
                { AttributeName: 'SK', KeyType: 'RANGE' },
            ],
            StreamSpecification: { StreamViewType: 'NEW_AND_OLD_IMAGES' },
        });
    });
    test('defines GSI1 for browse-by-category lookups', () => {
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'GSI1',
                    KeySchema: [
                        { AttributeName: 'GSI1PK', KeyType: 'HASH' },
                        { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
                    ],
                },
            ],
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2F0YWxvZy1kYXRhLXN0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjYXRhbG9nLWRhdGEtc3RhY2sudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1REFBa0Q7QUFDbEQsK0ZBQTBGO0FBQzFGLHlDQUEyQztBQUUzQyxRQUFRLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxFQUFFO0lBQ2hDLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQzFCLE1BQU0sS0FBSyxHQUFHLElBQUkscUNBQWdCLENBQUMsR0FBRyxFQUFFLHNCQUFzQixFQUFFO1FBQzlELEdBQUcsRUFBRSxFQUFFLE9BQU8sRUFBRSx3QkFBYSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsd0JBQWEsQ0FBQyxNQUFNLEVBQUU7UUFDckUsU0FBUyxFQUFFLHdCQUFhO0tBQ3pCLENBQUMsQ0FBQztJQUNILE1BQU0sUUFBUSxHQUFHLHFCQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRTNDLElBQUksQ0FBQyx1RUFBdUUsRUFBRSxHQUFHLEVBQUU7UUFDakYsUUFBUSxDQUFDLGVBQWUsQ0FBQyxzQkFBc0IsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNwRCxRQUFRLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLEVBQUU7WUFDckQsU0FBUyxFQUFFLG9CQUFvQjtZQUMvQixXQUFXLEVBQUUsaUJBQWlCO1lBQzlCLFNBQVMsRUFBRTtnQkFDVCxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRTtnQkFDeEMsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUU7YUFDMUM7WUFDRCxtQkFBbUIsRUFBRSxFQUFFLGNBQWMsRUFBRSxvQkFBb0IsRUFBRTtTQUM5RCxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw2Q0FBNkMsRUFBRSxHQUFHLEVBQUU7UUFDdkQsUUFBUSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQixFQUFFO1lBQ3JELHNCQUFzQixFQUFFO2dCQUN0QjtvQkFDRSxTQUFTLEVBQUUsTUFBTTtvQkFDakIsU0FBUyxFQUFFO3dCQUNULEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFO3dCQUM1QyxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRTtxQkFDOUM7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVGVtcGxhdGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hc3NlcnRpb25zJztcbmltcG9ydCB7IENhdGFsb2dEYXRhU3RhY2sgfSBmcm9tICcuLi9saWIvbWljcm9zZXJ2aWNlcy9jb3Vyc2UtY2F0YWxvZy9jYXRhbG9nLWRhdGEtc3RhY2snO1xuaW1wb3J0IHsgdGVzdEVudkNvbmZpZyB9IGZyb20gJy4vZml4dHVyZXMnO1xuXG5kZXNjcmliZSgnQ2F0YWxvZ0RhdGFTdGFjaycsICgpID0+IHtcbiAgY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbiAgY29uc3Qgc3RhY2sgPSBuZXcgQ2F0YWxvZ0RhdGFTdGFjayhhcHAsICdUZXN0Q2F0YWxvZ0RhdGFTdGFjaycsIHtcbiAgICBlbnY6IHsgYWNjb3VudDogdGVzdEVudkNvbmZpZy5hY2NvdW50LCByZWdpb246IHRlc3RFbnZDb25maWcucmVnaW9uIH0sXG4gICAgZW52Q29uZmlnOiB0ZXN0RW52Q29uZmlnLFxuICB9KTtcbiAgY29uc3QgdGVtcGxhdGUgPSBUZW1wbGF0ZS5mcm9tU3RhY2soc3RhY2spO1xuXG4gIHRlc3QoJ2NyZWF0ZXMgYSBzaW5nbGUgUEFZX1BFUl9SRVFVRVNUIHRhYmxlIHdpdGggUEsvU0sgYW5kIHN0cmVhbXMgZW5hYmxlZCcsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoJ0FXUzo6RHluYW1vREI6OlRhYmxlJywgMSk7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkR5bmFtb0RCOjpUYWJsZScsIHtcbiAgICAgIFRhYmxlTmFtZTogJ2NvdXJzZS1jYXRhbG9nLWRldicsXG4gICAgICBCaWxsaW5nTW9kZTogJ1BBWV9QRVJfUkVRVUVTVCcsXG4gICAgICBLZXlTY2hlbWE6IFtcbiAgICAgICAgeyBBdHRyaWJ1dGVOYW1lOiAnUEsnLCBLZXlUeXBlOiAnSEFTSCcgfSxcbiAgICAgICAgeyBBdHRyaWJ1dGVOYW1lOiAnU0snLCBLZXlUeXBlOiAnUkFOR0UnIH0sXG4gICAgICBdLFxuICAgICAgU3RyZWFtU3BlY2lmaWNhdGlvbjogeyBTdHJlYW1WaWV3VHlwZTogJ05FV19BTkRfT0xEX0lNQUdFUycgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnZGVmaW5lcyBHU0kxIGZvciBicm93c2UtYnktY2F0ZWdvcnkgbG9va3VwcycsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6RHluYW1vREI6OlRhYmxlJywge1xuICAgICAgR2xvYmFsU2Vjb25kYXJ5SW5kZXhlczogW1xuICAgICAgICB7XG4gICAgICAgICAgSW5kZXhOYW1lOiAnR1NJMScsXG4gICAgICAgICAgS2V5U2NoZW1hOiBbXG4gICAgICAgICAgICB7IEF0dHJpYnV0ZU5hbWU6ICdHU0kxUEsnLCBLZXlUeXBlOiAnSEFTSCcgfSxcbiAgICAgICAgICAgIHsgQXR0cmlidXRlTmFtZTogJ0dTSTFTSycsIEtleVR5cGU6ICdSQU5HRScgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdfQ==