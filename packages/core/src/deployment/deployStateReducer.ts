import { ExecutionGraph } from "execution/ExecutionGraph";
import { ExecuteBatchResult } from "execution/batch/types";
import { DeployPhase, DeployState, ExecutionState } from "types/deployment";
import { VertexVisitResult } from "types/graph";
import { Recipe } from "types/recipeGraph";
import { difference, union } from "utils/sets";

export function initializeDeployState(recipe: Recipe): DeployState {
  return {
    phase: "uninitialized",
    details: {
      recipeName: recipe.name,
      chainId: 0,
    },
    validation: {
      errors: [],
    },
    transform: {
      executionGraph: null,
    },
    execution: {
      unstarted: new Set<number>(),
      onHold: new Set<number>(),
      completed: new Set<number>(),
      errored: new Set<number>(),
      batch: new Set<number>(),
      previousBatches: [],
      resultsAccumulator: new Map<number, VertexVisitResult>(),
    },
  };
}

export function initialiseExecutionStateFrom(
  executionGraph: ExecutionGraph
): ExecutionState {
  const unstarted = new Set<number>(executionGraph.vertexes.keys());

  const executionState: ExecutionState = {
    unstarted,
    onHold: new Set<number>(),
    completed: new Set<number>(),
    errored: new Set<number>(),
    batch: new Set<number>(),
    previousBatches: [],
    resultsAccumulator: [...unstarted].reduce<Map<number, any>>((acc, id) => {
      acc.set(id, null);

      return acc;
    }, new Map<number, any>()),
  };

  return executionState;
}

export function deployStateReducer(
  state: DeployState,
  action:
    | { type: "SET_CHAIN_ID"; chainId: number }
    | {
        type: "START_VALIDATION";
      }
    | {
        type: "VALIDATION_FAIL";
        errors: Error[];
      }
    | {
        type: "TRANSFORM_COMPLETE";
        executionGraph: ExecutionGraph;
      }
    | {
        type: "START_EXECUTION_PHASE";
        executionGraph: ExecutionGraph;
      }
    | {
        type: "UPDATE_EXECUTION_WITH_NEW_BATCH";
        batch: Set<number>;
      }
    | {
        type: "UPDATE_EXECUTION_WITH_BATCH_RESULTS";
        batchResult: ExecuteBatchResult;
      }
): DeployState {
  switch (action.type) {
    case "SET_CHAIN_ID":
      return {
        ...state,
        details: {
          ...state.details,
          chainId: action.chainId,
        },
      };
    case "START_VALIDATION":
      return {
        ...state,
        phase: "validating",
      };
    case "VALIDATION_FAIL":
      return {
        ...state,
        phase: "validation-failed",
        validation: {
          ...state.validation,
          errors: action.errors,
        },
      };
    case "TRANSFORM_COMPLETE":
      return {
        ...state,
        transform: { executionGraph: action.executionGraph },
      };
    case "START_EXECUTION_PHASE":
      return {
        ...state,
        phase: "execution",
        execution: initialiseExecutionStateFrom(action.executionGraph),
      };
    case "UPDATE_EXECUTION_WITH_NEW_BATCH":
      return {
        ...state,
        execution: updateExecutionStateWithNewBatch(
          state.execution,
          action.batch
        ),
      };
    case "UPDATE_EXECUTION_WITH_BATCH_RESULTS":
      const updatedExecution = updateExecutionStateWithBatchResults(
        state.execution,
        action.batchResult
      );

      return {
        ...state,
        phase: resolvePhaseFrom(updatedExecution),
        execution: updatedExecution,
      };

    default:
      assertNeverMessageType(action);
      return state;
  }
}

function resolvePhaseFrom(updatedState: ExecutionState): DeployPhase {
  if (updatedState.errored.size > 0) {
    return "failed";
  }

  if (updatedState.unstarted.size === 0) {
    return "complete";
  }

  return "execution";
}

export function updateExecutionStateWithNewBatch(
  executionState: ExecutionState,
  batch: Set<number>
) {
  return {
    ...executionState,
    unstarted: difference(executionState.unstarted, batch),
    onHold: difference(executionState.onHold, batch),
    batch: union(executionState.batch, batch),
  };
}

export function updateExecutionStateWithBatchResults(
  executionState: ExecutionState,
  {
    errored,
    completed,
    onhold,
    resultsAccumulator: batchResultsAcc,
  }: ExecuteBatchResult
): ExecutionState {
  const batch = new Set<number>([...errored, ...completed, ...onhold]);

  const exState1 = transferFromBatchToCompleted(executionState, completed);
  const exState2 = transferFromBatchToOnHold(exState1, onhold);
  const exState3 = transferFromBatchToErrored(exState2, errored);

  const exState4 = mergeBatchResultsInResultsAccumulator(
    exState3,
    batchResultsAcc
  );

  const exState5: ExecutionState = appendBatchToArchive(exState4, batch);

  return exState5;
}

export function mergeBatchResultsInResultsAccumulator(
  executionState: ExecutionState,
  batchResultsAcc: Map<number, any>
): ExecutionState {
  const updatedResultsAccumulator = new Map(executionState.resultsAccumulator);

  batchResultsAcc.forEach((result, vertexId) => {
    updatedResultsAccumulator.set(vertexId, result);
  });

  return {
    ...executionState,
    resultsAccumulator: updatedResultsAccumulator,
  };
}

export function transferFromBatchToCompleted(
  executionState: ExecutionState,
  completed: Set<number>
): ExecutionState {
  return {
    ...executionState,
    batch: difference(executionState.batch, completed),
    completed: union(executionState.completed, completed),
  };
}

export function transferFromBatchToOnHold(
  executionState: ExecutionState,
  onHold: Set<number>
): ExecutionState {
  return {
    ...executionState,
    batch: difference(executionState.batch, onHold),
    onHold: union(executionState.onHold, onHold),
  };
}

export function transferFromBatchToErrored(
  executionState: ExecutionState,
  errored: Set<number>
) {
  return {
    ...executionState,
    batch: difference(executionState.batch, errored),
    errored: union(executionState.errored, errored),
  };
}

function appendBatchToArchive(
  extensionState: ExecutionState,
  previousBatch: Set<number>
): ExecutionState {
  return {
    ...extensionState,
    previousBatches: [...extensionState.previousBatches, previousBatch],
  };
}

function assertNeverMessageType(action: never) {
  throw new Error(`Unexpected message type ${action}`);
}
