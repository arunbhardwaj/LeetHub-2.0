import {
  getRevisionData,
  recordProblemRevision,
} from './storage.js';
import { detectDsaPatterns } from './patternDetection.js';
import { prioritizeProblems } from './prioritizer.js';
import { generateRecommendations } from './recommendations.js';
import { generateWeeklyReport, formatLocalDate } from './weeklyReport.js';

let currentRevisionData = null;
let currentPrioritized = [];
let pendingRevisionSlug = null;

/**
 * Format timestamp to friendly string
 */
function formatDateTime(timestamp) {
  if (!timestamp) return 'Historical Solve';
  const d = new Date(timestamp);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Initialize Tracker Page
 */
async function initTracker() {
  setupNavigation();
  setupFilters();
  setupModal();
  setupActions();

  await loadAndRenderData();
}

/**
 * Tab Navigation Setup
 */
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      switchTab(targetTab);
    });
  });

  document.getElementById('btnGoToQueue')?.addEventListener('click', () => switchTab('queue'));
  document.getElementById('btnGoToTopics')?.addEventListener('click', () => switchTab('topics'));

  // Handle URL hash if present
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    switchTab(hash);
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${tabName}`);
  });
  window.location.hash = tabName;
}

/**
 * Filter & Search Event Listeners
 */
function setupFilters() {
  const search = document.getElementById('queueSearch');
  const diffFilter = document.getElementById('queueDiffFilter');
  const prioFilter = document.getElementById('queuePrioFilter');
  const dueFilter = document.getElementById('queueDueFilter');

  const onFilterChange = () => renderQueueTable();

  search?.addEventListener('input', onFilterChange);
  diffFilter?.addEventListener('change', onFilterChange);
  prioFilter?.addEventListener('change', onFilterChange);
  dueFilter?.addEventListener('change', onFilterChange);
}

/**
 * Actions setup (Refresh, Export)
 */
function setupActions() {
  document.getElementById('btnRefresh')?.addEventListener('click', async () => {
    await loadAndRenderData();
  });

  document.getElementById('btnExport')?.addEventListener('click', () => {
    if (!currentRevisionData) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentRevisionData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `leethub-revision-data-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });
}

/**
 * Modal dialog setup
 */
function setupModal() {
  const modal = document.getElementById('revisionModal');
  const btnCancel = document.getElementById('modalBtnCancel');
  const btnConfirm = document.getElementById('modalBtnConfirm');

  btnCancel?.addEventListener('click', () => {
    modal.classList.remove('active');
    pendingRevisionSlug = null;
  });

  btnConfirm?.addEventListener('click', async () => {
    if (!pendingRevisionSlug) return;
    const outcome = document.getElementById('modalOutcome').value;
    const notes = document.getElementById('modalNotes').value.trim();

    await recordProblemRevision(pendingRevisionSlug, outcome, notes);
    modal.classList.remove('active');
    pendingRevisionSlug = null;
    document.getElementById('modalNotes').value = '';

    await loadAndRenderData();
  });
}

function openRevisionModal(problemSlug, problemTitle) {
  pendingRevisionSlug = problemSlug;
  const modal = document.getElementById('revisionModal');
  document.getElementById('modalProblemTitle').textContent = `Mark as Revised: ${problemTitle}`;
  modal.classList.add('active');
}

/**
 * Load fresh data from storage and re-render all views
 */
async function loadAndRenderData() {
  currentRevisionData = await getRevisionData();
  const problems = currentRevisionData.problems || {};

  // 1. Detect DSA Patterns
  const dsaPatterns = detectDsaPatterns(problems);

  // 2. Calculate Priorities
  const priorityResult = prioritizeProblems(problems);
  currentPrioritized = priorityResult.rankedQueue;

  // 3. Generate Recommendations
  const recsResult = generateRecommendations(problems);

  // 4. Generate Weekly Report
  const weeklyReport = generateWeeklyReport(currentRevisionData);

  // Render Views
  renderOverview(priorityResult, weeklyReport, dsaPatterns);
  renderTopics(dsaPatterns);
  renderQueueTable();
  renderRecommendations(recsResult);
  renderWeeklyReport(weeklyReport);
  renderHistory(currentRevisionData);
}

/**
 * 1. Render Overview
 */
function renderOverview(priorityResult, weeklyReport, dsaPatterns) {
  const problems = Object.values(currentRevisionData.problems || {});
  document.getElementById('kpiTotalProblems').textContent = problems.length;

  let easy = 0, med = 0, hard = 0;
  for (const p of problems) {
    if (p.difficulty === 'Easy') easy++;
    else if (p.difficulty === 'Medium') med++;
    else if (p.difficulty === 'Hard') hard++;
  }
  document.getElementById('kpiDiffBreakdown').textContent = `${easy} Easy • ${med} Med • ${hard} Hard`;

  const dueEl = document.getElementById('kpiDueCount');
  dueEl.textContent = priorityResult.dueCount;

  const queueBadge = document.getElementById('queueBadge');
  if (priorityResult.dueCount > 0) {
    queueBadge.textContent = priorityResult.dueCount;
    queueBadge.style.display = 'inline-block';
  } else {
    queueBadge.style.display = 'none';
  }

  const successEl = document.getElementById('kpiSuccessRate');
  if (weeklyReport.current.successRate !== null) {
    successEl.textContent = `${weeklyReport.current.successRate}%`;
  } else {
    successEl.textContent = 'N/A';
  }
  document.getElementById('kpiSuccessSub').textContent =
    weeklyReport.current.totalSubmissions > 0
      ? `${weeklyReport.current.acceptedCount}/${weeklyReport.current.totalSubmissions} submissions this week`
      : 'No submissions yet this week';

  document.getElementById('kpiRevisionsCompleted').textContent = (currentRevisionData.revisions || []).length;
  document.getElementById('kpiRevisionsSub').textContent = `${weeklyReport.current.revisionsCompleted} completed this week`;

  // Render Immediate Priorities (top 5)
  const priorityContainer = document.getElementById('overviewPriorityContainer');
  const topPriorities = currentPrioritized.slice(0, 5);

  if (topPriorities.length === 0) {
    priorityContainer.innerHTML = `
      <div class="empty-state">
        <h3>No problems tracked yet</h3>
        <p>As you solve problems on LeetCode with LeetHub active, they will automatically appear here with spaced repetition reminders.</p>
      </div>`;
  } else {
    let rowsHtml = topPriorities
      .map(p => {
        const diffBadgeClass = `badge-${p.difficulty.toLowerCase()}`;
        const prioBadgeClass = `badge-prio-${p.priorityLevel.toLowerCase()}`;
        const problemUrl = `https://leetcode.com/problems/${p.problemSlug.replace(/^\d+-/, '')}/`;

        return `
          <tr>
            <td><strong>${escapeHtml(p.frontendId || '')}</strong></td>
            <td>
              <a href="${problemUrl}" target="_blank" style="color: var(--text-main); font-weight:600; text-decoration:none;">
                ${escapeHtml(p.title)} ↗
              </a>
            </td>
            <td><span class="badge ${diffBadgeClass}">${escapeHtml(p.difficulty)}</span></td>
            <td><span class="badge ${prioBadgeClass}">${p.priorityLevel} (Score ${p.score})</span></td>
            <td style="color: var(--text-muted); font-size:12px;">${escapeHtml(p.explanation)}</td>
            <td>
              <button class="btn btn-primary btn-sm btn-mark-revised" data-slug="${p.problemSlug}" data-title="${escapeHtml(p.title)}">
                Mark Revised
              </button>
            </td>
          </tr>`;
      })
      .join('');

    priorityContainer.innerHTML = `
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Problem</th>
              <th>Difficulty</th>
              <th>Priority</th>
              <th>Rationale</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  // Render Overview Weak Topics
  const weakContainer = document.getElementById('overviewWeakTopicsContainer');
  if (dsaPatterns.weaknesses.length === 0) {
    weakContainer.innerHTML = `
      <div class="info-box">
        ${
          dsaPatterns.summary.totalTopics === 0
            ? 'No DSA topic tags recorded yet. Verified topic tags will be analyzed as problems are solved.'
            : 'No weak topic patterns detected. All attempted topics meet performance thresholds.'
        }
      </div>`;
  } else {
    const listHtml = dsaPatterns.weaknesses
      .map(w => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
          <div>
            <strong>${escapeHtml(w.name)}</strong>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${escapeHtml(w.rationale)}</div>
          </div>
          <div>
            <span class="badge badge-hard">Needs Practice</span>
            <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">${w.solvedProblems}/${w.totalProblems} solved</span>
          </div>
        </div>`)
      .join('');
    weakContainer.innerHTML = listHtml;
  }

  bindRevisedButtons();
}

/**
 * 2. Render Topics Analysis
 */
function renderTopics(dsaPatterns) {
  const container = document.getElementById('topicsContainer');
  if (dsaPatterns.topics.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Insufficient Data for Topic Classification</h3>
        <p>No verified topic tags found in your problem records yet. Solve problems on LeetCode to populate topic patterns.</p>
      </div>`;
    return;
  }

  const sections = [
    { title: '⚠️ Topics Needing Reinforcement (Demonstrated Weaknesses)', list: dsaPatterns.weaknesses, badgeClass: 'badge-hard' },
    { title: '⭐ Strengths (High Success Rate)', list: dsaPatterns.strengths, badgeClass: 'badge-easy' },
    { title: '📈 Developing Topics', list: dsaPatterns.developing, badgeClass: 'badge-medium' },
    { title: 'ℹ️ Insufficient Data (Needs More Evidence)', list: dsaPatterns.insufficientData, badgeClass: 'badge-topic' },
  ];

  let html = '';
  for (const sec of sections) {
    if (sec.list.length === 0) continue;

    html += `
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 15px; margin-bottom: 12px; color: var(--text-main);">${sec.title} (${sec.list.length})</h4>
        <div class="bar-chart-container">`;

    for (const t of sec.list) {
      const pct = t.accuracy !== null ? Math.round(t.accuracy * 100) : 0;
      let barClass = 'bar-fill-developing';
      if (t.status === 'Strength') barClass = 'bar-fill-strength';
      else if (t.status === 'Needs Practice') barClass = 'bar-fill-weakness';

      html += `
        <div class="bar-row">
          <div>
            <strong>${escapeHtml(t.name)}</strong>
            <div style="font-size:11px; color:var(--text-muted);">${t.totalProblems} problem(s), ${t.failedAttempts} failed</div>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${barClass}" style="width: ${pct}%;"></div>
          </div>
          <div style="text-align:right;">
            <span class="badge ${sec.badgeClass}">${t.accuracy !== null ? `${pct}%` : 'N/A'}</span>
          </div>
        </div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:-6px; margin-bottom:8px; padding-left:4px;">
          ${escapeHtml(t.rationale)}
        </div>`;
    }

    html += `</div></div>`;
  }

  container.innerHTML = html;
}

/**
 * 3. Render Ranked Revision Queue
 */
function renderQueueTable() {
  const tableBody = document.getElementById('queueTableBody');
  const emptyState = document.getElementById('queueEmptyState');
  const table = document.getElementById('queueTable');

  const query = (document.getElementById('queueSearch')?.value || '').toLowerCase();
  const diffFilter = document.getElementById('queueDiffFilter')?.value || 'all';
  const prioFilter = document.getElementById('queuePrioFilter')?.value || 'all';
  const dueFilter = document.getElementById('queueDueFilter')?.value || 'all';

  const filtered = currentPrioritized.filter(p => {
    if (query) {
      const matchTitle = (p.title || '').toLowerCase().includes(query);
      const matchId = (p.frontendId || '').toString().includes(query);
      const matchSlug = (p.problemSlug || '').toLowerCase().includes(query);
      if (!matchTitle && !matchId && !matchSlug) return false;
    }
    if (diffFilter !== 'all' && p.difficulty !== diffFilter) return false;
    if (prioFilter !== 'all' && p.priorityLevel !== prioFilter) return false;
    if (dueFilter === 'due' && !p.isDue) return false;
    return true;
  });

  if (filtered.length === 0) {
    table.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  table.style.display = 'table';
  emptyState.style.display = 'none';

  tableBody.innerHTML = filtered
    .map(p => {
      const diffBadgeClass = `badge-${p.difficulty.toLowerCase()}`;
      const prioBadgeClass = `badge-prio-${p.priorityLevel.toLowerCase()}`;
      const problemUrl = `https://leetcode.com/problems/${p.problemSlug.replace(/^\d+-/, '')}/`;

      const tagsHtml = (p.topicTags || [])
        .slice(0, 3)
        .map(t => `<span class="badge badge-topic">${escapeHtml(typeof t === 'string' ? t : (t.name || t.slug))}</span>`)
        .join('');

      return `
        <tr>
          <td><strong>${escapeHtml(p.frontendId || '')}</strong></td>
          <td>
            <a href="${problemUrl}" target="_blank" style="color: var(--text-main); font-weight:600; text-decoration:none;">
              ${escapeHtml(p.title)} ↗
            </a>
            <div class="tag-list" style="margin-top:4px;">${tagsHtml}</div>
          </td>
          <td><span class="badge ${diffBadgeClass}">${escapeHtml(p.difficulty)}</span></td>
          <td>
            <span class="badge ${prioBadgeClass}">${p.priorityLevel}</span>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Score: ${p.score}</div>
          </td>
          <td>
            <div style="font-weight:600; color:${p.isDue ? 'var(--prio-high)' : 'var(--text-main)'};">
              ${p.isDue ? '🚨 Due Now' : `In ${p.targetIntervalDays - (p.elapsedDays || 0)}d`}
            </div>
            <div style="font-size:11px; color:var(--text-muted);">
              Stage ${p.revisionCount} (${p.targetIntervalDays}d cycle)
            </div>
          </td>
          <td style="max-width:320px; font-size:12px; color:var(--text-muted);">
            ${escapeHtml(p.explanation)}
          </td>
          <td>
            <div style="display:flex; gap:6px;">
              <a href="${problemUrl}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none;">
                Solve
              </a>
              <button class="btn btn-primary btn-sm btn-mark-revised" data-slug="${p.problemSlug}" data-title="${escapeHtml(p.title)}">
                Mark Revised
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join('');

  bindRevisedButtons();
}

/**
 * 4. Render Similar Problem Recommendations
 */
function renderRecommendations(recsResult) {
  const container = document.getElementById('recommendationsContainer');
  const recs = recsResult.recommendations || [];

  if (recs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>${escapeHtml(recsResult.status || 'No Recommendations Available')}</h3>
        <p>${escapeHtml(recsResult.message || 'Continue solving problems on LeetCode to generate personalized recommendations.')}</p>
      </div>`;
    return;
  }

  let cardsHtml = recs
    .map(r => {
      const diffBadgeClass = `badge-${(r.difficulty || 'unknown').toLowerCase()}`;
      const sourceBadge = r.isSolvedByUser
        ? '<span class="badge badge-topic">Previously Solved</span>'
        : '<span class="badge badge-prio-medium">Verified LeetCode Similar Challenge</span>';

      const tagsHtml = (r.topicTags || [])
        .slice(0, 3)
        .map(t => `<span class="badge badge-topic">${escapeHtml(typeof t === 'string' ? t : (t.name || t.slug))}</span>`)
        .join('');

      return `
        <div class="kpi-card" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge ${diffBadgeClass}">${escapeHtml(r.difficulty)}</span>
                ${sourceBadge}
              </div>
              <h4 style="margin-top:6px; font-size:16px;">
                <a href="${r.url}" target="_blank" style="color:var(--text-main); text-decoration:none;">
                  ${escapeHtml(r.title)} ↗
                </a>
              </h4>
            </div>
            <a href="${r.url}" target="_blank" class="btn btn-primary btn-sm">
              Practice ↗
            </a>
          </div>
          <div style="font-size:13px; color:#c7c7d4; margin-bottom:8px;">
            💡 ${escapeHtml(r.reason)}
          </div>
          <div class="tag-list">${tagsHtml}</div>
        </div>`;
    })
    .join('');

  container.innerHTML = cardsHtml;
}

/**
 * 5. Render Weekly Performance Report
 */
function renderWeeklyReport(report) {
  const container = document.getElementById('weeklyReportContainer');
  const periodLabel = document.getElementById('weeklyPeriodLabel');
  periodLabel.textContent = `${report.period.startFormatted} – ${report.period.endFormatted} (Local Time)`;

  const cur = report.current;
  const comp = report.comparison;

  const comparisonHtml =
    comp.status === 'Available'
      ? `
        <div class="kpi-grid" style="margin-top:16px;">
          <div class="kpi-card">
            <div class="kpi-label">Solved Problems Δ</div>
            <div class="kpi-value" style="color: ${comp.solvedDelta >= 0 ? 'var(--easy-color)' : 'var(--hard-color)'};">
              ${comp.solvedDelta >= 0 ? `+${comp.solvedDelta}` : comp.solvedDelta}
            </div>
            <div class="kpi-subtext">vs previous week</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Submissions Δ</div>
            <div class="kpi-value" style="color: ${comp.submissionsDelta >= 0 ? 'var(--easy-color)' : 'var(--text-muted)'};">
              ${comp.submissionsDelta >= 0 ? `+${comp.submissionsDelta}` : comp.submissionsDelta}
            </div>
            <div class="kpi-subtext">vs previous week</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Success Rate Δ</div>
            <div class="kpi-value" style="color: ${comp.successRateDelta >= 0 ? 'var(--easy-color)' : 'var(--hard-color)'};">
              ${comp.successRateDelta !== null ? `${comp.successRateDelta >= 0 ? `+${comp.successRateDelta}` : comp.successRateDelta}%` : 'N/A'}
            </div>
            <div class="kpi-subtext">Percentage points</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Revisions Δ</div>
            <div class="kpi-value" style="color: ${comp.revisionsDelta >= 0 ? 'var(--easy-color)' : 'var(--text-muted)'};">
              ${comp.revisionsDelta >= 0 ? `+${comp.revisionsDelta}` : comp.revisionsDelta}
            </div>
            <div class="kpi-subtext">vs previous week</div>
          </div>
        </div>`
      : `<div class="info-box">${escapeHtml(comp.message)}</div>`;

  // Daily Chart Bars
  const maxDayCount = Math.max(1, ...cur.dailyCounts.map(d => d.submissions));
  const dayBarsHtml = cur.dailyCounts
    .map(d => {
      const heightPct = Math.round((d.submissions / maxDayCount) * 100);
      return `
        <div class="day-col">
          <div class="day-count">${d.submissions > 0 ? d.submissions : ''}</div>
          <div class="day-bar-container">
            <div class="day-bar" style="height: ${heightPct}%;"></div>
          </div>
          <div class="day-label">${d.day}</div>
        </div>`;
    })
    .join('');

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Problems Attempted</div>
        <div class="kpi-value">${cur.uniqueProblemsAttempted}</div>
        <div class="kpi-subtext">${cur.totalSubmissions} total submission(s)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Problems Solved</div>
        <div class="kpi-value" style="color: var(--easy-color);">${cur.uniqueProblemsSolved}</div>
        <div class="kpi-subtext">${cur.acceptedCount} accepted submission(s)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Weekly Success Rate</div>
        <div class="kpi-value">${cur.successRate !== null ? `${cur.successRate}%` : 'N/A'}</div>
        <div class="kpi-subtext">${cur.failedCount} failed attempt(s)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Revisions Completed</div>
        <div class="kpi-value" style="color: var(--accent-blue);">${cur.revisionsCompleted}</div>
        <div class="kpi-subtext">Spaced repetition reviews</div>
      </div>
    </div>

    <div style="margin-top:20px; margin-bottom:12px; font-weight:600;">Daily Activity Distribution (This Week)</div>
    <div class="day-chart">${dayBarsHtml}</div>

    <div style="margin-top:24px; margin-bottom:12px; font-weight:600;">Week-over-Week Performance Comparison</div>
    ${comparisonHtml}
  `;
}

/**
 * 6. Render Progress & History
 */
function renderHistory(revisionData) {
  const revBody = document.getElementById('revisionsTableBody');
  const revEmpty = document.getElementById('revisionsEmptyState');
  const revTable = document.getElementById('revisionsTable');

  const revisions = (revisionData.revisions || []).slice().reverse();
  if (revisions.length === 0) {
    revTable.style.display = 'none';
    revEmpty.style.display = 'block';
  } else {
    revTable.style.display = 'table';
    revEmpty.style.display = 'none';
    revBody.innerHTML = revisions
      .slice(0, 50)
      .map(r => `
        <tr>
          <td style="color:var(--text-muted); font-size:12px;">${formatDateTime(r.timestamp)}</td>
          <td><strong>${escapeHtml(r.problemSlug)}</strong></td>
          <td><span class="badge badge-easy">${escapeHtml(r.outcome)}</span></td>
          <td style="color:var(--text-muted);">${escapeHtml(r.notes || '—')}</td>
        </tr>`)
      .join('');
  }

  const subBody = document.getElementById('submissionsTableBody');
  const subEmpty = document.getElementById('submissionsEmptyState');
  const subTable = document.getElementById('submissionsTable');

  const submissions = (revisionData.submissions || []).slice().reverse();
  if (submissions.length === 0) {
    subTable.style.display = 'none';
    subEmpty.style.display = 'block';
  } else {
    subTable.style.display = 'table';
    subEmpty.style.display = 'none';
    subBody.innerHTML = submissions
      .slice(0, 50)
      .map(s => {
        const isAccepted = s.outcome === 'Accepted' || s.statusCode === 10;
        const badgeClass = isAccepted ? 'badge-easy' : 'badge-hard';
        return `
          <tr>
            <td style="color:var(--text-muted); font-size:12px;">${formatDateTime(s.timestamp)}</td>
            <td><strong>${escapeHtml(s.problemSlug)}</strong></td>
            <td><span class="badge ${badgeClass}">${escapeHtml(s.outcome)}</span></td>
            <td>${escapeHtml(s.runtimeDisplay || '—')}</td>
            <td>${escapeHtml(s.memoryDisplay || '—')}</td>
          </tr>`;
      })
      .join('');
  }
}

/**
 * Bind click handlers for "Mark Revised" buttons
 */
function bindRevisedButtons() {
  document.querySelectorAll('.btn-mark-revised').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const slug = btn.dataset.slug;
      const title = btn.dataset.title;
      openRevisionModal(slug, title);
    });
  });
}

// Kickoff
document.addEventListener('DOMContentLoaded', initTracker);
