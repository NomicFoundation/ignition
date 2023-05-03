import type { Contract } from "ethers";

import {
  construct,
  IgnitionDeployOptions,
  IgnitionError,
  initializeIgnition,
  Module,
  ModuleDict,
  ModuleParams,
  Providers,
  SerializedDeploymentResult,
} from "@ignored/ignition-core";
import { serializeReplacer } from "@ignored/ignition-core/helpers";
import {
  ICommandJournal,
  DeploymentResult,
  DeploymentResultState,
} from "@ignored/ignition-core/soon-to-be-removed";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import hash from "object-hash";

import { CommandJournal } from "./CommandJournal";
import { Deployment } from "./Deployment";
import { initializeRenderState, renderToCli } from "./ui/renderToCli";

type HardhatEthers = HardhatRuntimeEnvironment["ethers"];

type DeployResult<T extends ModuleDict> = {
  [K in keyof T]: Contract;
};

export type IgnitionWrapperOptions = Omit<
  IgnitionDeployOptions,
  keyof { force?: boolean }
>;

/**
 * Hardhat entry into Ignition.
 *
 * @alpha
 */
export class IgnitionWrapper {
  constructor(
    private _providers: Providers,
    private _ethers: HardhatEthers,
    public options: IgnitionWrapperOptions
  ) {}

  /**
   * Run a deployment of the given Ignition module.
   * @param ignitionModule - the Ignition module to deploy
   * @param deployParams - the configuration parameters to control the
   * deployment run.
   * @returns the deployed contracts as Ethers contract objects
   */
  public async deploy<T extends ModuleDict>(
    ignitionModule: Module<T>,
    deployParams?: {
      parameters?: ModuleParams;
      journalPath?: string | undefined;
      ui?: boolean;
      journal?: ICommandJournal;
      force?: boolean;
    }
  ): Promise<DeployResult<T>> {
    const showUi = deployParams?.ui ?? false;
    const force = deployParams?.force ?? false;

    const [chainId, accounts, artifacts] = await Promise.all([
      this._getChainId(this._providers),
      this._providers.accounts.getAccounts(),
      this._providers.artifacts.getAllArtifacts(),
    ]);

    const journal =
      deployParams?.journal ??
      (deployParams?.journalPath !== undefined
        ? new CommandJournal(chainId, deployParams?.journalPath)
        : undefined);

    const uiRenderer = showUi
      ? renderToCli(initializeRenderState(), deployParams?.parameters)
      : undefined;

    const ignition = initializeIgnition({
      providers: this._providers,
      uiRenderer,
      journal,
    });

    if (deployParams?.parameters !== undefined) {
      await this._providers.config.setParams(deployParams.parameters);
    }

    const deployment = new Deployment(ignitionModule.name, journal, uiRenderer);

    try {
      await deployment.setDeploymentDetails({
        accounts,
        chainId,
        artifacts,
        networkName: "unknown", // todo
        force,
      });

      const executionGraphResult = await construct(deployment, ignitionModule);

      if (executionGraphResult.isFailure) {
        const { message, failures } = executionGraphResult;

        this._fail(ignitionModule.name, message, failures);
      }

      const { executionGraph, moduleOutputs } = executionGraphResult.result;

      await deployment.transformComplete(executionGraph);

      if (journal !== undefined) {
        await deployment.load(journal.read());
      }

      const moduleChangeResult = this._checkSafeDeployment(deployment);

      if (moduleChangeResult !== null) {
        await deployment.failReconciliation();

        this._fail(ignitionModule.name, ...moduleChangeResult);
      }

      // end construct phase

      // begin execution
    } catch (err) {
      if (!(err instanceof Error)) {
        const unexpectedError = new IgnitionError("Unexpected error");

        await deployment.failUnexpected([unexpectedError]);
        this._fail(ignitionModule.name, "Unexpected error", [unexpectedError]);
      }

      await deployment.failUnexpected([err]);
    }

    const deploymentResult = (await ignition.execute(ignitionModule, {
      ...this.options,
      force,
    })) as DeploymentResult;

    if (deploymentResult._kind === DeploymentResultState.HOLD) {
      const heldVertexes = deploymentResult.holds;

      let heldMessage = "";
      for (const vertex of heldVertexes) {
        heldMessage += `  - ${vertex.label}\n`;
      }

      throw new IgnitionError(
        `Execution held for module '${ignitionModule.name}':\n\n${heldMessage}`
      );
    }

    return this._toDeploymentResult(
      deploymentResult.result as any // TODO: This `as any` should be removed once we have a proper type for the result of deploy
    );
  }

  /**
   * Construct a plan (or dry run) describing how a deployment will be executed
   * for the given module.
   *
   * @param ignitionModule - the Ignition module to plan out
   * @returns the a description of the modules deployment, including the
   * execution dependency graph.
   */
  public async plan<T extends ModuleDict>(ignitionModule: Module<T>) {
    const ignition = initializeIgnition({
      providers: this._providers,
    });

    return ignition.plan(ignitionModule);
  }

  public async info(moduleName: string, journalPath: string) {
    const journal = new CommandJournal(0, journalPath);

    const ignition = initializeIgnition({
      providers: this._providers,
      journal,
    });

    return ignition.info(moduleName);
  }

  private async _toDeploymentResult<T extends ModuleDict>(
    serializedDeploymentResult: SerializedDeploymentResult<T>
  ): Promise<DeployResult<T>> {
    const resolvedOutput: { [k: string]: Contract } = {};

    for (const [key, { abi, address }] of Object.entries(
      serializedDeploymentResult
    )) {
      resolvedOutput[key] = await this._ethers.getContractAt(abi, address);
    }

    return resolvedOutput as DeployResult<T>;
  }

  private async _getChainId(providers: Providers): Promise<number> {
    const result = await providers.ethereumProvider.request({
      method: "eth_chainId",
    });

    return Number(result);
  }

  private _fail(
    moduleName: string,
    failureType: string,
    failures: Error[]
  ): never {
    if (failures.length === 1) {
      throw failures[0];
    }

    let failuresMessage = "";
    for (const failure of failures) {
      failuresMessage += `  - ${failure.message}\n`;
    }

    throw new IgnitionError(
      `${failureType} for module '${moduleName}':\n\n${failuresMessage}`
    );
  }

  private _checkSafeDeployment(
    deployment: Deployment
  ): null | [string, Error[]] {
    if (deployment.state.details.force) {
      return null;
    }

    if (deployment.state.transform.executionGraph === null) {
      return [
        "Module reconciliation failed",
        [
          new IgnitionError(
            "Execution graph must be set to check safe deployment"
          ),
        ],
      ];
    }

    const previousExecutionGraphHash =
      deployment.state.execution.executionGraphHash;

    if (previousExecutionGraphHash === "") {
      return null;
    }

    const currentExecutionGraphHash = hash(
      JSON.parse(
        JSON.stringify(
          deployment.state.transform.executionGraph,
          serializeReplacer
        )
      )
    );

    if (previousExecutionGraphHash === currentExecutionGraphHash) {
      return null;
    }

    return [
      "Module reconciliation failed",
      [
        new IgnitionError(
          "The module has been modified since the last run. You can ignore the previous runs with the '--force' flag."
        ),
      ],
    ];
  }
}
