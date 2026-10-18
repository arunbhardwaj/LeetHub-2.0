import {
  getDefaultRevisionData,
  syncFromLegacyStats,
  recordSubmissionAttempt,
  recordProblemRevision,
} from '../scripts/tracker/storage.js';
import { detectDsaPatterns } from '../scripts/tracker/patternDetection.js';
import {
  calculateProblemPriority,
  prioritizeProblems,
  getTargetIntervalDays,
} from '../scripts/tracker/prioritizer.js';
import {
  getLocalWeekStart,
  getLocalWeekEnd,
  generateWeeklyReport,
} from '../scripts/tracker/weeklyReport.js';
import { generateRecommendations } from '../scripts/tracker/recommendations.js';

describe('Smart Revision Tracker', () => {
  // Mock Extension Storage API for testing
  function createMockStorage(initialStore = {}) {
    const store = { ...initialStore };
    return {
      storage: {
        local: {
          get: (keys) => {
            const result = {};
            if (Array.isArray(keys)) {
              keys.forEach(k => { result[k] = store[k]; });
            } else if (typeof keys === 'string') {
              result[keys] = store[keys];
            } else {
              Object.assign(result, store);
            }
            return Promise.resolve(result);
          },
          set: (items) => {
            Object.assign(store, items);
            return Promise.resolve();
          },
        },
      },
      _store: store,
    };
  }

  describe('1. Storage & Legacy Backfill', () => {
    it('should initialize default revision structure cleanly', () => {
      const def = getDefaultRevisionData();
      expect(def.version).toBe(1);
      expect(def.problems).toEqual({});
      expect(def.submissions).toEqual([]);
      expect(def.revisions).toEqual([]);
    });

    it('should backfill problems from legacy stats.shas without fabricating timestamps or attempts', () => {
      const legacyStats = {
        shas: {
          '0001-two-sum': { difficulty: 'Easy' },
          '0015-3sum': { difficulty: 'Medium' },
        },
      };

      const syncd = syncFromLegacyStats(legacyStats, getDefaultRevisionData());
      expect(Object.keys(syncd.problems).length).toBe(2);

      const twoSum = syncd.problems['0001-two-sum'];
      expect(twoSum.title).toBe('Two Sum');
      expect(twoSum.frontendId).toBe('1');
      expect(twoSum.difficulty).toBe('Easy');
      expect(twoSum.importedFromLegacy).toBe(true);
      expect(twoSum.firstSolvedAt).toBeNull();
      expect(twoSum.lastSolvedAt).toBeNull();
      expect(twoSum.failedAttempts).toBe(0);
    });

    it('should prevent duplicate submission records with identical submissionId', async () => {
      const mockApi = createMockStorage();
      const attempt = {
        submissionId: '1001',
        problemSlug: '0001-two-sum',
        frontendId: '1',
        title: 'Two Sum',
        difficulty: 'Easy',
        outcome: 'Accepted',
        statusCode: 10,
        timestamp: 1700000000000,
      };

      await recordSubmissionAttempt(attempt, mockApi);
      await recordSubmissionAttempt(attempt, mockApi); // Duplicate

      const revData = await mockApi.storage.local.get('leethub_revision_data');
      const submissions = revData.leethub_revision_data.submissions;
      expect(submissions.length).toBe(1);
    });

    it('should track failed attempts and update success count accurately', async () => {
      const mockApi = createMockStorage();
      const slug = '0020-valid-parentheses';

      // 1. First attempt fails (Wrong Answer)
      await recordSubmissionAttempt({
        submissionId: '2001',
        problemSlug: slug,
        frontendId: '20',
        title: 'Valid Parentheses',
        difficulty: 'Easy',
        outcome: 'Failed',
        statusCode: 11,
        timestamp: 1700000000000,
      }, mockApi);

      // 2. Second attempt succeeds (Accepted)
      await recordSubmissionAttempt({
        submissionId: '2002',
        problemSlug: slug,
        frontendId: '20',
        title: 'Valid Parentheses',
        difficulty: 'Easy',
        outcome: 'Accepted',
        statusCode: 10,
        timestamp: 1700000060000,
      }, mockApi);

      const revData = await mockApi.storage.local.get('leethub_revision_data');
      const prob = revData.leethub_revision_data.problems[slug];
      expect(prob.failedAttempts).toBe(1);
      expect(prob.successCount).toBe(1);
      expect(prob.totalSubmissions).toBe(2);
      expect(prob.lastSolvedAt).toBe(1700000060000);
    });

    it('should record revision event and increment revision count', async () => {
      const mockApi = createMockStorage();
      const slug = '0001-two-sum';

      await recordSubmissionAttempt({
        submissionId: '1001',
        problemSlug: slug,
        title: 'Two Sum',
        difficulty: 'Easy',
        outcome: 'Accepted',
        statusCode: 10,
        timestamp: 1700000000000,
      }, mockApi);

      await recordProblemRevision(slug, 'Completed with ease', 'O(n) hash map technique', mockApi);

      const revData = await mockApi.storage.local.get('leethub_revision_data');
      const prob = revData.leethub_revision_data.problems[slug];
      expect(prob.revisionCount).toBe(1);
      expect(typeof prob.lastRevisedAt).toBe('number');
      expect(revData.leethub_revision_data.revisions.length).toBe(1);
      expect(revData.leethub_revision_data.revisions[0].outcome).toBe('Completed with ease');
      expect(revData.leethub_revision_data.revisions[0].notes).toBe('O(n) hash map technique');
    });
  });

  describe('2. DSA Pattern Detection', () => {
    it('should return Insufficient Data when problem set is empty', () => {
      const res = detectDsaPatterns({});
      expect(res.topics.length).toBe(0);
      expect(res.weaknesses.length).toBe(0);
      expect(res.strengths.length).toBe(0);
      expect(res.summary.hasEnoughData).toBe(false);
    });

    it('should flag topics with only 1 problem and zero failures as Insufficient Data', () => {
      const problems = {
        '0001-two-sum': {
          problemSlug: '0001-two-sum',
          topicTags: [{ name: 'Array', slug: 'array' }],
          failedAttempts: 0,
          successCount: 1,
          totalSubmissions: 1,
          lastSolvedAt: 1700000000000,
        },
      };

      const res = detectDsaPatterns(problems);
      expect(res.topics.length).toBe(1);
      expect(res.topics[0].status).toBe('Insufficient Data');
      expect(res.topics[0].rationale).toContain('Minimum 2 problems');
    });

    it('should classify topic as Needs Practice when accuracy is low and failures occurred', () => {
      const problems = {
        '0003-longest-substring': {
          problemSlug: '0003-longest-substring',
          topicTags: [{ name: 'Sliding Window', slug: 'sliding-window' }],
          failedAttempts: 3,
          successCount: 1,
          totalSubmissions: 4,
          lastSolvedAt: 1700000000000,
        },
        '0076-minimum-window': {
          problemSlug: '0076-minimum-window',
          topicTags: [{ name: 'Sliding Window', slug: 'sliding-window' }],
          failedAttempts: 2,
          successCount: 1,
          totalSubmissions: 3,
          lastSolvedAt: 1700000000000,
        },
      };

      const res = detectDsaPatterns(problems);
      expect(res.weaknesses.length).toBe(1);
      expect(res.weaknesses[0].name).toBe('Sliding Window');
      expect(res.weaknesses[0].status).toBe('Needs Practice');
      expect(res.weaknesses[0].failedAttempts).toBe(5);
      // Accuracy = 2 / 7 = 0.29
      expect(res.weaknesses[0].accuracy).toBeLessThan(0.5);
    });

    it('should classify topic as Strength when accuracy is >= 80% across multiple problems', () => {
      const problems = {
        '0001-two-sum': {
          problemSlug: '0001-two-sum',
          topicTags: [{ name: 'Hash Table', slug: 'hash-table' }],
          failedAttempts: 0,
          successCount: 1,
          totalSubmissions: 1,
          lastSolvedAt: 1700000000000,
        },
        '0217-contains-duplicate': {
          problemSlug: '0217-contains-duplicate',
          topicTags: [{ name: 'Hash Table', slug: 'hash-table' }],
          failedAttempts: 0,
          successCount: 1,
          totalSubmissions: 1,
          lastSolvedAt: 1700000000000,
        },
      };

      const res = detectDsaPatterns(problems);
      expect(res.strengths.length).toBe(1);
      expect(res.strengths[0].name).toBe('Hash Table');
      expect(res.strengths[0].status).toBe('Strength');
      expect(res.strengths[0].accuracy).toBe(1.0);
    });
  });

  describe('3. Smart Revision Prioritization', () => {
    it('should follow standard spaced repetition interval progression', () => {
      expect(getTargetIntervalDays(0)).toBe(3);
      expect(getTargetIntervalDays(1)).toBe(7);
      expect(getTargetIntervalDays(2)).toBe(16);
      expect(getTargetIntervalDays(3)).toBe(35);
    });

    it('should assign higher priority score to overdue problems with failed attempts and hard difficulty', () => {
      const now = 1700000000000;
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      const easyFresh = {
        problemSlug: '0001-two-sum',
        difficulty: 'Easy',
        revisionCount: 0,
        failedAttempts: 0,
        lastSolvedAt: now - 1 * MS_PER_DAY, // 1 day ago (not due, target 3)
      };

      const hardOverdueWithFailures = {
        problemSlug: '0042-trapping-rain-water',
        difficulty: 'Hard',
        revisionCount: 0,
        failedAttempts: 4,
        topicTags: [{ name: 'Dynamic Programming' }],
        lastSolvedAt: now - 10 * MS_PER_DAY, // 10 days ago (due, target 3)
      };

      const weakTopics = new Set(['Dynamic Programming']);

      const prioEasy = calculateProblemPriority(easyFresh, weakTopics, now);
      const prioHard = calculateProblemPriority(hardOverdueWithFailures, weakTopics, now);

      expect(prioEasy.isDue).toBe(false);
      expect(prioHard.isDue).toBe(true);
      expect(prioHard.score).toBeGreaterThan(prioEasy.score);
      expect(prioHard.priorityLevel).toBe('High');
      expect(prioHard.explanation).toContain('Hard difficulty');
      expect(prioHard.explanation).toContain('4 failed attempt(s)');
      expect(prioHard.explanation).toContain('Weak topic area');
    });

    it('should handle missing timestamps honestly without crashing', () => {
      const legacyProblem = {
        problemSlug: '0021-merge-sorted-lists',
        difficulty: 'Easy',
        importedFromLegacy: true,
        lastSolvedAt: null,
        lastRevisedAt: null,
      };

      const prio = calculateProblemPriority(legacyProblem, new Set(), Date.now());
      expect(prio.elapsedDays).toBeNull();
      expect(prio.explanation).toContain('Original solve timestamp unavailable');
    });

    it('should sort ranked queue from highest to lowest priority', () => {
      const now = Date.now();
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      const problems = {
        p1: { problemSlug: 'p1', difficulty: 'Easy', lastSolvedAt: now - 1 * MS_PER_DAY },
        p2: { problemSlug: 'p2', difficulty: 'Hard', failedAttempts: 3, lastSolvedAt: now - 20 * MS_PER_DAY },
        p3: { problemSlug: 'p3', difficulty: 'Medium', lastSolvedAt: now - 5 * MS_PER_DAY },
      };

      const result = prioritizeProblems(problems, now);
      expect(result.rankedQueue.length).toBe(3);
      expect(result.rankedQueue[0].problemSlug).toBe('p2'); // Highest urgency & difficulty
      expect(result.rankedQueue[0].score).toBeGreaterThanOrEqual(result.rankedQueue[1].score);
      expect(result.rankedQueue[1].score).toBeGreaterThanOrEqual(result.rankedQueue[2].score);
    });
  });

  describe('4. Weekly Performance Reports', () => {
    it('should compute exact Monday 00:00:00 to Sunday 23:59:59 week boundaries', () => {
      // Test with Wednesday, Oct 14, 2026
      const refDate = new Date(2026, 9, 14, 15, 30, 0); // Month is 0-indexed (9 = Oct)
      const weekStart = getLocalWeekStart(refDate);
      const weekEnd = getLocalWeekEnd(weekStart);

      const startDate = new Date(weekStart);
      const endDate = new Date(weekEnd);

      expect(startDate.getDay()).toBe(1); // Monday
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);

      expect(endDate.getDay()).toBe(0); // Sunday
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
    });

    it('should report Insufficient Data for previous week comparison when previous week has no entries', () => {
      const now = new Date(2026, 9, 14, 12, 0, 0).getTime();
      const weekStart = getLocalWeekStart(new Date(now));

      const revisionData = {
        problems: {},
        submissions: [
          {
            submissionId: 's1',
            problemSlug: '0001-two-sum',
            outcome: 'Accepted',
            statusCode: 10,
            timestamp: weekStart + 10000, // inside current week
          },
        ],
        revisions: [],
      };

      const report = generateWeeklyReport(revisionData, now);
      expect(report.hasCurrentData).toBe(true);
      expect(report.hasPreviousData).toBe(false);
      expect(report.comparison.status).toBe('Insufficient Data');
      expect(report.comparison.message).toContain('Insufficient data for previous week comparison');
    });

    it('should compute week-over-week deltas accurately when previous week has activity', () => {
      const now = new Date(2026, 9, 14, 12, 0, 0).getTime();
      const weekStart = getLocalWeekStart(new Date(now));
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      const revisionData = {
        problems: {},
        submissions: [
          // Previous week: 1 attempted, 0 solved
          {
            submissionId: 'prev-1',
            problemSlug: '0003-longest-substring',
            outcome: 'Failed',
            statusCode: 11,
            timestamp: weekStart - 3 * MS_PER_DAY,
          },
          // Current week: 2 solved
          {
            submissionId: 'cur-1',
            problemSlug: '0001-two-sum',
            outcome: 'Accepted',
            statusCode: 10,
            timestamp: weekStart + 1 * MS_PER_DAY,
          },
          {
            submissionId: 'cur-2',
            problemSlug: '0002-add-two-numbers',
            outcome: 'Accepted',
            statusCode: 10,
            timestamp: weekStart + 2 * MS_PER_DAY,
          },
        ],
        revisions: [],
      };

      const report = generateWeeklyReport(revisionData, now);
      expect(report.hasCurrentData).toBe(true);
      expect(report.hasPreviousData).toBe(true);
      expect(report.comparison.status).toBe('Available');
      expect(report.comparison.solvedDelta).toBe(2); // 2 in current vs 0 in previous
      expect(report.comparison.submissionsDelta).toBe(1); // 2 in current vs 1 in previous
      expect(report.comparison.successRateDelta).toBe(100); // 100% current vs 0% previous
    });
  });

  describe('5. Similar Problem Recommendations', () => {
    it('should return Insufficient Data when problems library is empty', () => {
      const res = generateRecommendations({});
      expect(res.status).toBe('Insufficient Data');
      expect(res.recommendations.length).toBe(0);
    });

    it('should recommend verified similar questions from LeetCode GraphQL attached to struggle problems', () => {
      const now = Date.now();
      const problems = {
        '0015-3sum': {
          problemSlug: '0015-3sum',
          title: '3Sum',
          difficulty: 'Medium',
          failedAttempts: 2,
          lastSolvedAt: now - 10 * 24 * 60 * 60 * 1000,
          topicTags: [{ name: 'Two Pointers' }],
          similarQuestions: [
            { titleSlug: '3sum-closest', title: '3Sum Closest', difficulty: 'Medium' },
            { titleSlug: '4sum', title: '4Sum', difficulty: 'Medium' },
          ],
        },
      };

      const res = generateRecommendations(problems, now);
      expect(res.status).toBe('Available');
      const similarRec = res.recommendations.find(r => r.problemSlug === '3sum-closest');
      expect(similarRec).toBeDefined();
      expect(similarRec.source).toContain('Similar Question');
      expect(similarRec.url).toContain('leetcode.com/problems/3sum-closest');
    });

    it('should not recommend problems revised within the last 48 hours', () => {
      const now = Date.now();
      const problems = {
        '0001-two-sum': {
          problemSlug: '0001-two-sum',
          title: 'Two Sum',
          difficulty: 'Easy',
          failedAttempts: 0,
          lastSolvedAt: now - 10 * 24 * 60 * 60 * 1000,
          lastRevisedAt: now - 5 * 60 * 60 * 1000, // 5 hours ago
        },
      };

      const res = generateRecommendations(problems, now);
      const found = res.recommendations.find(r => r.problemSlug === '0001-two-sum');
      expect(found).toBeUndefined();
    });
  });
});
