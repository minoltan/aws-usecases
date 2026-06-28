export type EnvironmentName = 'dev' | 'staging' | 'prod';

export interface EnvironmentConfig {
  envName: EnvironmentName;
  account: string;
  region: string;
  domainPrefix: string;
  /** Total NAT Gateway count across all AZs (spec: 1 per AZ, 2 AZs). */
  natGatewayCount: number;
  examServiceMinCapacity: number;
  examServiceMaxCapacity: number;
  submissionServiceMinCapacity: number;
  submissionServiceMaxCapacity: number;
  alarmEmail: string;
}

export const environments: Record<EnvironmentName, EnvironmentConfig> = {
  dev: {
    envName: 'dev',
    account: process.env.CDK_DEFAULT_ACCOUNT ?? 'YOUR_DEV_ACCOUNT_ID',
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-southeast-1',
    domainPrefix: 'exam-dev',
    natGatewayCount: 2,
    examServiceMinCapacity: 2,
    examServiceMaxCapacity: 50,
    submissionServiceMinCapacity: 2,
    submissionServiceMaxCapacity: 30,
    alarmEmail: 'ops-dev@example.com',
  },
  staging: {
    envName: 'staging',
    account: 'YOUR_STAGING_ACCOUNT_ID',
    region: 'ap-southeast-1',
    domainPrefix: 'exam-staging',
    natGatewayCount: 2,
    examServiceMinCapacity: 2,
    examServiceMaxCapacity: 50,
    submissionServiceMinCapacity: 2,
    submissionServiceMaxCapacity: 30,
    alarmEmail: 'ops-staging@example.com',
  },
  prod: {
    envName: 'prod',
    account: 'YOUR_PROD_ACCOUNT_ID',
    region: 'ap-southeast-1',
    domainPrefix: 'exam',
    natGatewayCount: 2,
    examServiceMinCapacity: 2,
    examServiceMaxCapacity: 50,
    submissionServiceMinCapacity: 2,
    submissionServiceMaxCapacity: 30,
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
