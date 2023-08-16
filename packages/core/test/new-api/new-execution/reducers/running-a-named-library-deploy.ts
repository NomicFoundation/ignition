import { assert } from "chai";

import { NetworkInteractionType } from "../../../../src/new-api/internal/execution/transaction-types";
import { DeploymentState } from "../../../../src/new-api/internal/new-execution/types/deployment-state";
import { ExecutionResultType } from "../../../../src/new-api/internal/new-execution/types/execution-result";
import {
  DeploymentExecutionState,
  ExecutionSateType,
  ExecutionStatus,
} from "../../../../src/new-api/internal/new-execution/types/execution-state";
import { TransactionReceiptStatus } from "../../../../src/new-api/internal/new-execution/types/jsonrpc";
import {
  DeploymentExecutionStateCompleteMessage,
  DeploymentExecutionStateInitializeMessage,
  JournalMessageType,
  NetworkInteractionRequestMessage,
  TransactionConfirmMessage,
  TransactionSendMessage,
} from "../../../../src/new-api/internal/new-execution/types/messages";
import { findDeploymentExecutionStateBy } from "../../../../src/new-api/internal/new-execution/views/find-deployment-execution-state-by";
import { FutureType } from "../../../../src/new-api/types/module";

import { applyMessages } from "./utils";

describe("DeploymentStateReducer", () => {
  describe("running a named library deploy", () => {
    const exampleAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

    let updatedDeploymentState: DeploymentState;
    let updatedDepExState: DeploymentExecutionState;

    const initializeNamedLibraryDeployMessage: DeploymentExecutionStateInitializeMessage =
      {
        type: JournalMessageType.DEPLOYMENT_EXECUTION_STATE_INITIALIZE,
        futureId: "future1",
        futureType: FutureType.NAMED_LIBRARY_DEPLOYMENT,
        strategy: "basic",
        dependencies: [],
        artifactFutureId: "future1",
        contractName: "MyLibrary",
        constructorArgs: [],
        libraries: {},
        value: BigInt(0),
        from: undefined,
      };

    const requestNetworkInteractionMessage: NetworkInteractionRequestMessage = {
      type: JournalMessageType.NETWORK_INTERACTION_REQUEST,
      futureId: "future1",
      networkInteraction: {
        id: 1,
        type: NetworkInteractionType.ONCHAIN_INTERACTION,
        to: undefined,
        data: "fake-data",
        value: BigInt(0),
        from: "string",
      },
    };

    const sendTransactionMessage: TransactionSendMessage = {
      type: JournalMessageType.TRANSACTION_SEND,
      futureId: "future1",
      networkInteractionId: 1,
      transaction: {
        hash: "0xdeadbeef",
        fees: {
          maxFeePerGas: BigInt(10),
          maxPriorityFeePerGas: BigInt(5),
        },
      },
    };

    const confirmTransactionMessage: TransactionConfirmMessage = {
      type: JournalMessageType.TRANSACTION_CONFIRM,
      futureId: "future1",
      networkInteractionId: 1,
      hash: "0xdeadbeef",
      receipt: {
        blockHash: "0xblockhash",
        blockNumber: 0,
        contractAddress: exampleAddress,
        status: TransactionReceiptStatus.SUCCESS,
        logs: [],
      },
    };

    const deploymentSuccessMessage: DeploymentExecutionStateCompleteMessage = {
      type: JournalMessageType.DEPLOYMENT_EXECUTION_STATE_COMPLETE,
      futureId: "future1",
      result: {
        type: ExecutionResultType.SUCCESS,
        address: exampleAddress,
      },
    };

    describe("initialization", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedLibraryDeployMessage,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should populate a deployment execution state for the future", () => {
        assert.equal(
          updatedDepExState.type,
          ExecutionSateType.DEPLOYMENT_EXECUTION_STATE
        );
      });
    });

    describe("deployment completes successfully", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeNamedLibraryDeployMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          confirmTransactionMessage,
          deploymentSuccessMessage,
        ]);

        updatedDepExState = findDeploymentExecutionStateBy(
          updatedDeploymentState,
          "future1"
        );
      });

      it("should set the result against the execution state", () => {
        assert.deepStrictEqual(updatedDepExState.result, {
          type: ExecutionResultType.SUCCESS,
          address: exampleAddress,
        });
      });

      it("should update the status to success", () => {
        assert.deepStrictEqual(
          updatedDepExState.status,
          ExecutionStatus.SUCCESS
        );
      });
    });
  });
});