import setupDebug from "debug";

// import { DeploymentResult, IgnitionRecipesResults } from "./execution-engine";
import { SerializedDeploymentResult } from "./futures/types";
import { serializeFutureOutput } from "./futures/utils";
import { InMemoryJournal } from "./journal/InMemoryJournal";
import { Providers } from "./providers";
import { Services } from "./services/types";
import { execute } from "./single-graph/execution/execute";
import { generateRecipeGraphFrom } from "./single-graph/process/generateRecipeGraphFrom";
import { transformRecipeGraphToExecutionGraph } from "./single-graph/process/transformRecipeGraphToExecutionGraph";
import { createServices } from "./single-graph/services/createServices";
import { DependableFuture, FutureDict } from "./single-graph/types/future";
import { Recipe } from "./single-graph/types/recipeGraph";
import { UiService } from "./single-graph/ui/ui-service";
import { isDependable } from "./single-graph/utils/guards";
import { validateRecipeGraph } from "./single-graph/validation/validateRecipeGraph";
import { DeploymentResult, IgnitionRecipesResults } from "./types";

const log = setupDebug("ignition:main");

export interface IgnitionDeployOptions {
  pathToJournal: string | undefined;
  txPollingInterval: number;
  ui: boolean;
}

type RecipesOutputs = Record<string, any>;

export class Ignition {
  constructor(
    private _providers: Providers,
    private _recipesResults: IgnitionRecipesResults
  ) {}

  public async deploySingleGraph(
    recipe: Recipe,
    options: IgnitionDeployOptions = {
      ui: true,
      pathToJournal: undefined,
      txPollingInterval: 300,
    }
  ): Promise<[DeploymentResult, RecipesOutputs]> {
    log(`Start deploy`);

    const ui = new UiService({ enabled: options.ui });

    const serviceOptions = {
      providers: this._providers,
      journal: new InMemoryJournal(),
      txPollingInterval: 300,
    };

    const services: Services = createServices(
      "recipeIdEXECUTE",
      "executorIdEXECUTE",
      serviceOptions
    );

    const chainId = await this._getChainId();

    const { graph: recipeGraph, recipeOutputs } = generateRecipeGraphFrom(
      recipe,
      { chainId }
    );

    const validationResult = await validateRecipeGraph(recipeGraph, services);

    if (validationResult._kind === "failure") {
      return [validationResult, {}];
    }

    const transformResult = await transformRecipeGraphToExecutionGraph(
      recipeGraph,
      serviceOptions
    );

    if (transformResult._kind === "failure") {
      return [transformResult, {}];
    }

    const { executionGraph } = transformResult;

    const executionResult = await execute(executionGraph, services, ui);

    if (executionResult._kind === "failure") {
      return [executionResult, {}];
    }

    const serializedDeploymentResult = this._serialize(
      recipeOutputs,
      executionResult.result
    );

    return [{ _kind: "success", result: serializedDeploymentResult }, {}];
  }

  public async planSingleGraph(recipe: Recipe) {
    log(`Start plan`);

    const serviceOptions = {
      providers: this._providers,
      journal: new InMemoryJournal(),
      txPollingInterval: 300,
    };

    const services: Services = createServices(
      "recipeIdEXECUTE",
      "executorIdEXECUTE",
      serviceOptions
    );

    const chainId = await this._getChainId();

    const { graph: recipeGraph } = generateRecipeGraphFrom(recipe, { chainId });

    const validationResult = await validateRecipeGraph(recipeGraph, services);

    if (validationResult._kind === "failure") {
      return [validationResult, {}];
    }

    const transformResult = await transformRecipeGraphToExecutionGraph(
      recipeGraph,
      serviceOptions
    );

    if (transformResult._kind === "failure") {
      return [transformResult, {}];
    }

    const { executionGraph } = transformResult;

    return { recipeGraph, executionGraph };
  }

  private async _getChainId(): Promise<number> {
    const result = await this._providers.ethereumProvider.request({
      method: "eth_chainId",
    });

    return Number(result);
  }

  private _serialize(
    recipeOutputs: FutureDict,
    result: Map<number, any>
  ): SerializedDeploymentResult {
    const entries = Object.entries(recipeOutputs).filter(
      (entry): entry is [string, DependableFuture] => isDependable(entry[1])
    );

    const convertedEntries = entries.map(([name, future]) => {
      const executionResultValue = result.get(future.vertexId);

      return [name, serializeFutureOutput(executionResultValue)];
    });

    return Object.fromEntries(convertedEntries);
  }
}
