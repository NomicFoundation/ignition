import {
  Ignition as IgnitionCore,
  IgnitionDeployOptions,
  Providers,
  ExternalParamValue,
  Module,
  ModuleDict,
} from "@ignored/ignition-core";
import { Contract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { renderToCli } from "./ui/renderToCli";

type HardhatEthers = HardhatRuntimeEnvironment["ethers"];

interface Ignition {
  deploy<T extends ModuleDict>(
    ignitionModule: Module<T>,
    deployParams?: {
      parameters?: { [key: string]: ExternalParamValue };
      ui?: boolean;
    }
  ): Promise<DeployResult>;
}

interface DeployResult {
  [key: string]: string | number | Contract;
}

export class IgnitionWrapper implements Ignition {
  private _ignition: IgnitionCore;

  constructor(
    private _providers: Providers,
    private _ethers: HardhatEthers,
    private _deployOptions: Omit<IgnitionDeployOptions, keyof { ui?: boolean }>
  ) {
    this._ignition = new IgnitionCore(_providers, renderToCli);
  }

  public async deploy<T extends ModuleDict>(
    ignitionModule: Module<T>,
    deployParams?: {
      parameters?: { [key: string]: ExternalParamValue };
      ui?: boolean;
    }
  ): Promise<DeployResult> {
    const showUi = deployParams?.ui ?? false;

    if (deployParams?.parameters !== undefined) {
      await this._providers.config.setParams(deployParams.parameters);
    }

    const [deploymentResult] = await this._ignition.deploy(ignitionModule, {
      ...this._deployOptions,
      ui: showUi,
    });

    if (deploymentResult._kind === "hold") {
      const [moduleId, holdReason] = deploymentResult.holds;
      throw new Error(`Execution held for module '${moduleId}': ${holdReason}`);
    }

    if (deploymentResult._kind === "failure") {
      const [moduleId, failures] = deploymentResult.failures;

      let failuresMessage = "";
      for (const failure of failures) {
        failuresMessage += `  - ${failure.message}\n`;
      }

      if (showUi) {
        return process.exit(1);
      } else {
        throw new Error(
          `Execution failed for module '${moduleId}':\n\n${failuresMessage}`
        );
      }
    }

    const resolvedOutput: { [key: string]: string | number | Contract } = {};
    for (const [key, serializedFutureResult] of Object.entries(
      deploymentResult.result
    )) {
      if (
        serializedFutureResult._kind === "string" ||
        serializedFutureResult._kind === "number"
      ) {
        resolvedOutput[key] = serializedFutureResult.value;
      } else if (serializedFutureResult._kind === "tx") {
        resolvedOutput[key] = serializedFutureResult.value.hash;
      } else {
        const { abi, address } = serializedFutureResult.value;

        const contract: any = await this._ethers.getContractAt(abi, address);
        contract.abi = abi;
        resolvedOutput[key] = contract;
      }
    }

    return resolvedOutput;
  }

  public async plan<T extends ModuleDict>(ignitionModule: Module<T>) {
    return this._ignition.plan(ignitionModule);
  }
}
