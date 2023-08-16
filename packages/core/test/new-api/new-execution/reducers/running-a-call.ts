import { assert } from "chai";

import { DeploymentState } from "../../../../src/new-api/internal/new-execution/types/deployment-state";
import { EvmExecutionResultTypes } from "../../../../src/new-api/internal/new-execution/types/evm-execution";
import { ExecutionResultType } from "../../../../src/new-api/internal/new-execution/types/execution-result";
import {
  CallExecutionState,
  ExecutionSateType,
  ExecutionStatus,
} from "../../../../src/new-api/internal/new-execution/types/execution-state";
import { TransactionReceiptStatus } from "../../../../src/new-api/internal/new-execution/types/jsonrpc";
import {
  CallExecutionStateCompleteMessage,
  CallExecutionStateInitializeMessage,
  JournalMessageType,
  NetworkInteractionRequestMessage,
  TransactionConfirmMessage,
  TransactionSendMessage,
} from "../../../../src/new-api/internal/new-execution/types/messages";
import { NetworkInteractionType } from "../../../../src/new-api/internal/new-execution/types/network-interaction";
import { findOnchainInteractionBy } from "../../../../src/new-api/internal/new-execution/views/deployment-execution-state/find-onchain-interaction-by";
import { findTransactionBy } from "../../../../src/new-api/internal/new-execution/views/deployment-execution-state/find-transaction-by";
import { findCallExecutionStateBy } from "../../../../src/new-api/internal/new-execution/views/find-call-execution-state-by";
import { assertIgnitionInvariant } from "../../../../src/new-api/internal/utils/assertions";
import { FutureType } from "../../../../src/new-api/types/module";

import { applyMessages } from "./utils";

describe("DeploymentStateReducer", () => {
  describe("running a named library deploy", () => {
    const exampleAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const differentAddress = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";

    let updatedDeploymentState: DeploymentState;
    let updatedStaticCallExState: CallExecutionState;

    const initializeCallExecutionStateMessage: CallExecutionStateInitializeMessage =
      {
        type: JournalMessageType.CALL_EXECUTION_STATE_INITIALIZE,
        futureId: "Call1",
        futureType: FutureType.NAMED_CONTRACT_CALL,
        strategy: "basic",
        dependencies: [],
        artifactFutureId: "Contract1",
        contractAddress: exampleAddress,
        functionName: "configure",
        args: ["a", BigInt(2)],
        value: BigInt(0),
        from: undefined,
      };

    const requestNetworkInteractionMessage: NetworkInteractionRequestMessage = {
      type: JournalMessageType.NETWORK_INTERACTION_REQUEST,
      futureId: "Call1",
      networkInteraction: {
        id: 1,
        type: NetworkInteractionType.ONCHAIN_INTERACTION,
        to: undefined,
        data: "fake-data",
        value: BigInt(0),
        from: differentAddress,
      },
    };

    const requestStaticCallInteractionMessage: NetworkInteractionRequestMessage =
      {
        type: JournalMessageType.NETWORK_INTERACTION_REQUEST,
        futureId: "Call1",
        networkInteraction: {
          id: 1,
          type: NetworkInteractionType.STATIC_CALL,
          to: undefined,
          data: "fake-data",
          value: BigInt(0),
          from: differentAddress,
        },
      };

    const sendTransactionMessage: TransactionSendMessage = {
      type: JournalMessageType.TRANSACTION_SEND,
      futureId: "Call1",
      networkInteractionId: 1,
      transaction: {
        hash: "0xdeadbeef",
        fees: {
          maxFeePerGas: BigInt(10),
          maxPriorityFeePerGas: BigInt(5),
        },
      },
    };

    const sendAnotherTransactionMessage: TransactionSendMessage = {
      type: JournalMessageType.TRANSACTION_SEND,
      futureId: "Call1",
      networkInteractionId: 1,
      transaction: {
        hash: "0xanother",
        fees: {
          maxFeePerGas: BigInt(25),
          maxPriorityFeePerGas: BigInt(15),
        },
      },
    };

    const confirmTransactionMessage: TransactionConfirmMessage = {
      type: JournalMessageType.TRANSACTION_CONFIRM,
      futureId: "Call1",
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

    const callSuccessMessage: CallExecutionStateCompleteMessage = {
      type: JournalMessageType.CALL_EXECUTION_STATE_COMPLETE,
      futureId: "Call1",
      result: {
        type: ExecutionResultType.SUCCESS,
      },
    };

    const callFailsWithRevertMessage: CallExecutionStateCompleteMessage = {
      type: JournalMessageType.CALL_EXECUTION_STATE_COMPLETE,
      futureId: "Call1",
      result: {
        type: ExecutionResultType.REVERTED_TRANSACTION,
      },
    };

    const callFailsOnStaticCall: CallExecutionStateCompleteMessage = {
      type: JournalMessageType.CALL_EXECUTION_STATE_COMPLETE,
      futureId: "Call1",
      result: {
        type: ExecutionResultType.STATIC_CALL_ERROR,
        error: {
          type: EvmExecutionResultTypes.REVERT_WITH_REASON,
          message: "Not a valid parameter value",
        },
      },
    };

    const callFailsOnStrategyError: CallExecutionStateCompleteMessage = {
      type: JournalMessageType.CALL_EXECUTION_STATE_COMPLETE,
      futureId: "Call1",
      result: {
        type: ExecutionResultType.STRATEGY_ERROR,
        error: `Transaction 0xdeadbeaf confirmed but it didn't create a contract`,
      },
    };

    const callFailOnSimulationError: CallExecutionStateCompleteMessage = {
      type: JournalMessageType.CALL_EXECUTION_STATE_COMPLETE,
      futureId: "Call1",
      result: {
        type: ExecutionResultType.SIMULATION_ERROR,
        error: {
          type: EvmExecutionResultTypes.REVERT_WITH_REASON,
          message: "Not a valid parameter value",
        },
      },
    };

    describe("initialization", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeCallExecutionStateMessage,
        ]);

        updatedStaticCallExState = findCallExecutionStateBy(
          updatedDeploymentState,
          "Call1"
        );
      });

      it("should populate a call execution state for the future", () => {
        assert.equal(
          updatedStaticCallExState.type,
          ExecutionSateType.CALL_EXECUTION_STATE
        );
      });
    });

    describe("strategy requesting an onchain interaction", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeCallExecutionStateMessage,
          requestNetworkInteractionMessage,
        ]);

        updatedStaticCallExState = findCallExecutionStateBy(
          updatedDeploymentState,
          "Call1"
        );
      });

      it("should populate a new onchain interaction", () => {
        assert.equal(updatedStaticCallExState.networkInteractions.length, 1);

        const networkInteraction =
          updatedStaticCallExState.networkInteractions[0];

        assertIgnitionInvariant(
          networkInteraction.type ===
            NetworkInteractionType.ONCHAIN_INTERACTION,
          "Added Network interaction is of the wrong type "
        );

        const { transactions, ...rest } = networkInteraction;

        assert.deepStrictEqual(
          rest,
          requestNetworkInteractionMessage.networkInteraction
        );
        assert.isDefined(transactions);
      });
    });

    describe("execution engine sends transaction", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeCallExecutionStateMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
        ]);

        updatedStaticCallExState = findCallExecutionStateBy(
          updatedDeploymentState,
          "Call1"
        );
      });

      it("should populate the transaction against the network interaction", () => {
        const networkInteraction = findOnchainInteractionBy(
          updatedStaticCallExState,
          1
        );

        assert.equal(networkInteraction.transactions.length, 1);

        const transaction = findTransactionBy(
          updatedStaticCallExState,
          1,
          "0xdeadbeef"
        );

        assert.deepStrictEqual(sendTransactionMessage.transaction, transaction);
      });
    });

    describe("transaction confirms successfully", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeCallExecutionStateMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          sendAnotherTransactionMessage,
          confirmTransactionMessage,
        ]);

        updatedStaticCallExState = findCallExecutionStateBy(
          updatedDeploymentState,
          "Call1"
        );
      });

      it("should set the receipt against the successful transaction", () => {
        const transaction = findTransactionBy(
          updatedStaticCallExState,
          1,
          "0xdeadbeef"
        );

        assert.deepStrictEqual(
          transaction.receipt,
          confirmTransactionMessage.receipt
        );
      });

      it("should clear all other transactions for the network interaction", () => {
        const networkInteraction = findOnchainInteractionBy(
          updatedStaticCallExState,
          1
        );

        assert.equal(networkInteraction.transactions.length, 1);
      });
    });

    describe("strategy indicates call completes successfully", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeCallExecutionStateMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          sendAnotherTransactionMessage,
          confirmTransactionMessage,
          callSuccessMessage,
        ]);

        updatedStaticCallExState = findCallExecutionStateBy(
          updatedDeploymentState,
          "Call1"
        );
      });

      it("should set the result against the execution state", () => {
        assert.deepStrictEqual(updatedStaticCallExState.result, {
          type: ExecutionResultType.SUCCESS,
        });
      });

      it("should update the status to success", () => {
        assert.deepStrictEqual(
          updatedStaticCallExState.status,
          ExecutionStatus.SUCCESS
        );
      });
    });

    describe("call errors on a revert", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeCallExecutionStateMessage,
          requestNetworkInteractionMessage,
          sendTransactionMessage,
          callFailsWithRevertMessage,
        ]);

        updatedStaticCallExState = findCallExecutionStateBy(
          updatedDeploymentState,
          "Call1"
        );
      });

      it("should set the result as a revert", () => {
        assert.deepStrictEqual(updatedStaticCallExState.result, {
          type: ExecutionResultType.REVERTED_TRANSACTION,
        });
      });

      it("should update the status to failed", () => {
        assert.equal(updatedStaticCallExState.status, ExecutionStatus.FAILED);
      });
    });

    describe("call errors after a failed static call", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeCallExecutionStateMessage,
          requestStaticCallInteractionMessage,
          callFailsOnStaticCall,
        ]);

        updatedStaticCallExState = findCallExecutionStateBy(
          updatedDeploymentState,
          "Call1"
        );
      });

      it("should set the result as a static call error", () => {
        assert.deepStrictEqual(updatedStaticCallExState.result, {
          type: ExecutionResultType.STATIC_CALL_ERROR,
          error: {
            type: EvmExecutionResultTypes.REVERT_WITH_REASON,
            message: "Not a valid parameter value",
          },
        });
      });

      it("should update the status to failed", () => {
        assert.equal(updatedStaticCallExState.status, ExecutionStatus.FAILED);
      });
    });

    describe("call errors after a strategy error", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeCallExecutionStateMessage,
          callFailsOnStrategyError,
        ]);

        updatedStaticCallExState = findCallExecutionStateBy(
          updatedDeploymentState,
          "Call1"
        );
      });

      it("should set the result as a strategy error", () => {
        assert.deepStrictEqual(updatedStaticCallExState.result, {
          type: ExecutionResultType.STRATEGY_ERROR,
          error:
            "Transaction 0xdeadbeaf confirmed but it didn't create a contract",
        });
      });

      it("should update the status to failed", () => {
        assert.equal(updatedStaticCallExState.status, ExecutionStatus.FAILED);
      });
    });

    describe("call errors after a simulation error", () => {
      beforeEach(() => {
        updatedDeploymentState = applyMessages([
          initializeCallExecutionStateMessage,
          requestNetworkInteractionMessage,
          callFailOnSimulationError,
        ]);

        updatedStaticCallExState = findCallExecutionStateBy(
          updatedDeploymentState,
          "Call1"
        );
      });

      it("should set the result as a simulation error", () => {
        assert.deepStrictEqual(updatedStaticCallExState.result, {
          type: ExecutionResultType.SIMULATION_ERROR,
          error: {
            type: EvmExecutionResultTypes.REVERT_WITH_REASON,
            message: "Not a valid parameter value",
          },
        });
      });

      it("should update the status to failed", () => {
        assert.equal(updatedStaticCallExState.status, ExecutionStatus.FAILED);
      });
    });
  });
});