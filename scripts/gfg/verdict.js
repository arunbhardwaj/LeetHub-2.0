export const Verdict = Object.freeze({
  ACCEPTED: 'accepted',
  WRONG_ANSWER: 'wrong_answer',
  COMPILATION_ERROR: 'compilation_error',
  RUNTIME_ERROR: 'runtime_error',
  TIME_LIMIT_EXCEEDED: 'time_limit_exceeded',
  UNKNOWN_ERROR: 'unknown_error',
});

function normalizedLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean);
}

function hasStatusLine(lines, status) {
  return lines.some(line => line === status || line.startsWith(`${status}:`));
}

export function detectVerdict(text) {
  const lines = normalizedLines(text);

  if (
    lines.some(line => line === 'tle') ||
    hasStatusLine(lines, 'time limit exceeded') ||
    lines.some(line => line.includes('time limit exceeded'))
  ) {
    return { verdict: Verdict.TIME_LIMIT_EXCEEDED, signal: 'time limit exceeded' };
  }

  const successSignal = lines.find(line =>
    ['problem solved successfully', 'accepted', 'correct answer', 'correct'].includes(line)
  );
  if (successSignal) {
    return { verdict: Verdict.ACCEPTED, signal: successSignal };
  }

  if (lines.some(line => line === 'wa') || hasStatusLine(lines, 'wrong answer')) {
    return { verdict: Verdict.WRONG_ANSWER, signal: 'wrong answer' };
  }
  if (
    lines.some(line => line === 'ce') ||
    hasStatusLine(lines, 'compilation error') ||
    hasStatusLine(lines, 'compile error')
  ) {
    return { verdict: Verdict.COMPILATION_ERROR, signal: 'compilation error' };
  }
  if (
    lines.some(line => line === 're') ||
    hasStatusLine(lines, 'runtime error') ||
    hasStatusLine(lines, 'run time error')
  ) {
    return { verdict: Verdict.RUNTIME_ERROR, signal: 'runtime error' };
  }

  if (
    lines.some(line =>
      [
        'something went wrong',
        'failed to process request',
        'unable to process request',
      ].some(message => line.includes(message))
    )
  ) {
    return { verdict: Verdict.UNKNOWN_ERROR, signal: 'unknown error' };
  }

  return null;
}

export function normalizeVerdict(text) {
  return detectVerdict(text)?.verdict ?? null;
}

export function isJudgingStatus(text) {
  const value = normalizedLines(text).join(' ');
  return [
    'queuing',
    'request queued',
    'evaluating',
    'processing result',
    'test cases processed:',
    'compilation processing',
  ].some(status => value.includes(status));
}
