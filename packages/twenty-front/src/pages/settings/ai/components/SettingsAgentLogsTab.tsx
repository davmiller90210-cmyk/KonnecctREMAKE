import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { CREATE_MANUAL_AGENT_TURN_EVALUATION } from '@/ai/graphql/mutations/createManualAgentTurnEvaluation';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { IconChevronRight, Status } from 'twenty-ui/display';
import { Button, LightIconButton } from 'twenty-ui/input';
import {
  AnimatedPlaceholder,
  AnimatedPlaceholderEmptyContainer,
  AnimatedPlaceholderEmptySubTitle,
  AnimatedPlaceholderEmptyTextContainer,
  AnimatedPlaceholderEmptyTitle,
} from 'twenty-ui/layout';
import { UndecoratedLink } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  EvaluateAgentTurnDocument,
  GetAgentTurnsDocument,
} from '~/generated-metadata/graphql';

const StyledTableContainer = styled.div`
  margin-top: ${themeCssVariables.spacing[3]};
`;

const StyledTableHeaderRowContainer = styled.div`
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledGuardrailCard = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledGuardrailMetric = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledGuardrailLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledGuardrailValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

type SettingsAgentLogsTabProps = {
  agentId: string;
};

export const SettingsAgentLogsTab = ({
  agentId,
}: SettingsAgentLogsTabProps) => {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [evaluatingTurnIds, setEvaluatingTurnIds] = useState<Set<string>>(
    new Set(),
  );

  const getLatestEvaluation = (evaluations: any[]) => {
    if (evaluations.length === 0) return null;
    return [...evaluations].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  };

  const computeBackgroundEvaluatingTurnIds = (turnsData: any[]) => {
    const now = Date.now();
    const RECENT_TURN_THRESHOLD = 5 * 60 * 1000;
    const backgroundEvaluatingTurnIds = new Set<string>();

    turnsData.forEach((turn: any) => {
      const latestEvaluation = getLatestEvaluation(turn.evaluations);
      const turnAge = now - new Date(turn.createdAt).getTime();

      if (!isDefined(latestEvaluation) && turnAge < RECENT_TURN_THRESHOLD) {
        backgroundEvaluatingTurnIds.add(turn.id);
      }
    });

    return backgroundEvaluatingTurnIds;
  };

  const { data, loading, refetch, startPolling, stopPolling } = useQuery(
    GetAgentTurnsDocument,
    {
      variables: { agentId },
      skip: !agentId,
    },
  );

  useEffect(() => {
    if (data) {
      const backgroundIds = computeBackgroundEvaluatingTurnIds(
        data?.agentTurns ?? [],
      );
      if (backgroundIds.size > 0) {
        startPolling(3000);
      } else {
        stopPolling();
      }
    }
  }, [data, startPolling, stopPolling]);

  const turns = data?.agentTurns || [];
  const backgroundEvaluatingTurnIds = computeBackgroundEvaluatingTurnIds(turns);
  const evaluatedTurnsCount = turns.filter(
    (turn: any) => turn.evaluations.length > 0,
  ).length;
  const pendingReviewCount = turns.length - evaluatedTurnsCount;
  const averageScore =
    turns
      .map((turn: any) => getLatestEvaluation(turn.evaluations)?.score)
      .filter(isDefined)
      .reduce((total, score) => total + score, 0) /
      Math.max(evaluatedTurnsCount, 1);

  const [evaluateTurn, { loading: evaluating }] = useMutation(
    EvaluateAgentTurnDocument,
    {
      onCompleted: (data) => {
        const turnId = data?.evaluateAgentTurn?.turnId;
        if (isDefined(turnId)) {
          setEvaluatingTurnIds((prev) => {
            const next = new Set(prev);
            next.delete(turnId);
            return next;
          });
        }
        enqueueSuccessSnackBar({
          message: t`Turn evaluated successfully`,
        });
        refetch();
      },
    },
  );
  const [createManualEvaluation, { loading: isCreatingManualEvaluation }] =
    useMutation(CREATE_MANUAL_AGENT_TURN_EVALUATION);

  const handleEvaluateTurn = (turnId: string) => {
    setEvaluatingTurnIds((prev) => new Set(prev).add(turnId));
    evaluateTurn({ variables: { turnId } }).catch(() => {
      setEvaluatingTurnIds((prev) => {
        const next = new Set(prev);
        next.delete(turnId);
        return next;
      });
      enqueueErrorSnackBar({
        message: t`Failed to evaluate turn`,
      });
    });
  };

  const handleApproveTurn = (turnId: string) => {
    createManualEvaluation({
      variables: {
        turnId,
        score: 100,
        comment: '[approval] approved for autonomous execution',
      },
    })
      .then(() => {
        enqueueSuccessSnackBar({
          message: t`Turn approved for autonomous use`,
        });
        refetch();
      })
      .catch(() => {
        enqueueErrorSnackBar({
          message: t`Failed to save approval decision`,
        });
      });
  };

  const handleRequestChangesForTurn = (turnId: string) => {
    createManualEvaluation({
      variables: {
        turnId,
        score: 20,
        comment: '[approval] changes requested before autonomous execution',
      },
    })
      .then(() => {
        enqueueErrorSnackBar({
          message: t`Changes requested before autonomous execution`,
        });
        refetch();
      })
      .catch(() => {
        enqueueErrorSnackBar({
          message: t`Failed to save approval decision`,
        });
      });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'orange';
    return 'red';
  };

  const getUserMessageInput = (messages: any[]) => {
    const userMessage = messages?.find((message) => message.role === 'user');
    if (!userMessage) return null;

    const textParts = userMessage.parts
      ?.filter((part: any) => part.type === 'text' && part.textContent)
      .map((part: any) => part.textContent);

    return textParts?.join(' ') || null;
  };

  if (loading) {
    return (
      <StyledTableContainer>
        <Table>
          <StyledTableHeaderRowContainer>
            <TableRow gridTemplateColumns="140px 80px 1fr 40px">
              <TableHeader>{t`Date`}</TableHeader>
              <TableHeader>{t`Score`}</TableHeader>
              <TableHeader>{t`Input`}</TableHeader>
              <TableHeader />
            </TableRow>
          </StyledTableHeaderRowContainer>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton height={48} borderRadius={4} key={index} />
          ))}
        </Table>
      </StyledTableContainer>
    );
  }

  if (turns.length === 0) {
    return (
      <AnimatedPlaceholderEmptyContainer>
        <AnimatedPlaceholder type="emptyTimeline" />
        <AnimatedPlaceholderEmptyTextContainer>
          <AnimatedPlaceholderEmptyTitle>
            {t`No logs yet`}
          </AnimatedPlaceholderEmptyTitle>
          <AnimatedPlaceholderEmptySubTitle>
            {t`Agent interactions will appear here once the agent is used in conversations`}
          </AnimatedPlaceholderEmptySubTitle>
        </AnimatedPlaceholderEmptyTextContainer>
      </AnimatedPlaceholderEmptyContainer>
    );
  }

  return (
    <StyledTableContainer>
      <StyledGuardrailCard>
        <StyledGuardrailMetric>
          <StyledGuardrailLabel>{t`Total turns`}</StyledGuardrailLabel>
          <StyledGuardrailValue>{turns.length}</StyledGuardrailValue>
        </StyledGuardrailMetric>
        <StyledGuardrailMetric>
          <StyledGuardrailLabel>{t`Reviewed`}</StyledGuardrailLabel>
          <StyledGuardrailValue>{evaluatedTurnsCount}</StyledGuardrailValue>
        </StyledGuardrailMetric>
        <StyledGuardrailMetric>
          <StyledGuardrailLabel>{t`Pending review`}</StyledGuardrailLabel>
          <StyledGuardrailValue>{pendingReviewCount}</StyledGuardrailValue>
        </StyledGuardrailMetric>
        <StyledGuardrailMetric>
          <StyledGuardrailLabel>{t`Avg score`}</StyledGuardrailLabel>
          <StyledGuardrailValue>
            {Number.isFinite(averageScore) ? averageScore.toFixed(0) : '-'}
          </StyledGuardrailValue>
        </StyledGuardrailMetric>
      </StyledGuardrailCard>
      <Table>
        <StyledTableHeaderRowContainer>
          <TableRow gridTemplateColumns="140px 80px 1fr 40px">
            <TableHeader>{t`Date`}</TableHeader>
            <TableHeader>{t`Score`}</TableHeader>
            <TableHeader>{t`Input`}</TableHeader>
            <TableHeader />
          </TableRow>
        </StyledTableHeaderRowContainer>
        {turns.map((turn: any) => {
          const latestEvaluation = getLatestEvaluation(turn.evaluations);
          const userInput = getUserMessageInput(turn.messages);
          const latestEvaluationComment = latestEvaluation?.comment ?? '';
          const isApproved =
            latestEvaluationComment.startsWith('[approval] approved');
          const needsChanges = latestEvaluationComment.startsWith(
            '[approval] changes requested',
          );

          return (
            <TableRow key={turn.id} gridTemplateColumns="140px 80px 1fr 40px">
              <TableCell color={themeCssVariables.font.color.tertiary}>
                {new Date(turn.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </TableCell>
              <TableCell gap={themeCssVariables.spacing[2]}>
                {latestEvaluation ? (
                  <>
                    <Status
                      color={getScoreColor(latestEvaluation.score)}
                      text={`${latestEvaluation.score}`}
                    />
                    {latestEvaluation.score < 70 && (
                      <>
                        {needsChanges && (
                          <Status color="orange" text={t`Needs changes`} />
                        )}
                        {isApproved && <Status color="green" text={t`Approved`} />}
                        {!isApproved && !needsChanges && (
                          <>
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => handleApproveTurn(turn.id)}
                              title={t`Approve`}
                              disabled={isCreatingManualEvaluation}
                            />
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() =>
                                handleRequestChangesForTurn(turn.id)
                              }
                              title={t`Request changes`}
                              disabled={isCreatingManualEvaluation}
                            />
                          </>
                        )}
                      </>
                    )}
                  </>
                ) : evaluatingTurnIds.has(turn.id) ||
                  backgroundEvaluatingTurnIds.has(turn.id) ? (
                  <Status color="blue" text={t`Evaluating`} isLoaderVisible />
                ) : (
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => handleEvaluateTurn(turn.id)}
                    disabled={evaluating}
                    title={t`Evaluate`}
                  />
                )}
              </TableCell>
              <TableCell
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {userInput || t`No input`}
              </TableCell>
              <TableCell
                align="right"
                padding={`0 ${themeCssVariables.spacing[2]} 0 0`}
              >
                {latestEvaluation && (
                  <UndecoratedLink
                    to={getSettingsPath(SettingsPath.AIAgentTurnDetail)
                      .replace(':agentId', agentId)
                      .replace(':turnId', turn.id)}
                  >
                    <LightIconButton
                      Icon={IconChevronRight}
                      title={t`View all evaluations`}
                      accent="tertiary"
                    />
                  </UndecoratedLink>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </Table>
    </StyledTableContainer>
  );
};
