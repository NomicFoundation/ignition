import {
  DeploymentResultType,
  ExecutionErrorDeploymentResult,
  ReconciliationErrorDeploymentResult,
  ValidationErrorDeploymentResult,
} from "@ignored/ignition-core";
import { HardhatPluginError } from "hardhat/plugins";

/**
 * Converts the result of an errored deployment into a message that can
 * be shown to the user in an exception.
 *
 * @param result - the errored deployment's result
 * @returns the text of the message
 */
export function errorDeploymentResultToExceptionMessage(
  result:
    | ValidationErrorDeploymentResult
    | ReconciliationErrorDeploymentResult
    | ExecutionErrorDeploymentResult
): string {
  switch (result.type) {
    case DeploymentResultType.VALIDATION_ERROR:
      return _convertValidationError(result);
    case DeploymentResultType.RECONCILIATION_ERROR:
      return _convertReconciliationError(result);
    case DeploymentResultType.EXECUTION_ERROR:
      return _convertExecutionError(result);
  }
}

function _convertValidationError(
  result: ValidationErrorDeploymentResult
): string {
  const errorsList = Object.entries(result.errors).flatMap(
    ([futureId, errors]) => errors.map((err) => `  * ${futureId}: ${err}`)
  );

  return `The deployment wasn't run because of the following validation errors:

${errorsList.join("\n")}`;
}

function _convertReconciliationError(
  result: ReconciliationErrorDeploymentResult
) {
  const errorsList = Object.entries(result.errors).flatMap(
    ([futureId, errors]) => errors.map((err) => `  * ${futureId}: ${err}`)
  );

  return `The deployment wasn't run because of the following reconciliation errors:

${errorsList.join("\n")}`;
}

function _convertExecutionError(result: ExecutionErrorDeploymentResult) {
  const sections: string[] = [];

  const messageDetails = {
    timeouts: result.timedOut.length > 0,
    failures: result.failed.length > 0,
  };

  if (messageDetails.timeouts) {
    const timeoutList = result.timedOut.map(
      ({ futureId, executionId }) => `  * ${futureId}/${executionId}`
    );

    sections.push(`Timed out:\n\n${timeoutList.join("\n")}`);
  }

  if (messageDetails.failures) {
    const errorList = result.failed.map(
      ({ futureId, executionId, error }) =>
        `  * ${futureId}/${executionId}: ${error}`
    );

    sections.push(`Failures:\n\n${errorList.join("\n")}`);
  }

  return `The deployment wasn't successful, there were ${_toText(
    messageDetails
  )}:

${sections.join("\n\n")}`;
}

function _toText({
  timeouts,
  failures,
}: {
  timeouts: boolean;
  failures: boolean;
}): string {
  if (timeouts && failures) {
    return "timeouts and failures";
  } else if (timeouts) {
    return "timeouts";
  } else if (failures) {
    return "failures";
  }

  throw new HardhatPluginError(
    "@ignored/hardhat-ignition",
    "Invariant violated: neither timeouts or failures"
  );
}