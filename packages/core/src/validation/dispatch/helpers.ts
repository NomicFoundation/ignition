import type { Services } from "../../internal/types/services";
import type { CallableFuture } from "../../types/future";

import {
  CallPoints,
  DeploymentGraphVertex,
  InternalParamValue,
} from "../../internal/types/deploymentGraph";
import {
  VertexResultEnum,
  VertexVisitResultFailure,
} from "../../internal/types/graph";
import { IgnitionError } from "../../internal/utils/errors";
import { isBytesArg } from "../../internal/utils/guards";
import { resolveProxyValue } from "../../internal/utils/proxy";

export async function resolveArtifactForCallableFuture(
  givenFuture: CallableFuture,
  { services }: { services: Services }
): Promise<any[] | undefined> {
  const future = resolveProxyValue(givenFuture);

  switch (future.type) {
    case "contract":
      switch (future.subtype) {
        case "artifact":
          return future.artifact.abi;
        case "deployed":
          return future.abi;
        case "hardhat":
          const artifact = await services.artifacts.getArtifact(
            future.contractName
          );
          return artifact.abi;
      }
    case "library":
      switch (future.subtype) {
        case "artifact":
          return future.artifact.abi;
        case "hardhat":
          const artifact = await services.artifacts.getArtifact(
            future.libraryName
          );
          return artifact.abi;
      }
    case "virtual":
      throw new IgnitionError(`Cannot call virtual future`);
    case "call":
      throw new IgnitionError(`Cannot call call future`);
    case "await":
      throw new IgnitionError(`Cannot call await future`);
    case "send":
      throw new IgnitionError(`Cannot call send future`);
  }
}

export async function validateBytesForArtifact({
  vertex,
  callPoints,
  services,
}: {
  vertex: DeploymentGraphVertex & { args: InternalParamValue[] };
  callPoints: CallPoints;
  services: Services;
}): Promise<VertexVisitResultFailure | null> {
  const bytesArgs = vertex.args.filter(isBytesArg);

  const bytesExists = await Promise.all(
    bytesArgs.map((v) => services.artifacts.hasArtifact(v.label))
  );

  const bytesDoesNotExistIndex = bytesExists.findIndex((v) => !v);

  if (bytesDoesNotExistIndex === -1) {
    return null;
  }

  return buildValidationError(
    vertex,
    `Artifact with name '${bytesArgs[bytesDoesNotExistIndex].label}' doesn't exist`,
    callPoints
  );
}

export function buildValidationError(
  vertex: DeploymentGraphVertex,
  message: string,
  callPoints: CallPoints
): VertexVisitResultFailure {
  const failure = callPoints[vertex.id] ?? new IgnitionError("-");

  failure.message = message;

  return {
    _kind: VertexResultEnum.FAILURE,
    failure,
  };
}
