import { isJudgingStatus, normalizeVerdict, Verdict } from '../scripts/gfg/verdict.js';

describe('GFG verdict normalization', () => {
  it('maps GFG success text to accepted', () => {
    expect(normalizeVerdict('Problem Solved Successfully')).toBe(Verdict.ACCEPTED);
    expect(normalizeVerdict('Accepted')).toBe(Verdict.ACCEPTED);
    expect(normalizeVerdict('Correct Answer')).toBe(Verdict.ACCEPTED);
    expect(normalizeVerdict('Correct')).toBe(Verdict.ACCEPTED);
  });

  it('maps observed failure verdicts', () => {
    expect(normalizeVerdict('Wrong Answer')).toBe(Verdict.WRONG_ANSWER);
    expect(normalizeVerdict('Compilation Error')).toBe(Verdict.COMPILATION_ERROR);
    expect(normalizeVerdict('Runtime Error')).toBe(Verdict.RUNTIME_ERROR);
    expect(normalizeVerdict('Time Limit Exceeded')).toBe(Verdict.TIME_LIMIT_EXCEEDED);
  });

  it('prefers a TLE detail over the generic Runtime Error heading', () => {
    expect(normalizeVerdict('Runtime Error\nTime Limit Exceeded on test case 18')).toBe(
      Verdict.TIME_LIMIT_EXCEEDED
    );
  });

  it('does not broadly interpret incidental accepted text as success', () => {
    expect(normalizeVerdict('0 test cases accepted')).toBeNull();
    expect(normalizeVerdict('Your answer was not accepted')).toBeNull();
    expect(normalizeVerdict('Compilation Results')).toBeNull();
  });

  it('recognizes current judging and queue states', () => {
    [
      'Queuing',
      'Request Queued',
      'Evaluating',
      'Processing Result',
      'Test Cases Processed: 8/10',
      'Compilation Processing',
    ].forEach(status => expect(isJudgingStatus(status)).toBeTrue());
    expect(isJudgingStatus('Problem Solved Successfully')).toBeFalse();
  });
});
