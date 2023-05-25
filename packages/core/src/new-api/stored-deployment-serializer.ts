import { IgnitionError } from "../errors";

import {
  ArtifactContractAtFutureImplementation,
  ArtifactContractDeploymentFutureImplementation,
  ArtifactLibraryDeploymentFutureImplementation,
  IgnitionModuleImplementation,
  NamedContractAtFutureImplementation,
  NamedContractCallFutureImplementation,
  NamedContractDeploymentFutureImplementation,
  NamedLibraryDeploymentFutureImplementation,
  NamedStaticCallFutureImplementation,
  ReadEventArgumentFutureImplementation,
  SendDataFutureImplementation,
} from "./internal/module";
import {
  Graph,
  getNodesInTopologicalOrder,
} from "./internal/topological-order";
import {
  isAddressResolvableFuture,
  isContractFuture,
  isFuture,
} from "./internal/utils";
import {
  AddressResolvableFuture,
  ArgumentType,
  ContractFuture,
  Future,
  FutureType,
  IgnitionModule,
  IgnitionModuleResult,
} from "./types/module";
import {
  FutureToken,
  ModuleToken,
  SerializedArgumentType,
  SerializedArtifactContractAtFuture,
  SerializedArtifactContractDeploymentFuture,
  SerializedArtifactLibraryDeploymentFuture,
  SerializedBigInt,
  SerializedFuture,
  SerializedLibraries,
  SerializedNamedContractAtFuture,
  SerializedNamedContractCallFuture,
  SerializedNamedContractDeploymentFuture,
  SerializedNamedLibraryDeploymentFuture,
  SerializedNamedStaticCallFuture,
  SerializedReadEventArgumentFuture,
  SerializedSendDataFuture,
  SerializedStoredDeployment,
  SerializedStoredModule,
  StoredDeployment,
} from "./types/serialized-deployment";

/**
 * Serialize a deployment.
 *
 * @beta
 */
export class StoredDeploymentSerializer {
  public static serialize(
    deployment: StoredDeployment
  ): SerializedStoredDeployment {
    const allModules = this._getModulesAndSubmoduleFor(deployment.module);

    return {
      details: {
        ...deployment.details,
      },
      startModule: deployment.module.id,
      modules: Object.fromEntries(
        allModules.map((m) => [m.id, this._serializeModule(m)])
      ),
    };
  }

  private static _serializeModule(
    userModule: IgnitionModule<string, string, IgnitionModuleResult<string>>
  ): SerializedStoredModule {
    return {
      id: userModule.id,
      futures: Object.fromEntries(
        Array.from(userModule.futures).map((future) => [
          future.id,
          this._serializeFuture(future),
        ])
      ),
      submodules: Array.from(userModule.submodules).map(
        this._convertModuleToModuleToken
      ),
      results: Object.fromEntries(
        Object.entries(userModule.results).map(([key, future]) => [
          key,
          this._convertFutureToFutureToken(future),
        ])
      ),
    };
  }

  private static _serializeFuture(future: Future): SerializedFuture {
    switch (future.type) {
      case FutureType.NAMED_CONTRACT_DEPLOYMENT:
        const serializedNamedContractDeploymentFuture: SerializedNamedContractDeploymentFuture =
          {
            id: future.id,
            moduleId: future.module.id,
            type: future.type,
            dependencies: Array.from(future.dependencies).map((d) =>
              this._convertFutureToFutureToken(d)
            ),
            contractName: future.contractName,
            constructorArgs: future.constructorArgs.map((arg) =>
              this._serializeArgument(arg)
            ),
            from: future.from,
            libraries: this._convertLibrariesToLibraryTokens(future.libraries),
            value: future.value.toString(10),
          };
        return serializedNamedContractDeploymentFuture;

      case FutureType.ARTIFACT_CONTRACT_DEPLOYMENT:
        const serializedArtifactContractDeploymentFuture: SerializedArtifactContractDeploymentFuture =
          {
            id: future.id,
            moduleId: future.module.id,
            type: future.type,
            dependencies: Array.from(future.dependencies).map((d) =>
              this._convertFutureToFutureToken(d)
            ),
            contractName: future.contractName,
            artifact: future.artifact,
            constructorArgs: future.constructorArgs.map((arg) =>
              this._serializeArgument(arg)
            ),
            from: future.from,
            libraries: this._convertLibrariesToLibraryTokens(future.libraries),
            value: future.value.toString(10),
          };
        return serializedArtifactContractDeploymentFuture;

      case FutureType.NAMED_LIBRARY_DEPLOYMENT:
        const serializedNamedLibraryDeploymentFuture: SerializedNamedLibraryDeploymentFuture =
          {
            id: future.id,
            moduleId: future.module.id,
            type: future.type,
            dependencies: Array.from(future.dependencies).map((d) =>
              this._convertFutureToFutureToken(d)
            ),
            contractName: future.contractName,
            from: future.from,
            libraries: this._convertLibrariesToLibraryTokens(future.libraries),
          };
        return serializedNamedLibraryDeploymentFuture;

      case FutureType.ARTIFACT_LIBRARY_DEPLOYMENT:
        const serializedArtifactLibraryDeploymentFuture: SerializedArtifactLibraryDeploymentFuture =
          {
            id: future.id,
            moduleId: future.module.id,
            type: future.type,
            dependencies: Array.from(future.dependencies).map((d) =>
              this._convertFutureToFutureToken(d)
            ),
            contractName: future.contractName,
            artifact: future.artifact,
            from: future.from,
            libraries: this._convertLibrariesToLibraryTokens(future.libraries),
          };
        return serializedArtifactLibraryDeploymentFuture;

      case FutureType.NAMED_CONTRACT_CALL:
        const serializedNamedContractCallFuture: SerializedNamedContractCallFuture =
          {
            id: future.id,
            moduleId: future.module.id,
            type: future.type,
            dependencies: Array.from(future.dependencies).map((d) =>
              this._convertFutureToFutureToken(d)
            ),
            contract: this._convertFutureToFutureToken(future.contract),
            functionName: future.functionName,
            args: future.args.map((arg) => this._serializeArgument(arg)),
            value: future.value.toString(10),
            from: future.from,
          };
        return serializedNamedContractCallFuture;

      case FutureType.NAMED_STATIC_CALL:
        const serializedNamedStaticCallFuture: SerializedNamedStaticCallFuture =
          {
            id: future.id,
            moduleId: future.module.id,
            type: future.type,
            dependencies: Array.from(future.dependencies).map((d) =>
              this._convertFutureToFutureToken(d)
            ),
            contract: this._convertFutureToFutureToken(future.contract),
            functionName: future.functionName,
            args: future.args.map((arg) => this._serializeArgument(arg)),
            from: future.from,
          };
        return serializedNamedStaticCallFuture;

      case FutureType.NAMED_CONTRACT_AT:
        const serializedNamedContractAtFuture: SerializedNamedContractAtFuture =
          {
            id: future.id,
            moduleId: future.module.id,
            type: future.type,
            dependencies: Array.from(future.dependencies).map((d) =>
              this._convertFutureToFutureToken(d)
            ),
            contractName: future.contractName,
            address: isFuture(future.address)
              ? this._convertFutureToFutureToken(future.address)
              : future.address,
          };
        return serializedNamedContractAtFuture;

      case FutureType.ARTIFACT_CONTRACT_AT:
        const serializedArtifactContractAtFuture: SerializedArtifactContractAtFuture =
          {
            id: future.id,
            moduleId: future.module.id,
            type: future.type,
            dependencies: Array.from(future.dependencies).map((d) =>
              this._convertFutureToFutureToken(d)
            ),
            contractName: future.contractName,
            artifact: future.artifact,
            address: isFuture(future.address)
              ? this._convertFutureToFutureToken(future.address)
              : future.address,
          };
        return serializedArtifactContractAtFuture;

      case FutureType.READ_EVENT_ARGUMENT:
        const serializedReadEventArgumentFuture: SerializedReadEventArgumentFuture =
          {
            id: future.id,
            moduleId: future.module.id,
            type: future.type,
            dependencies: Array.from(future.dependencies).map((d) =>
              this._convertFutureToFutureToken(d)
            ),
            futureToReadFrom: this._convertFutureToFutureToken(
              future.futureToReadFrom
            ),
            emitter: this._convertFutureToFutureToken(future.emitter),
            eventName: future.eventName,
            argumentName: future.argumentName,
            eventIndex: future.eventIndex,
          };
        return serializedReadEventArgumentFuture;

      case FutureType.SEND_DATA:
        const serializedSendDataFuture: SerializedSendDataFuture = {
          id: future.id,
          moduleId: future.module.id,
          type: future.type,
          dependencies: Array.from(future.dependencies).map((d) =>
            this._convertFutureToFutureToken(d)
          ),
          to: isFuture(future.to)
            ? this._convertFutureToFutureToken(future.to)
            : future.to,
          value: future.value.toString(10),
          data: future.data,
          from: future.from,
        };
        return serializedSendDataFuture;
    }

    throw new IgnitionError(
      // @ts-ignore At compile type this should be impossible
      `Unknown future type while serializing: ${FutureType[future.type]}`
    );
  }

  private static _convertLibrariesToLibraryTokens(
    libraries: Record<string, ContractFuture<string>>
  ): SerializedLibraries {
    return Object.fromEntries(
      Object.entries(libraries).map(([key, lib]) => [
        key,
        this._convertFutureToFutureToken(lib),
      ])
    );
  }

  private static _serializeArgument(arg: ArgumentType): SerializedArgumentType {
    if (typeof arg === "bigint") {
      return this._serializeBigint(arg);
    }

    if (isFuture(arg)) {
      return this._convertFutureToFutureToken(arg);
    }

    if (Array.isArray(arg)) {
      return arg.map((a) => this._serializeArgument(a));
    }

    if (typeof arg === "object" && arg !== null) {
      return Object.fromEntries(
        Object.entries(arg).map(([k, v]) => [k, this._serializeArgument(v)])
      );
    }

    return arg;
  }

  private static _serializeBigint(n: bigint): SerializedBigInt {
    return { _kind: "bigint", value: n.toString(10) };
  }

  private static _convertFutureToFutureToken(future: Future): FutureToken {
    return {
      futureId: future.id,
      _kind: "FutureToken",
    };
  }

  private static _convertModuleToModuleToken(
    m: IgnitionModule<string, string, IgnitionModuleResult<string>>
  ): ModuleToken {
    return {
      moduleId: m.id,
      _kind: "ModuleToken",
    };
  }

  private static _getModulesAndSubmoduleFor(
    module: IgnitionModule<string, string, IgnitionModuleResult<string>>
  ): Array<IgnitionModule<string, string, IgnitionModuleResult<string>>> {
    return [module].concat(
      Array.from(module.submodules).flatMap((sm) =>
        this._getModulesAndSubmoduleFor(sm)
      )
    );
  }
}

function lookup<T>(lookupTable: Map<string, T>, key: string): T {
  const value = lookupTable.get(key);

  if (value === undefined) {
    throw new Error(`Lookahead value ${key} missing`);
  }

  return value;
}

/**
 * Deserialize a deployment that was previously serialized using StoredDeploymentSerialized.
 *
 * @beta
 */
export class StoredDeploymentDeserializer {
  public static deserialize(
    serializedDeployment: SerializedStoredDeployment
  ): StoredDeployment {
    const sortedModules =
      this._getSerializedModulesInReverseTopologicalOrder(serializedDeployment);

    const modulesLookup: Map<string, IgnitionModuleImplementation> = new Map();
    for (const serializedModule of sortedModules) {
      const mod = new IgnitionModuleImplementation(serializedModule.id, {});
      modulesLookup.set(mod.id, mod);

      for (const submoduleToken of serializedModule.submodules) {
        const submodule = lookup(modulesLookup, submoduleToken.moduleId);
        mod.submodules.add(submodule);
      }
    }

    const sortedFutures =
      this._getSerializedFuturesInReverseTopologicalOrder(serializedDeployment);

    const futuresLookup: Map<string, Future> = new Map();
    const contractFuturesLookup: Map<
      string,
      ContractFuture<string>
    > = new Map();
    const addressResolvableFutureLookup: Map<string, AddressResolvableFuture> =
      new Map();

    for (const serializedFuture of sortedFutures) {
      const future = this._deserializeFuture(
        serializedFuture,
        modulesLookup,
        futuresLookup,
        contractFuturesLookup,
        addressResolvableFutureLookup
      );

      for (const dependencyId of serializedFuture.dependencies) {
        const dependency = lookup(futuresLookup, dependencyId.futureId);
        future.dependencies.add(dependency);
      }

      future.module.futures.add(future);

      futuresLookup.set(future.id, future);

      if (isContractFuture(future)) {
        contractFuturesLookup.set(future.id, future);
      }

      if (isAddressResolvableFuture(future)) {
        addressResolvableFutureLookup.set(future.id, future);
      }
    }

    for (const serializedModule of Object.values(
      serializedDeployment.modules
    )) {
      for (const [name, futureToken] of Object.entries(
        serializedModule.results
      )) {
        const mod = lookup(modulesLookup, serializedModule.id);
        const contract = lookup(contractFuturesLookup, futureToken.futureId);
        mod.results[name] = contract;
      }
    }

    return {
      details: {
        ...serializedDeployment.details,
      },
      module: lookup(modulesLookup, serializedDeployment.startModule),
    };
  }

  private static _getSerializedModulesInReverseTopologicalOrder(
    serializedDeployment: SerializedStoredDeployment
  ): SerializedStoredModule[] {
    const graph: Graph<SerializedStoredModule> = new Map();

    for (const mod of Object.values(serializedDeployment.modules)) {
      graph.set(mod, new Set());
    }

    for (const mod of Object.values(serializedDeployment.modules)) {
      for (const submodToken of mod.submodules) {
        const submod = serializedDeployment.modules[submodToken.moduleId];
        graph.get(submod)!.add(mod);
      }
    }

    return getNodesInTopologicalOrder(graph);
  }

  private static _getSerializedFuturesInReverseTopologicalOrder(
    serializedDeployment: SerializedStoredDeployment
  ): SerializedFuture[] {
    const serializedFutures = this._getAllFuturesFor(serializedDeployment);
    const serializedFuturesMap = Object.fromEntries(
      serializedFutures.map((f) => [f.id, f])
    );

    const graph: Graph<SerializedFuture> = new Map();

    for (const serializedFuture of serializedFutures) {
      graph.set(serializedFuture, new Set());
    }

    for (const serializedFuture of serializedFutures) {
      for (const dependencyToken of serializedFuture.dependencies) {
        const dependency = serializedFuturesMap[dependencyToken.futureId];
        graph.get(dependency)!.add(serializedFuture);
      }
    }

    return getNodesInTopologicalOrder(graph);
  }

  private static _deserializeArgument(
    arg: SerializedArgumentType,
    futureLookup: Map<string, Future>
  ): ArgumentType {
    if (this._isSerializedFutureToken(arg)) {
      const swappedFuture = lookup(futureLookup, arg.futureId);

      if (swappedFuture === undefined) {
        throw new IgnitionError(
          `Unable to lookup future during deserialization: ${arg.futureId}`
        );
      }

      if (
        swappedFuture.type === FutureType.NAMED_CONTRACT_CALL ||
        swappedFuture.type === FutureType.SEND_DATA
      ) {
        throw new IgnitionError(
          `Invalid FutureType ${
            FutureType[swappedFuture.type]
          } as serialized argument`
        );
      }

      return swappedFuture;
    }

    if (this._isSerializedBigInt(arg)) {
      return this._deserializedBigint(arg);
    }

    if (Array.isArray(arg)) {
      return arg.map((a) => this._deserializeArgument(a, futureLookup));
    }

    if (typeof arg === "object" && arg !== null) {
      return Object.fromEntries(
        Object.entries(arg).map(([k, v]) => [
          k,
          this._deserializeArgument(v, futureLookup),
        ])
      );
    }

    return arg;
  }

  private static _deserializedBigint(n: SerializedBigInt): bigint {
    return BigInt(n.value);
  }

  private static _isSerializedFutureToken(
    arg: SerializedArgumentType
  ): arg is FutureToken {
    return (
      typeof arg === "object" && "_kind" in arg && arg._kind === "FutureToken"
    );
  }

  private static _isSerializedBigInt(
    arg: SerializedArgumentType
  ): arg is SerializedBigInt {
    return typeof arg === "object" && "_kind" in arg && arg._kind === "bigint";
  }

  private static _getAllFuturesFor(
    deployment: SerializedStoredDeployment
  ): SerializedFuture[] {
    return Object.values(deployment.modules).flatMap((m) =>
      Object.values(m.futures)
    );
  }

  private static _deserializeFuture(
    serializedFuture: SerializedFuture,
    modulesLookup: Map<
      string,
      IgnitionModuleImplementation<string, string, IgnitionModuleResult<string>>
    >,
    futuresLookup: Map<string, Future>,
    contractFuturesLookup: Map<string, ContractFuture<string>>,
    addressResolvableFutureLookup: Map<string, AddressResolvableFuture>
  ): Future {
    const mod = lookup(modulesLookup, serializedFuture.moduleId);

    switch (serializedFuture.type) {
      case FutureType.NAMED_CONTRACT_DEPLOYMENT:
        return new NamedContractDeploymentFutureImplementation(
          serializedFuture.id,
          mod,
          serializedFuture.contractName,
          serializedFuture.constructorArgs.map((arg) =>
            this._deserializeArgument(arg, futuresLookup)
          ),
          Object.fromEntries(
            Object.entries(serializedFuture.libraries).map(([name, lib]) => [
              name,
              lookup(contractFuturesLookup, lib.futureId),
            ])
          ),
          BigInt(serializedFuture.value),
          serializedFuture.from
        );
      case FutureType.ARTIFACT_CONTRACT_DEPLOYMENT:
        return new ArtifactContractDeploymentFutureImplementation(
          serializedFuture.id,
          mod,
          serializedFuture.contractName,
          serializedFuture.constructorArgs.map((arg) =>
            this._deserializeArgument(arg, futuresLookup)
          ),
          serializedFuture.artifact,
          Object.fromEntries(
            Object.entries(serializedFuture.libraries).map(([name, lib]) => [
              name,
              lookup(contractFuturesLookup, lib.futureId),
            ])
          ),
          BigInt(serializedFuture.value),
          serializedFuture.from
        );
      case FutureType.NAMED_LIBRARY_DEPLOYMENT:
        return new NamedLibraryDeploymentFutureImplementation(
          serializedFuture.id,
          mod,
          serializedFuture.contractName,
          Object.fromEntries(
            Object.entries(serializedFuture.libraries).map(([name, lib]) => [
              name,
              lookup(contractFuturesLookup, lib.futureId),
            ])
          ),
          serializedFuture.from
        );
      case FutureType.ARTIFACT_LIBRARY_DEPLOYMENT:
        return new ArtifactLibraryDeploymentFutureImplementation(
          serializedFuture.id,
          mod,
          serializedFuture.contractName,
          serializedFuture.artifact,
          Object.fromEntries(
            Object.entries(serializedFuture.libraries).map(([name, lib]) => [
              name,
              lookup(contractFuturesLookup, lib.futureId),
            ])
          ),
          serializedFuture.from
        );
      case FutureType.NAMED_CONTRACT_CALL:
        return new NamedContractCallFutureImplementation(
          serializedFuture.id,
          mod,
          serializedFuture.functionName,
          lookup(contractFuturesLookup, serializedFuture.contract.futureId),
          serializedFuture.args.map((arg) =>
            this._deserializeArgument(arg, futuresLookup)
          ),
          BigInt(serializedFuture.value),
          serializedFuture.from
        );
      case FutureType.NAMED_STATIC_CALL:
        return new NamedStaticCallFutureImplementation(
          serializedFuture.id,
          mod,
          serializedFuture.functionName,
          lookup(contractFuturesLookup, serializedFuture.contract.futureId),
          serializedFuture.args.map((arg) =>
            this._deserializeArgument(arg, futuresLookup)
          ),
          serializedFuture.from
        );
      case FutureType.NAMED_CONTRACT_AT:
        return new NamedContractAtFutureImplementation(
          serializedFuture.id,
          mod,
          serializedFuture.contractName,
          this._isSerializedFutureToken(serializedFuture.address)
            ? lookup(
                addressResolvableFutureLookup,
                serializedFuture.address.futureId
              )
            : serializedFuture.address
        );
      case FutureType.ARTIFACT_CONTRACT_AT:
        return new ArtifactContractAtFutureImplementation(
          serializedFuture.id,
          mod,
          serializedFuture.contractName,
          this._isSerializedFutureToken(serializedFuture.address)
            ? lookup(
                addressResolvableFutureLookup,
                serializedFuture.address.futureId
              )
            : serializedFuture.address,
          serializedFuture.artifact
        );
      case FutureType.READ_EVENT_ARGUMENT:
        return new ReadEventArgumentFutureImplementation(
          serializedFuture.id,
          mod,
          lookup(futuresLookup, serializedFuture.futureToReadFrom.futureId),
          serializedFuture.eventName,
          serializedFuture.argumentName,
          lookup(contractFuturesLookup, serializedFuture.emitter.futureId),
          serializedFuture.eventIndex
        );
      case FutureType.SEND_DATA:
        return new SendDataFutureImplementation(
          serializedFuture.id,
          mod,
          this._isSerializedFutureToken(serializedFuture.to)
            ? lookup(
                addressResolvableFutureLookup,
                serializedFuture.to.futureId
              )
            : serializedFuture.to,
          BigInt(serializedFuture.value),
          serializedFuture.data,
          serializedFuture.from
        );
    }
  }
}
