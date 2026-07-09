import { EnvironmentConfig } from '../lib/config/environment';

export const testEnvConfig: EnvironmentConfig = {
  envName: 'dev',
  account: '123456789012',
  region: 'us-east-1',
  domainPrefix: 'course-platform-test',
  alarmEmail: 'ops-test@example.com',
};
