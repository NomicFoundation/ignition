import { NamedLibraryDeploymentFuture } from "../../../types/module";
import { DeploymentExecutionState } from "../../new-execution/types/execution-state";
import { reconcileArtifacts } from "../helpers/reconcile-artifacts";
import { reconcileContractName } from "../helpers/reconcile-contract-name";
import { reconcileFrom } from "../helpers/reconcile-from";
import { reconcileLibraries } from "../helpers/reconcile-libraries";
import { ReconciliationContext, ReconciliationFutureResult } from "../types";

export async function reconcileNamedLibraryDeployment(
  future: NamedLibraryDeploymentFuture<string>,
  executionState: DeploymentExecutionState,
  context: ReconciliationContext
): Promise<ReconciliationFutureResult> {
  let result = reconcileContractName(future, executionState, context);
  if (result !== undefined) {
    return result;
  }

  result = await reconcileArtifacts(future, executionState, context);
  if (result !== undefined) {
    return result;
  }

  result = reconcileLibraries(future, executionState, context);
  if (result !== undefined) {
    return result;
  }

  result = reconcileFrom(future, executionState, context);
  if (result !== undefined) {
    return result;
  }

  return { success: true };
}
