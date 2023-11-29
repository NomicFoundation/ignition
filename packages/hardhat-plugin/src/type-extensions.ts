/* eslint-disable import/no-unused-modules */
import "hardhat/types/config";
import "hardhat/types/runtime";

import { DeployConfig, ChainConfig } from "@nomicfoundation/ignition-core";

import { IgnitionHelper } from "./ignition-helper";

interface EtherscanConfig {
  apiKey: string | Record<string, string>;
  customChains: ChainConfig[];
}

declare module "hardhat/types/config" {
  export interface ProjectPathsUserConfig {
    ignition?: string;
  }

  export interface ProjectPathsConfig {
    ignition: string;
  }

  export interface HardhatUserConfig {
    ignition?: Partial<DeployConfig>;
    etherscan?: Partial<EtherscanConfig>;
  }

  export interface HardhatConfig {
    ignition: Partial<DeployConfig>;
    etherscan: EtherscanConfig;
  }
}

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    ignition: IgnitionHelper;
  }
}
