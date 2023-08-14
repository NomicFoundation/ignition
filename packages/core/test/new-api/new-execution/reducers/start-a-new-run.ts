import { assert } from "chai";

import { deploymentStateReducer } from "../../../../src/new-api/internal/new-execution/reducers/deployment-state-reducer";
import { DeploymentState } from "../../../../src/new-api/internal/new-execution/types/deployment-state";
import { JournalMessageType } from "../../../../src/new-api/internal/new-execution/types/messages";

describe("DeploymentStateReducer", () => {
  let initialState: DeploymentState;
  let updatedState: DeploymentState;

  describe("starting a new run", () => {
    beforeEach(() => {
      initialState = deploymentStateReducer(undefined);

      updatedState = deploymentStateReducer(initialState, {
        type: JournalMessageType.RUN_START,
        chainId: 31337,
      });
    });

    it("should set the chainId", () => {
      assert.equal(updatedState.chainId, 31337);
    });

    it("should leave the previous execution states", () => {
      assert.equal(initialState.executionStates, updatedState.executionStates);
    });
  });
});