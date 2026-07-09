export type EnvironmentName = 'dev' | 'staging' | 'prod';

export interface EnvironmentConfig {
  envName: EnvironmentName;
  account: string;
  region: string;
  domainPrefix: string;
  alarmEmail: string;
}

export const environments: Record<EnvironmentName, EnvironmentConfig> = {
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

export function getEnvironmentConfig(envName: string | undefined): EnvironmentConfig {
  const resolved = (envName ?? 'dev') as EnvironmentName;
  const config = environments[resolved];
  if (!config) {
    throw new Error(`Unknown environment "${envName}". Expected one of: dev, staging, prod`);
  }
  return config;
}
