"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.environments = void 0;
exports.getEnvironmentConfig = getEnvironmentConfig;
exports.environments = {
    dev: {
        envName: 'dev',
        account: process.env.CDK_DEFAULT_ACCOUNT ?? 'YOUR_DEV_ACCOUNT_ID',
        region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
        domainPrefix: 'course-platform-dev',
        alarmEmail: 'ops-dev@example.com',
    },
    staging: {
        envName: 'staging',
        account: 'YOUR_STAGING_ACCOUNT_ID',
        region: 'us-east-1',
        domainPrefix: 'course-platform-staging',
        alarmEmail: 'ops-staging@example.com',
    },
    prod: {
        envName: 'prod',
        account: 'YOUR_PROD_ACCOUNT_ID',
        region: 'us-east-1',
        domainPrefix: 'course-platform',
        alarmEmail: 'ops@example.com',
    },
};
function getEnvironmentConfig(envName) {
    const resolved = (envName ?? 'dev');
    const config = exports.environments[resolved];
    if (!config) {
        throw new Error(`Unknown environment "${envName}". Expected one of: dev, staging, prod`);
    }
    return config;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlbnZpcm9ubWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFrQ0Esb0RBT0M7QUEvQlksUUFBQSxZQUFZLEdBQStDO0lBQ3RFLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxLQUFLO1FBQ2QsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUkscUJBQXFCO1FBQ2pFLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7UUFDckQsWUFBWSxFQUFFLHFCQUFxQjtRQUNuQyxVQUFVLEVBQUUscUJBQXFCO0tBQ2xDO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsT0FBTyxFQUFFLFNBQVM7UUFDbEIsT0FBTyxFQUFFLHlCQUF5QjtRQUNsQyxNQUFNLEVBQUUsV0FBVztRQUNuQixZQUFZLEVBQUUseUJBQXlCO1FBQ3ZDLFVBQVUsRUFBRSx5QkFBeUI7S0FDdEM7SUFDRCxJQUFJLEVBQUU7UUFDSixPQUFPLEVBQUUsTUFBTTtRQUNmLE9BQU8sRUFBRSxzQkFBc0I7UUFDL0IsTUFBTSxFQUFFLFdBQVc7UUFDbkIsWUFBWSxFQUFFLGlCQUFpQjtRQUMvQixVQUFVLEVBQUUsaUJBQWlCO0tBQzlCO0NBQ0YsQ0FBQztBQUVGLFNBQWdCLG9CQUFvQixDQUFDLE9BQTJCO0lBQzlELE1BQU0sUUFBUSxHQUFHLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBb0IsQ0FBQztJQUN2RCxNQUFNLE1BQU0sR0FBRyxvQkFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLE9BQU8sd0NBQXdDLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCB0eXBlIEVudmlyb25tZW50TmFtZSA9ICdkZXYnIHwgJ3N0YWdpbmcnIHwgJ3Byb2QnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEVudmlyb25tZW50Q29uZmlnIHtcbiAgZW52TmFtZTogRW52aXJvbm1lbnROYW1lO1xuICBhY2NvdW50OiBzdHJpbmc7XG4gIHJlZ2lvbjogc3RyaW5nO1xuICBkb21haW5QcmVmaXg6IHN0cmluZztcbiAgYWxhcm1FbWFpbDogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgZW52aXJvbm1lbnRzOiBSZWNvcmQ8RW52aXJvbm1lbnROYW1lLCBFbnZpcm9ubWVudENvbmZpZz4gPSB7XG4gIGRldjoge1xuICAgIGVudk5hbWU6ICdkZXYnLFxuICAgIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQgPz8gJ1lPVVJfREVWX0FDQ09VTlRfSUQnLFxuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OID8/ICd1cy1lYXN0LTEnLFxuICAgIGRvbWFpblByZWZpeDogJ2NvdXJzZS1wbGF0Zm9ybS1kZXYnLFxuICAgIGFsYXJtRW1haWw6ICdvcHMtZGV2QGV4YW1wbGUuY29tJyxcbiAgfSxcbiAgc3RhZ2luZzoge1xuICAgIGVudk5hbWU6ICdzdGFnaW5nJyxcbiAgICBhY2NvdW50OiAnWU9VUl9TVEFHSU5HX0FDQ09VTlRfSUQnLFxuICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgZG9tYWluUHJlZml4OiAnY291cnNlLXBsYXRmb3JtLXN0YWdpbmcnLFxuICAgIGFsYXJtRW1haWw6ICdvcHMtc3RhZ2luZ0BleGFtcGxlLmNvbScsXG4gIH0sXG4gIHByb2Q6IHtcbiAgICBlbnZOYW1lOiAncHJvZCcsXG4gICAgYWNjb3VudDogJ1lPVVJfUFJPRF9BQ0NPVU5UX0lEJyxcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgIGRvbWFpblByZWZpeDogJ2NvdXJzZS1wbGF0Zm9ybScsXG4gICAgYWxhcm1FbWFpbDogJ29wc0BleGFtcGxlLmNvbScsXG4gIH0sXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RW52aXJvbm1lbnRDb25maWcoZW52TmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogRW52aXJvbm1lbnRDb25maWcge1xuICBjb25zdCByZXNvbHZlZCA9IChlbnZOYW1lID8/ICdkZXYnKSBhcyBFbnZpcm9ubWVudE5hbWU7XG4gIGNvbnN0IGNvbmZpZyA9IGVudmlyb25tZW50c1tyZXNvbHZlZF07XG4gIGlmICghY29uZmlnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVudmlyb25tZW50IFwiJHtlbnZOYW1lfVwiLiBFeHBlY3RlZCBvbmUgb2Y6IGRldiwgc3RhZ2luZywgcHJvZGApO1xuICB9XG4gIHJldHVybiBjb25maWc7XG59XG4iXX0=