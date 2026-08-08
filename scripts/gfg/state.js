export const SubmissionPhase = Object.freeze({
  IDLE: 'idle',
  SUBMITTED: 'submitted',
  JUDGING: 'judging',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export class SubmissionTracker {
  constructor(routeKey, nextSequence, now = Date.now) {
    this.routeKey = routeKey;
    this.nextSequence = nextSequence;
    this.now = now;
    this.current = null;
  }

  start(source = 'button', snapshot = {}) {
    this.cancel();
    const sequence = this.nextSequence();
    const normalizedSnapshot = Object.freeze({ ...snapshot });
    const problem = normalizedSnapshot.problem ?? null;
    const solution = Object.freeze({
      code: normalizedSnapshot.code ?? null,
      language: normalizedSnapshot.language ?? null,
      extension: normalizedSnapshot.extension ?? null,
      editorType: normalizedSnapshot.editorType ?? null,
      captureError: normalizedSnapshot.captureError ?? null,
      capturedAt: normalizedSnapshot.capturedAt ?? null,
    });

    this.current = {
      attemptId: `${this.routeKey}:${sequence}`,
      sequence,
      routeKey: this.routeKey,
      source,
      phase: SubmissionPhase.SUBMITTED,
      verdict: null,
      snapshot: normalizedSnapshot,
      problem,
      solution,
      code: solution.code,
      language: solution.language,
      extension: solution.extension,
      editorType: solution.editorType,
      captureError: solution.captureError,
      capturedAt: solution.capturedAt,
      title: problem?.title ?? null,
      slug: problem?.slug ?? null,
      url: problem?.url ?? null,
      difficulty: problem?.difficulty ?? null,
      statement: problem?.statement ?? null,
      metadataErrors: problem?.metadataErrors ?? Object.freeze(['metadata_not_available']),
      submittedAt: this.now(),
      completedAt: null,
    };

    return { ...this.current };
  }

  markJudging() {
    if (!this.current || this.current.phase !== SubmissionPhase.SUBMITTED) {
      return null;
    }

    this.current.phase = SubmissionPhase.JUDGING;
    return { ...this.current };
  }

  complete(verdict) {
    if (
      !this.current ||
      this.current.phase === SubmissionPhase.COMPLETED ||
      this.current.phase === SubmissionPhase.CANCELLED
    ) {
      return null;
    }

    this.current.phase = SubmissionPhase.COMPLETED;
    this.current.verdict = verdict;
    this.current.completedAt = this.now();
    return { ...this.current };
  }

  cancel() {
    if (
      this.current &&
      this.current.phase !== SubmissionPhase.COMPLETED &&
      this.current.phase !== SubmissionPhase.CANCELLED
    ) {
      this.current.phase = SubmissionPhase.CANCELLED;
    }
  }
}
