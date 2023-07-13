import { isEqual } from "lodash";

import { ArtifactContractDeploymentFuture } from "../../../types/module";
import { DeploymentExecutionState } from "../../types/execution-state";
import { resolveFromAddress } from "../../utils/resolve-from-address";
import { ExecutionStateResolver } from "../execution-state-resolver";
import { ReconciliationContext, ReconciliationFutureResult } from "../types";
import {
  addressToErrorString,
  fail,
  getBytecodeWithoutMetadata,
} from "../utils";

export function reconcileArtifactContractDeployment(
  future: ArtifactContractDeploymentFuture,
  executionState: DeploymentExecutionState,
  context: ReconciliationContext
): ReconciliationFutureResult {
  if (!isEqual(future.contractName, executionState.contractName)) {
    return fail(
      future,
      `Contract name has been changed from ${executionState.contractName} to ${future.contractName}`
    );
  }

  const moduleArtifact = context.moduleArtifactMap[future.id];
  const storedArtifact = context.storedArtifactMap[future.id];

  const moduleArtifactBytecode = getBytecodeWithoutMetadata(
    moduleArtifact.bytecode
  );
  const storedArtifactBytecode = getBytecodeWithoutMetadata(
    storedArtifact.bytecode
  );

  if (!isEqual(moduleArtifactBytecode, storedArtifactBytecode)) {
    return fail(future, "Artifact bytecodes have been changed");
  }

  const resolvedArgs = ExecutionStateResolver.resolveArgsFromExectuionState(
    future.constructorArgs,
    context
  );
  if (!isEqual(resolvedArgs, executionState.constructorArgs)) {
    return fail(future, "Constructor args have been changed");
  }

  const resolvedLibraries =
    ExecutionStateResolver.resolveLibrariesFromExecutionState(
      future.libraries,
      context
    );
  if (!isEqual(resolvedLibraries, executionState.libraries)) {
    return fail(future, "Libraries have been changed");
  }

  if (!isEqual(future.value, executionState.value)) {
    return fail(
      future,
      `Value has been changed from ${executionState.value} to ${
        typeof future.value === "bigint" ? future.value : "a module parameter"
      }`
    );
  }

  const resolvedFutureFromAddress = resolveFromAddress(future.from, context);
  const executionStateFrom =
    ExecutionStateResolver.resolveFromAddress(executionState);
  if (
    executionStateFrom !== undefined &&
    !isEqual(resolvedFutureFromAddress, executionStateFrom)
  ) {
    return fail(
      future,
      `From account has been changed from ${addressToErrorString(
        executionStateFrom
      )} to ${addressToErrorString(resolvedFutureFromAddress)}`
    );
  }

  return {
    success: true,
  };
}
