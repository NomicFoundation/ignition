import { ArtifactResolver } from "../../../types/artifact";
import { ArtifactContractDeploymentFuture } from "../../../types/module";
import { validateContractConstructorArgsLength } from "../../execution/abi";
import { validateLibraryNames } from "../../execution/libraries";

export async function validateArtifactContractDeployment(
  future: ArtifactContractDeploymentFuture,
  _artifactLoader: ArtifactResolver
) {
  const artifact = future.artifact;

  validateLibraryNames(artifact, Object.keys(future.libraries));

  validateContractConstructorArgsLength(
    artifact,
    future.contractName,
    future.constructorArgs
  );
}