import { DeployConfig } from "../types/deployer";

/**
 * Ignitions default deployment configuration values.
 */
export const defaultConfig: DeployConfig = {
  blockPollingInterval: 1_000,
  timeBeforeBumpingFees: 3 * 60 * 1_000,
  maxFeeBumps: 4,
  requiredConfirmations: 5,
};

/**
 * The default number of confirmations to wait for when automining.
 */
export const DEFAULT_AUTOMINE_REQUIRED_CONFIRMATIONS = 1;
