import {
  EnvAppName,
  EnvGoogleCloudLocation,
  EnvGoogleCloudProject,
  EnvMastodonDomain,
  EnvTableSettings,
  EnvDebug,
} from './key';

export const MastodonDomain = process.env[EnvMastodonDomain] ?? '';
export const TableName = process.env[EnvTableSettings] ?? '';
export const AppName = process.env[EnvAppName] ?? '';
export const GoogleCloudProject = process.env[EnvGoogleCloudProject] ?? '';
export const GoogleCloudLocation = process.env[EnvGoogleCloudLocation] ?? '';
export const Debug = process.env[EnvDebug] === 'true';
