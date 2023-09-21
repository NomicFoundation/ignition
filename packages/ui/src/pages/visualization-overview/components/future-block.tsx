import {
  Future,
  FutureType,
  isFuture,
} from "@nomicfoundation/ignition-core/ui-helpers";
import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import styled, { css } from "styled-components";
import { argumentTypeToString } from "../../../utils/argumentTypeToString";

export const FutureBlock: React.FC<{
  future: Future;
}> = ({ future }) => {
  const navigate = useNavigate();

  const displayText = toDisplayText(future);

  const navigateToFuture = useCallback(() => {
    return navigate(`/future/${encodeURIComponent(future.id)}`);
  }, [future.id, navigate]);

  return (
    <FutureBtn futureType={future.type} onClick={navigateToFuture}>
      <Text>{displayText}</Text>
    </FutureBtn>
  );
};

function toDisplayText(future: Future): string {
  switch (future.type) {
    case FutureType.NAMED_ARTIFACT_CONTRACT_DEPLOYMENT:
      return `Contract deploy ${future.id}`;
    case FutureType.CONTRACT_DEPLOYMENT:
      return `Deploy contract ${future.id} from artifact`;
    case FutureType.NAMED_ARTIFACT_LIBRARY_DEPLOYMENT:
      return `Library deploy ${future.id}`;
    case FutureType.LIBRARY_DEPLOYMENT:
      return `Library deploy ${future.id} from artifact`;
    case FutureType.CONTRACT_CALL:
      return `Call ${future.id}`;
    case FutureType.STATIC_CALL:
      return `Static call ${future.id}`;
    case FutureType.NAMED_ARTIFACT_CONTRACT_AT:
      return `Existing contract ${future.id} (${
        typeof future.address === "string"
          ? future.address
          : isFuture(future.address)
          ? future.address.id
          : argumentTypeToString(future.address)
      })`;
    case FutureType.CONTRACT_AT:
      return `Existing contract ${future.id} from artifact (${
        typeof future.address === "string"
          ? future.address
          : isFuture(future.address)
          ? future.address.id
          : argumentTypeToString(future.address)
      })`;
    case FutureType.READ_EVENT_ARGUMENT:
      return `Read event from future ${future.futureToReadFrom.id} (event ${future.eventName} argument ${future.nameOrIndex})`;
    case FutureType.SEND_DATA:
      return `Send data ${future.id} to ${
        typeof future.to === "string"
          ? future.to
          : isFuture(future.to)
          ? future.to.id
          : argumentTypeToString(future.to)
      }`;
  }
}

const Text = styled.p`
  margin: 0;
`;

const FutureBtn = styled.div<{ futureType: FutureType }>`
  border: 1px solid black;
  padding: 1rem;
  font-weight: bold;

  &:hover {
    background: blue;
    cursor: pointer;
  }

  ${(props) =>
    [
      FutureType.NAMED_ARTIFACT_CONTRACT_DEPLOYMENT,
      FutureType.CONTRACT_DEPLOYMENT,
      FutureType.NAMED_ARTIFACT_LIBRARY_DEPLOYMENT,
      FutureType.LIBRARY_DEPLOYMENT,
    ].includes(props.futureType) &&
    css`
      background: green;
      color: white;
    `}

  ${(props) =>
    [FutureType.CONTRACT_CALL, FutureType.STATIC_CALL].includes(
      props.futureType
    ) &&
    css`
      background: yellow;
      color: black;
    `}
`;