export type HighScoreSubmissionReason = 'submitted' | 'timeout'

export type HighScoreSubmissionRecord = {
  runId: string
  score: number
  initials: string
  submittedAtMs: number
  submittedAtIso: string
  reason: HighScoreSubmissionReason
}

export type HighScoreSubmissionResult = {
  accepted: true
  provisionalRank: number | null
}

const MAX_STORED_SUBMISSIONS = 256
const submissions: HighScoreSubmissionRecord[] = []

function compareRecords(a: HighScoreSubmissionRecord, b: HighScoreSubmissionRecord): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.submittedAtMs !== b.submittedAtMs) return a.submittedAtMs - b.submittedAtMs
  return a.runId.localeCompare(b.runId)
}

export async function submitHighScorePlaceholder(
  record: HighScoreSubmissionRecord,
): Promise<HighScoreSubmissionResult> {
  submissions.push(record)
  submissions.sort(compareRecords)

  if (submissions.length > MAX_STORED_SUBMISSIONS) {
    submissions.length = MAX_STORED_SUBMISSIONS
  }

  const provisionalRank = submissions.findIndex((entry) => (
    entry.runId === record.runId
    && entry.submittedAtMs === record.submittedAtMs
    && entry.initials === record.initials
  ))

  // TODO(db): Replace this in-memory placeholder with an actual database write.
  // TODO(scoreboard-rank): Emit rank placement event once DB/leaderboard integration is finalized.

  return {
    accepted: true,
    provisionalRank: provisionalRank >= 0 ? provisionalRank + 1 : null,
  }
}

export function getHighScoreSubmissionSnapshot(): readonly HighScoreSubmissionRecord[] {
  return submissions
}
