export type EnvironmentName = 'dev' | 'staging' | 'prod';
export interface EnvironmentConfig {
    envName: EnvironmentName;
    account: string;
    region: string;
    domainPrefix: string;
    alarmEmail: string;
}
export declare const environments: Record<EnvironmentName, EnvironmentConfig>;
export declare function getEnvironmentConfig(envName: string | undefined): EnvironmentConfig;
