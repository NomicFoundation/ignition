import type { IgnitionModuleResult, ModuleParameters } from "./types/module";
import type { IgnitionModuleDefinition } from "./types/module-builder";

import { IgnitionError } from "../errors";

import { Batcher } from "./internal/batcher";
import { ExecutionEngine } from "./internal/execution/execution-engine";
import { BasicExecutionStrategy } from "./internal/execution/execution-strategy";
import { executionStateReducer } from "./internal/execution/executionStateReducer";
import { EthersChainDispatcher } from "./internal/execution/transactions/chain-dispatcher";
import { TransactionServiceImplementation } from "./internal/execution/transactions/transaction-service";
import { ModuleConstructor } from "./internal/module-builder";
import { Reconcilier } from "./internal/reconciliation/reconcilier";
import { isAdapters } from "./type-guards";
import { Adapters } from "./types/adapters";
import { ArtifactResolver } from "./types/artifact";
import { DeploymentResult } from "./types/deployer";
import { ExecutionStrategy } from "./types/execution-engine";
import { ExecutionStateMap } from "./types/execution-state";
import { Journal } from "./types/journal";
import { TransactionService } from "./types/transaction-service";

/**
 * Run an Igntition deployment.
 *
 * @beta
 */
export class Deployer {
  private _journal: Journal;
  private _moduleConstructor: ModuleConstructor;
  private _executionEngine: ExecutionEngine;
  private _transactionService: TransactionService;
  private _strategy: ExecutionStrategy;

  constructor(
    options:
      | { journal: Journal; transactionService: TransactionService }
      | {
          journal: Journal;
          adapters: Adapters;
          artifactLoader: ArtifactResolver;
        }
  ) {
    this._journal = options.journal;
    this._strategy = new BasicExecutionStrategy();

    if ("adapters" in options && isAdapters(options.adapters)) {
      if (options.artifactLoader === undefined) {
        throw new IgnitionError("Artifact loader must be provided");
      }

      const adapters: Adapters = options.adapters;
      this._transactionService = new TransactionServiceImplementation(
        options.artifactLoader,
        new EthersChainDispatcher(
          adapters.signer,
          adapters.gas,
          adapters.transactions
        )
      );
    } else if ("transactionService" in options) {
      this._transactionService = options.transactionService;
    } else {
      throw new IgnitionError("Bad arguments passed to deployer");
    }

    this._moduleConstructor = new ModuleConstructor();
    this._executionEngine = new ExecutionEngine();
  }

  public async deploy(
    moduleDefinition: IgnitionModuleDefinition<
      string,
      string,
      IgnitionModuleResult<string>
    >,
    moduleParameters: ModuleParameters,
    accounts: string[]
  ): Promise<DeploymentResult> {
    const module = this._moduleConstructor.construct(moduleDefinition);

    const previousStateMap = await this._loadExecutionStateFrom(this._journal);

    const reconciliationResult = Reconcilier.reconcile(
      module,
      previousStateMap,
      moduleParameters,
      accounts
    );

    if (reconciliationResult.reconciliationFailures.length > 0) {
      throw new Error("Reconciliation failed");
    }

    if (reconciliationResult.missingExecutedFutures.length > 0) {
      // TODO: indicate to UI that warnings should be shown
    }

    const batches = Batcher.batch(module, previousStateMap);

    return this._executionEngine.execute({
      batches,
      module,
      executionStateMap: previousStateMap,
      accounts,
      strategy: this._strategy,
      journal: this._journal,
      transactionService: this._transactionService,
    });
  }

  private async _loadExecutionStateFrom(
    journal: Journal
  ): Promise<ExecutionStateMap> {
    let state: ExecutionStateMap = {};

    for await (const message of journal.read()) {
      state = executionStateReducer(state, message);
    }

    return state;
  }
}