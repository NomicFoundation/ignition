import {
  decodeArtifactCustomError,
  decodeArtifactFunctionCallResult,
  encodeArtifactDeploymentData,
  encodeArtifactFunctionCall,
  executeOnchainInteractionRequest,
  executeStaticCallRequest,
} from "./execution-strategy-helpers";
import {
  ExecutionResultType,
  FailedStaticCallExecutionResult,
  SimulationErrorExecutionResult,
  StrategyErrorExecutionResult,
  SuccessfulCallExecutionResult,
  SuccessfulDeploymentExecutionResult,
  SuccessfulSendDataExecutionResult,
  SuccessfulStaticCallExecutionResult,
} from "./types/execution-result";
import {
  CallExecutionState,
  DeploymentExecutionState,
  SendDataExecutionState,
  StaticCallExecutionState,
} from "./types/execution-state";
import {
  OnchainInteractionResponse,
  OnchainInteractionResponseType,
  LoadArtifactFunction,
  OnchainInteractionRequest,
  SimulationSuccessSignal,
  StaticCallRequest,
  StaticCallResponse,
  ExecutionStrategy,
} from "./types/execution-strategy";
import { NetworkInteractionType } from "./types/network-interaction";

/**
 * The most basic execution strategy, which sends a single transaction
 * for each deployment, call, and send data, and a single static call
 * per static call execution.
 */
export class BasicExecutionStrategy implements ExecutionStrategy {
  public async *executeDeployment(
    executionState: DeploymentExecutionState,
    fallbackSender: string,
    loadArtifact: LoadArtifactFunction
  ): AsyncGenerator<
    OnchainInteractionRequest | SimulationSuccessSignal | StaticCallRequest,
    | SuccessfulDeploymentExecutionResult
    | SimulationErrorExecutionResult
    | FailedStaticCallExecutionResult
    | StrategyErrorExecutionResult,
    OnchainInteractionResponse | StaticCallResponse
  > {
    const artifact = await loadArtifact(executionState.artifactFutureId);

    const transactionOrResult = yield* executeOnchainInteractionRequest(
      executionState.id,
      {
        id: 1,
        type: NetworkInteractionType.ONCHAIN_INTERACTION,
        to: undefined,
        from: executionState.from ?? fallbackSender,
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
    executionState: CallExecutionState,
    fallbackSender: string,
    loadArtifact: LoadArtifactFunction
  ): AsyncGenerator<
    OnchainInteractionRequest | SimulationSuccessSignal | StaticCallRequest,
    | SuccessfulCallExecutionResult
    | SimulationErrorExecutionResult
    | FailedStaticCallExecutionResult
    | StrategyErrorExecutionResult,
    OnchainInteractionResponse | StaticCallResponse
  > {
    const artifact = await loadArtifact(executionState.artifactFutureId);

    const transactionOrResult = yield* executeOnchainInteractionRequest(
      executionState.id,
      {
        id: 1,
        type: NetworkInteractionType.ONCHAIN_INTERACTION,
        to: undefined,
        from: executionState.from ?? fallbackSender,
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
    executionState: SendDataExecutionState,
    fallbackSender: string
  ): AsyncGenerator<
    OnchainInteractionRequest | SimulationSuccessSignal | StaticCallRequest,
    | SuccessfulSendDataExecutionResult
    | SimulationErrorExecutionResult
    | FailedStaticCallExecutionResult
    | StrategyErrorExecutionResult,
    OnchainInteractionResponse | StaticCallResponse
  > {
    const transactionOrResult = yield* executeOnchainInteractionRequest(
      executionState.id,
      {
        id: 1,
        type: NetworkInteractionType.ONCHAIN_INTERACTION,
        to: undefined,
        from: executionState.from ?? fallbackSender,
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
    executionState: StaticCallExecutionState,
    fallbackSender: string,
    loadArtifact: LoadArtifactFunction
  ): AsyncGenerator<
    StaticCallRequest,
    | SuccessfulStaticCallExecutionResult
    | FailedStaticCallExecutionResult
    | StrategyErrorExecutionResult,
    StaticCallResponse
  > {
    const artifact = await loadArtifact(executionState.artifactFutureId);

    const decodedResultOrError = yield* executeStaticCallRequest(
      {
        id: 1,
        type: NetworkInteractionType.STATIC_CALL,
        to: executionState.contractAddress,
        from: executionState.from ?? fallbackSender,
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
      result: decodedResultOrError,
    };
  }
}