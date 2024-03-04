import {
  decodeArtifactCustomError,
  decodeArtifactFunctionCallResult,
  encodeArtifactDeploymentData,
  encodeArtifactFunctionCall,
  executeOnchainInteractionRequest,
  executeStaticCallRequest,
  getStaticCallExecutionStateResultValue,
} from "./internal/execution/execution-strategy-helpers";
import { ExecutionResultType } from "./internal/execution/types/execution-result";
import {
  CallExecutionState,
  DeploymentExecutionState,
  SendDataExecutionState,
  StaticCallExecutionState,
} from "./internal/execution/types/execution-state";
import {
  CallStrategyGenerator,
  DeploymentStrategyGenerator,
  ExecutionStrategy,
  LoadArtifactFunction,
  OnchainInteractionResponseType,
  SendDataStrategyGenerator,
  StaticCallStrategyGenerator,
} from "./internal/execution/types/execution-strategy";
import { NetworkInteractionType } from "./internal/execution/types/network-interaction";
import { assertIgnitionInvariant } from "./internal/utils/assertions";

/**
 * The basic execution strategy, which sends a single transaction
 * for each contract deployment, call, and send data, and a single static call
 * for each static call execution.
 *
 * @beta
 */
export class BasicStrategy {
  public readonly name = "basic" as const;
  constructor() {}
}

/**
 * The Basic strategy.
 *
 * The BasicStrategyImplementation is internal. It will be properly exposed
 * in the Core API with the full Strategy API.
 *
 * @private
 */
class BasicStrategyImplementation
  extends BasicStrategy
  implements ExecutionStrategy
{
  public readonly name = "basic" as const;
  public readonly config: {} = {};
  private _loadArtifact: LoadArtifactFunction | undefined;

  constructor() {
    super();
  }

  public async init(_loadArtifact: LoadArtifactFunction): Promise<void> {
    this._loadArtifact = _loadArtifact;
  }

  public async *executeDeployment(
    executionState: DeploymentExecutionState
  ): DeploymentStrategyGenerator {
    assertIgnitionInvariant(
      this._loadArtifact !== undefined,
      "loadArtifact not initialized"
    );

    const artifact = await this._loadArtifact(executionState.artifactId);

    const transactionOrResult = yield* executeOnchainInteractionRequest(
      executionState.id,
      {
        id: 1,
        type: NetworkInteractionType.ONCHAIN_INTERACTION,
        to: undefined,
        data: encodeArtifactDeploymentData(
          artifact,
          executionState.constructorArgs,
          executionState.libraries
        ),
        value: executionState.value,
      },
      undefined,
      (returnData) => decodeArtifactCustomError(artifact, returnData)
    );

    if (
      transactionOrResult.type !==
      OnchainInteractionResponseType.SUCCESSFUL_TRANSACTION
    ) {
      return transactionOrResult;
    }

    const tx = transactionOrResult.transaction;
    const contractAddress = tx.receipt.contractAddress;

    if (contractAddress === undefined) {
      return {
        type: ExecutionResultType.STRATEGY_ERROR,
        error: `Transaction ${tx.hash} confirmed but it didn't create a contract`,
      };
    }

    return {
      type: ExecutionResultType.SUCCESS,
      address: contractAddress,
    };
  }

  public async *executeCall(
    executionState: CallExecutionState
  ): CallStrategyGenerator {
    assertIgnitionInvariant(
      this._loadArtifact !== undefined,
      "loadArtifact not initialized"
    );

    const artifact = await this._loadArtifact(executionState.artifactId);

    const transactionOrResult = yield* executeOnchainInteractionRequest(
      executionState.id,
      {
        id: 1,
        type: NetworkInteractionType.ONCHAIN_INTERACTION,
        to: executionState.contractAddress,
        data: encodeArtifactFunctionCall(
          artifact,
          executionState.functionName,
          executionState.args
        ),
        value: executionState.value,
      },

      (returnData) =>
        decodeArtifactFunctionCallResult(
          artifact,
          executionState.functionName,
          returnData
        ),
      (returnData) => decodeArtifactCustomError(artifact, returnData)
    );

    if (
      transactionOrResult.type !==
      OnchainInteractionResponseType.SUCCESSFUL_TRANSACTION
    ) {
      return transactionOrResult;
    }

    return {
      type: ExecutionResultType.SUCCESS,
    };
  }

  public async *executeSendData(
    executionState: SendDataExecutionState
  ): SendDataStrategyGenerator {
    const transactionOrResult = yield* executeOnchainInteractionRequest(
      executionState.id,
      {
        id: 1,
        type: NetworkInteractionType.ONCHAIN_INTERACTION,
        to: executionState.to,
        data: executionState.data,
        value: executionState.value,
      }
    );

    if (
      transactionOrResult.type !==
      OnchainInteractionResponseType.SUCCESSFUL_TRANSACTION
    ) {
      return transactionOrResult;
    }

    return {
      type: ExecutionResultType.SUCCESS,
    };
  }

  public async *executeStaticCall(
    executionState: StaticCallExecutionState
  ): StaticCallStrategyGenerator {
    assertIgnitionInvariant(
      this._loadArtifact !== undefined,
      "loadArtifact not initialized"
    );

    const artifact = await this._loadArtifact(executionState.artifactId);

    const decodedResultOrError = yield* executeStaticCallRequest(
      {
        id: 1,
        type: NetworkInteractionType.STATIC_CALL,
        to: executionState.contractAddress,
        from: executionState.from,
        data: encodeArtifactFunctionCall(
          artifact,
          executionState.functionName,
          executionState.args
        ),
        value: 0n,
      },
      (returnData) =>
        decodeArtifactFunctionCallResult(
          artifact,
          executionState.functionName,
          returnData
        ),
      (returnData) => decodeArtifactCustomError(artifact, returnData)
    );

    if (decodedResultOrError.type === ExecutionResultType.STATIC_CALL_ERROR) {
      return decodedResultOrError;
    }

    return {
      type: ExecutionResultType.SUCCESS,
      value: getStaticCallExecutionStateResultValue(
        executionState,
        decodedResultOrError
      ),
    };
  }
}

// TODO: Remove this hack once we are fully exposing our Strategy API.
// We don't want to export all of the internal types and the API Extractor
// is harsh. So we define a reduced Create2Strategy class and type, but
// override the implementation. The reduced class is exported in a way
// API extractor will accept, while the richer implementation will
// actually be used.
(this as any).BasicStrategy = BasicStrategyImplementation;