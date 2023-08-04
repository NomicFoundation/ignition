import type { ContractFuture, IgnitionModuleResult } from "../types/module";
import type { IgnitionModuleDefinition } from "../types/module-builder";

import setupDebug from "debug";

import { IgnitionError } from "../../errors";
import {
  isArtifactContractAtFuture,
  isArtifactContractDeploymentFuture,
  isArtifactLibraryDeploymentFuture,
  isContractFuture,
  isNamedContractAtFuture,
  isNamedContractDeploymentFuture,
  isNamedLibraryDeploymentFuture,
} from "../type-guards";
import { Artifact, ArtifactResolver } from "../types/artifact";
import {
  DeployConfig,
  DeploymentParameters,
  DeploymentResult,
} from "../types/deployer";

import { Batcher } from "./batcher";
import { defaultConfig } from "./defaultConfig";
import { DeploymentLoader } from "./deployment-loader/types";
import { ExecutionEngine } from "./execution/execution-engine";
import { executionStateReducer } from "./execution/execution-state-reducer";
import { BasicExecutionStrategy } from "./execution/execution-strategy";
import { TranactionLookupTimerImpl } from "./execution/transaction-lookup-timer";
import {
  ChainDispatcher,
  ContractAtExecutionState,
  DeploymentExecutionState,
  ExecutionStateMap,
  ExecutionStrategy,
  TransactionLookupTimer,
} from "./execution/types";
import { ModuleConstructor } from "./module-builder";
import { Reconciler } from "./reconciliation/reconciler";
import { ArtifactMap } from "./reconciliation/types";
import { isContractExecutionStateArray } from "./type-guards";
import { assertIgnitionInvariant } from "./utils/assertions";
import { getFuturesFromModule } from "./utils/get-futures-from-module";
import { validate } from "./validation/validate";

const debug = setupDebug("ignition-core:deployer");

/**
 * Run an Igntition deployment.
 *
 * @beta
 */
export class Deployer {
  private _config: DeployConfig;
  private _moduleConstructor: ModuleConstructor;
  private _executionEngine: ExecutionEngine;
  private _strategy: ExecutionStrategy;
  private _artifactResolver: ArtifactResolver;
  private _deploymentLoader: DeploymentLoader;
  private _chainDispatcher: ChainDispatcher;
  private _transactionLookupTimer: TransactionLookupTimer;

  constructor(options: {
    config?: Partial<DeployConfig>;
    artifactResolver: ArtifactResolver;
    deploymentLoader: DeploymentLoader;
    chainDispatcher: ChainDispatcher;
  }) {
    this._config = {
      ...defaultConfig,
      ...options.config,
    };

    this._strategy = new BasicExecutionStrategy();
    this._artifactResolver = options.artifactResolver;
    this._deploymentLoader = options.deploymentLoader;

    this._chainDispatcher = options.chainDispatcher;

    this._moduleConstructor = new ModuleConstructor();
    this._executionEngine = new ExecutionEngine();
    this._transactionLookupTimer = new TranactionLookupTimerImpl(
      this._config.transactionTimeoutInterval
    );
  }

  public async deploy(
    moduleDefinition: IgnitionModuleDefinition<
      string,
      string,
      IgnitionModuleResult<string>
    >,
    deploymentParameters: DeploymentParameters,
    accounts: string[]
  ): Promise<DeploymentResult> {
    debug("Running deploy");
    const module = this._moduleConstructor.construct(moduleDefinition);

    debug("Validating constructed Ignition Module");
    await validate(
      module,
      this._artifactResolver,
      deploymentParameters,
      accounts
    );

    debug("Load journal into execution state");
    const previousStateMap = await this._loadExecutionStateFrom(
      this._deploymentLoader
    );

    debug("Run reconciliation");
    const contracts = getFuturesFromModule(module).filter(isContractFuture);
    const contractStates = contracts
      .map((contract) => previousStateMap[contract.id])
      .filter((v) => v !== undefined);

    // realistically this should be impossible to fail.
    // just need it here for the type inference
    assertIgnitionInvariant(
      isContractExecutionStateArray(contractStates),
      "Invalid state map"
    );

    // since the reconciler is purely synchronous, we load all of the artifacts at once here.
    // if reconciler was async, we could pass it the artifact loaders and load them JIT instead.
    const moduleArtifactMap = await this._loadModuleArtifactMap(contracts);
    const storedArtifactMap = await this._loadStoredArtifactMap(contractStates);

    const reconciliationResult = Reconciler.reconcile(
      module,
      previousStateMap,
      deploymentParameters,
      accounts,
      moduleArtifactMap,
      storedArtifactMap
    );

    if (reconciliationResult.reconciliationFailures.length > 0) {
      const failures = reconciliationResult.reconciliationFailures
        .map((rf) => `  ${rf.futureId} - ${rf.failure}`)
        .join("\n");

      throw new IgnitionError(`Reconciliation failed\n\n${failures}`);
    }

    if (reconciliationResult.missingExecutedFutures.length > 0) {
      // TODO: indicate to UI that warnings should be shown
    }

    debug("Generate batching for run");
    const batches = Batcher.batch(module, previousStateMap);

    debug("Start execution");
    return this._executionEngine.execute({
      config: this._config,
      block: { number: -1, hash: "-" },
      strategy: this._strategy,
      artifactResolver: this._artifactResolver,
      batches,
      module,
      executionStateMap: previousStateMap,
      accounts,
      deploymentParameters,
      deploymentLoader: this._deploymentLoader,
      chainDispatcher: this._chainDispatcher,
      transactionLookupTimer: this._transactionLookupTimer,
    });
  }

  private async _loadExecutionStateFrom(
    deploymentLoader: DeploymentLoader
  ): Promise<ExecutionStateMap> {
    let state: ExecutionStateMap = {};

    for await (const message of deploymentLoader.readFromJournal()) {
      state = executionStateReducer(state, message);
    }

    return state;
  }

  private async _loadModuleArtifactMap(
    contracts: Array<ContractFuture<string>>
  ): Promise<ArtifactMap> {
    const entries: Array<[string, Artifact]> = [];

    for (const contract of contracts) {
      if (
        isNamedContractDeploymentFuture(contract) ||
        isNamedContractAtFuture(contract) ||
        isNamedLibraryDeploymentFuture(contract)
      ) {
        const artifact = await this._artifactResolver.loadArtifact(
          contract.contractName
        );

        entries.push([contract.id, artifact]);

        continue;
      }

      if (
        isArtifactContractDeploymentFuture(contract) ||
        isArtifactContractAtFuture(contract) ||
        isArtifactLibraryDeploymentFuture(contract)
      ) {
        const artifact = contract.artifact;

        entries.push([contract.id, artifact]);

        continue;
      }

      this._assertNeverContract(contract);
    }

    return Object.fromEntries(entries);
  }

  private async _loadStoredArtifactMap(
    contractStates: Array<DeploymentExecutionState | ContractAtExecutionState>
  ): Promise<ArtifactMap> {
    const entries: Array<[string, Artifact]> = [];

    for (const contract of contractStates) {
      const artifact = await this._deploymentLoader.loadArtifact(
        contract.artifactFutureId
      );

      entries.push([contract.id, artifact]);
    }

    return Object.fromEntries(entries);
  }

  private _assertNeverContract(contract: never) {
    throw new IgnitionError(
      `Unexpected contract future type: ${JSON.stringify(contract)}`
    );
  }
}
