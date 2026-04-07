import { gql } from '@apollo/client';

export const CREATE_MANUAL_AGENT_TURN_EVALUATION = gql`
  mutation CreateManualAgentTurnEvaluation(
    $turnId: UUID!
    $score: Int!
    $comment: String
  ) {
    createManualAgentTurnEvaluation(
      turnId: $turnId
      score: $score
      comment: $comment
    ) {
      id
      turnId
      score
      comment
      createdAt
    }
  }
`;
