import { SubmissionPhase, SubmissionTracker } from '../scripts/gfg/state.js';

describe('GFG submission state', () => {
  let sequence;
  let time;
  let tracker;

  beforeEach(() => {
    sequence = 0;
    time = 1000;
    tracker = new SubmissionTracker(
      'binary-search/1',
      () => ++sequence,
      () => ++time
    );
  });

  it('moves through submitted, judging, and completed', () => {
    const started = tracker.start();
    expect(started).toEqual(
      jasmine.objectContaining({
        attemptId: 'binary-search/1:1',
        phase: SubmissionPhase.SUBMITTED,
        submittedAt: 1001,
        code: null,
        language: null,
      })
    );

    expect(tracker.markJudging().phase).toBe(SubmissionPhase.JUDGING);
    const completed = tracker.complete('wrong_answer');
    expect(completed).toEqual(
      jasmine.objectContaining({
        phase: SubmissionPhase.COMPLETED,
        verdict: 'wrong_answer',
        completedAt: 1002,
      })
    );
  });

  it('emits at most one completion for an attempt', () => {
    tracker.start();
    expect(tracker.complete('accepted').verdict).toBe('accepted');
    expect(tracker.complete('accepted')).toBeNull();
    expect(tracker.markJudging()).toBeNull();
  });

  it('allows a legitimate resubmission with a new attempt ID', () => {
    const problem = Object.freeze({
      title: 'Binary Search',
      slug: 'binary-search',
      routeKey: 'binary-search/1',
      url: 'https://www.geeksforgeeks.org/problems/binary-search/1',
      difficulty: 'easy',
      statement: 'Find the target.',
      metadataErrors: Object.freeze([]),
    });
    const first = tracker.start('button', {
      code: 'Code A',
      language: 'java',
      extension: '.java',
      capturedAt: 2000,
      problem,
    });
    tracker.complete('wrong_answer');
    const second = tracker.start('button', {
      code: 'Code B',
      language: 'cpp',
      extension: '.cpp',
      capturedAt: 3000,
      problem,
    });
    tracker.complete('accepted');

    expect(first.attemptId).toBe('binary-search/1:1');
    expect(second.attemptId).toBe('binary-search/1:2');
    expect(first.code).toBe('Code A');
    expect(second.code).toBe('Code B');
    expect(first.language).toBe('java');
    expect(second.language).toBe('cpp');
    expect(first.capturedAt).toBe(2000);
    expect(second.capturedAt).toBe(3000);
    expect(first.problem).toBe(problem);
    expect(second.problem).toBe(problem);
    expect(first.solution.code).toBe('Code A');
    expect(second.solution.code).toBe('Code B');
  });

  it('cancels a pending attempt when superseded or cleaned up', () => {
    tracker.start();
    tracker.cancel();
    expect(tracker.current.phase).toBe(SubmissionPhase.CANCELLED);
    expect(tracker.complete('accepted')).toBeNull();

    const second = tracker.start('result');
    expect(second.attemptId).toBe('binary-search/1:2');
    expect(second.source).toBe('result');
  });
});
