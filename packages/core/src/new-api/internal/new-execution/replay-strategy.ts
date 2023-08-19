import { assertIgnitionInvariant } from "../utils/assertions";

import {
  CallExecutionState,
  DeploymentExecutionState,
  ExecutionSateType,
  ExecutionStatus,
  SendDataExecutionState,
  StaticCallExecutionState,
} from "./types/execution-state";
import {
  CallStrategyGenerator,
  DeploymentStrategyGenerator,
  ExecutionStrategy,
  LoadArtifactFunction,
  OnchainInteractionResponseType,
  SendDataStrategyGenerator,
  StaticCallStrategyGenerator,
  SuccessfulTransaction,
} from "./types/execution-strategy";
import {
  NetworkInteraction,
  NetworkInteractionType,
} from "./types/network-interaction";

/**
 * This function creates and replays an ExecutionStrategy generator, and
 * is meant to be used in these situations:
 *  - An execution state is starting to be run.
 *  - The execution engine got a new result for a network interaction and
 *    wants to process it.
 *  - The execution engine wants to resend a transaction, and hence,
 *    re-simulate it.
 *
 * The ExecutionState must not be completed yet.
 *
 * If the ExecutionState has no NetworkInteraction, a new generator is returned.
 */
export async function replayExecutionStartegyWithOnchainInteractions(
  executionState: DeploymentExecutionState,
  strategy: ExecutionStrategy,
  fallbackSender: string,
  loadArtifact: LoadArtifactFunction
): Promise<DeploymentStrategyGenerator>;
export async function replayExecutionStartegyWithOnchainInteractions(
  executionState: CallExecutionState | SendDataExecutionState,
  strategy: ExecutionStrategy,
  fallbackSender: string,
  loadArtifact: LoadArtifactFunction
): Promise<CallStrategyGenerator>;
export async function replayExecutionStartegyWithOnchainInteractions(
  executionState: SendDataExecutionState,
  strategy: ExecutionStrategy,
  fallbackSender: string,
  loadArtifact: LoadArtifactFunction
): Promise<SendDataStrategyGenerator>;
export async function replayExecutionStartegyWithOnchainInteractions(
  executionState:
    | DeploymentExecutionState
    | CallExecutionState
    | SendDataExecutionState,
  strategy: ExecutionStrategy,
  fallbackSender: string,
  loadArtifact: LoadArtifactFunction
): Promise<
  | DeploymentStrategyGenerator
  | CallStrategyGenerator
  | SendDataStrategyGenerator
> {
  assertIgnitionInvariant(
    executionState.status === ExecutionStatus.STARTED,
    `Unexpected completed execution state ${executionState.id} when replaying it.`
  );

  let generator:
    | DeploymentStrategyGenerator
    | CallStrategyGenerator
    | SendDataStrategyGenerator;

  switch (executionState.type) {
    case ExecutionSateType.DEPLOYMENT_EXECUTION_STATE:
      generator = strategy.executeDeployment(
        executionState,
        fallbackSender,
        loadArtifact
      );
      break;
    case ExecutionSateType.CALL_EXECUTION_STATE:
      generator = strategy.executeCall(
        executionState,
        fallbackSender,
        loadArtifact
      );
      break;
    case ExecutionSateType.SEND_DATA_EXECUTION_STATE:
      generator = strategy.executeSendData(executionState, fallbackSender);
      break;
  }

  const networkInteractions = executionState.networkInteractions;

  if (networkInteractions.length === 0) {
    return generator;
  }

  let generatorResult = await generator.next();
  for (let i = 0; i < networkInteractions.length - 1; i++) {
    const interaction = networkInteractions[i];
    assertValidGeneratorResult(
      executionState.id,
      interaction,
      generatorResult,
      true
    );

    if (interaction.type === NetworkInteractionType.STATIC_CALL) {
      generatorResult = await generator.next(interaction.result!);
    } else {
      const confirmedTx = interaction.transactions.find(
        (tx) => tx.receipt !== undefined
      );

      generatorResult = await generator.next({
        type: OnchainInteractionResponseType.SUCCESSFUL_TRANSACTION,
        transaction: confirmedTx,
      } as SuccessfulTransaction);
    }
  }

  const lastInteraction = networkInteractions[networkInteractions.length - 1];

  assertValidGeneratorResult(
    executionState.id,
    lastInteraction,
    generatorResult
  );

  return generator;
}

/**
 * This function is the StaticCall-only version of replayExecutionStartegyWithOnchainInteractions.
 */
export async function replayStaticCallExecutionStrategy(
  executionState: StaticCallExecutionState,
  strategy: ExecutionStrategy,
  fallbackSender: string,
  loadArtifact: LoadArtifactFunction
): Promise<StaticCallStrategyGenerator> {
  assertIgnitionInvariant(
    executionState.status === ExecutionStatus.STARTED,
    `Unexpected completed execution state ${executionState.id} when replaying it.`
  );

  const generator = strategy.executeStaticCall(
    executionState,
    fallbackSender,
    loadArtifact
  );

  const networkInteractions = executionState.networkInteractions;

  if (networkInteractions.length === 0) {
    return generator;
  }

  let generatorResult = await generator.next();
  for (let i = 0; i < networkInteractions.length - 1; i++) {
    const interaction = networkInteractions[i];
    assertValidGeneratorResult(
      executionState.id,
      interaction,
      generatorResult,
      true
    );

    generatorResult = await generator.next(interaction.result!);
  }

  const lastInteraction = networkInteractions[networkInteractions.length - 1];

  assertValidGeneratorResult(
    executionState.id,
    lastInteraction,
    generatorResult
  );

  return generator;
}

function assertValidGeneratorResult(
  executionStateId: string,
  interaction: NetworkInteraction,
  generatorResult:
    | Awaited<ReturnType<DeploymentStrategyGenerator["next"]>>
    | Awaited<ReturnType<CallStrategyGenerator["next"]>>
    | Awaited<ReturnType<SendDataStrategyGenerator["next"]>>,
  shouldBeResolved?: true
) {
  assertIgnitionInvariant(
    generatorResult.done !== true,
    `Unexpected strategy finalization when replaying ${executionStateId}/${interaction.id}`
  );

  assertIgnitionInvariant(
    generatorResult.value.type !== "SIMULATION_SUCCESS_SIGNAL",
    `Unexpected SIMULATION_SUCCESS_SIGNAL when replaying ${executionStateId}/${interaction.id}`
  );

  assertIgnitionInvariant(
    interaction.type === generatorResult.value.type,
    `Unexpected difference between execution strategy request and wat was already executed while replaying ${executionStateId}/${interaction.id}`
  );

  if (shouldBeResolved === undefined) {
    return;
  }

  if (interaction.type === NetworkInteractionType.STATIC_CALL) {
    assertIgnitionInvariant(
      interaction.result !== undefined,
      `Unexpected unresolved StaticCall request when replaying ${executionStateId}/${interaction.id}`
    );

    return;
  }

  const confirmedTx = interaction.transactions.find(
    (tx) => tx.receipt !== undefined
  );

  assertIgnitionInvariant(
    confirmedTx !== undefined,
    `Unexpected unresolved OnchainInteraction request when replaying ${executionStateId}/${interaction.id}`
  );

  assertIgnitionInvariant(
    confirmedTx.blockHash !== undefined,
    `Unexpected unresolved OnchainInteraction request when replaying ${executionStateId}/${interaction.id}`
  );

  assertIgnitionInvariant(
    confirmedTx.blockNumber !== undefined,
    `Unexpected unresolved OnchainInteraction request when replaying ${executionStateId}/${interaction.id}`
  );

  assertIgnitionInvariant(
    confirmedTx.receipt !== undefined,
    `Unexpected unresolved OnchainInteraction request when replaying ${executionStateId}/${interaction.id}`
  );
}