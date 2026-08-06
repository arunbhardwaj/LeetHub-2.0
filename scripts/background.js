let api = isChrome() ? chrome : isFirefox() ? browser : undefined;

// const ONE_HOUR_MS = 60 * 60 * 1000;

api.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // Allow persistent stats to sync on repo link
    api.storage.local.set({ sync_stats: true });
  }
});

api.runtime.onMessage.addListener(handleMessage);

function handleMessage(request, sender, sendResponse) {
  if (request && request.closeWebPage === true && request.isSuccess === true) {
    /* Set username */
    api.storage.local.set({ leethub_username: request.username });

    /* Set token */
    api.storage.local.set({ leethub_token: request.token });

    /* Close pipe */
    api.storage.local.set({ pipe_leethub: false }, () => {
      console.log('Closed pipe.');
    });

    api.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      var tab = tabs[0];
      api.tabs.remove(tab.id);
    });

    /* Go to onboarding for UX */
    const urlOnboarding = api.runtime.getURL('welcome.html');
    api.tabs.create({ url: urlOnboarding, active: true });

  } else if (request && request.closeWebPage === true && request.isSuccess === false) {
    alert('Something went wrong while trying to authenticate your profile!');
    api.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      var tab = tabs[0];
      api.tabs.remove(tab.id);
    });

  } else if (request.type === 'LEETCODE_SUBMISSION') {
    // Direct submissionId from backlog sync — respond immediately
    if (request.submissionId) {
      sendResponse({ submissionId: request.submissionId });
      return;
    }
    // Normal flow — wait for URL navigation to extract submissionId
    api.webNavigation.onHistoryStateUpdated.addListener(
      (e = function (details) {
        const submissionId = details.url.match(/\/submissions\/(\d+)\//)[1];
        sendResponse({ submissionId });
        api.webNavigation.onHistoryStateUpdated.removeListener(e);
      }),
      { url: [{ hostSuffix: 'leetcode.com' }, { pathContains: 'submissions' }] }
    );

  } else if (request.type === 'GENERATE_AI_EXPLANATION') {
    // Handle Gemini AI README generation
    generateReadme(request)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('[LeetHub] README generation failed:', error);
        sendResponse({ success: false, error: error.message });
      });
  }

  return true;
}

/* ─────────────────────────────────────────────────────────────────
   Build the full README.md content via Gemini.
   The code file is pushed separately — do NOT embed code here.
───────────────────────────────────────────────────────────────── */
async function generateReadme({ apiKey, problemTitle, problemStatement, code, language = '' }) {

  const langLabel = language ? ` (${language})` : '';

  const prompt = `You are an expert algorithm tutor and competitive programmer.
A user just solved the LeetCode problem below${langLabel}. Your job is to write a thorough, well-structured README.md for their GitHub repository so that anyone reading it fully understands the problem, the thinking behind the solution, and its efficiency.

=== PROBLEM TITLE ===
${problemTitle}

=== FULL PROBLEM STATEMENT (scraped verbatim — may contain HTML artifacts, clean it up) ===
${problemStatement}

=== ACCEPTED SOLUTION CODE ===
${code}

─────────────────────────────────────────────────────────────────
Generate ONLY the README.md content below (no fences, no preamble).
Follow this exact structure — keep every section heading:

# ${problemTitle}

## 📋 Problem Description
Rewrite the full problem statement clearly in plain English. Include what the function/method receives as input and what it must return. Clean up any HTML or formatting issues from the scraped text.

## 🔍 Examples
Show at least 2–3 input/output examples with clear labels:
\`\`\`
Input:  ...
Output: ...
Explanation: (if helpful)
\`\`\`

## 📌 Constraints
List every constraint as bullet points (e.g. array length, value ranges, time limits).

## 🤔 Understanding the Problem
2–4 sentences in plain English explaining *what* the problem is really asking, any edge cases to watch out for, and why it is non-trivial.

## 💡 Core Idea
The single key observation or insight that unlocks the solution. 2–3 sentences max.

## 🧠 Approach — [Name the Pattern]
State the algorithm/pattern used (e.g. Two Pointers, Sliding Window, BFS/DFS, Dynamic Programming, Greedy, Binary Search, Stack, Monotonic Queue, Union-Find, Trie, etc.).
Explain *why* this pattern fits this specific problem in 3–5 sentences.

## 📝 Step-by-Step Algorithm
Numbered steps walking through the algorithm in plain English — not pseudocode, not code. Be precise enough that someone could implement it from scratch.

## 💻 Solution
Provide the exact code from the 'ACCEPTED SOLUTION CODE' section above, but enrich it by adding detailed, helpful inline comments explaining the logic step-by-step. Put it in a proper Markdown code block.

## ⏱️ Complexity Analysis
| | Complexity | Reason |
|---|---|---|
| **Time** | O(?) | Brief one-line justification |
| **Space** | O(?) | Brief one-line justification |

## 🔗 Related Problems
List 2–3 LeetCode problems with similar patterns (just the name and number, e.g. "- 3. Longest Substring Without Repeating Characters").
─────────────────────────────────────────────────────────────────
Important rules:
- Do NOT wrap the entire output in markdown fences (\`\`\`markdown).
- Write all prose in clear, beginner-friendly English.
- Every section heading must be present even if brief.`;

  // Current Gemini models on v1beta (2025-2026)
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`,
  ];

  let lastError = null;

  for (const url of endpoints) {
    const modelName = url.match(/models\/([^:]+)/)?.[1] ?? url;

    try {
      console.log(`[LeetHub] Trying Gemini model: ${modelName}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192  // Raised from 2048 — complex READMEs need full room
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[LeetHub] ${modelName} failed (${response.status}):`, errorText);
        lastError = new Error(`Gemini API error ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const readme = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (readme) {
        console.log(`[LeetHub] README generated successfully with model: ${modelName}`);
        const cleanReadme = sanitizeReadme(readme);
        // filename is explicit — caller must write ONLY README.md, nothing else
        return { success: true, readme: cleanReadme, filename: 'README.md' };
      }

      lastError = new Error(`${modelName} returned no candidates`);
      console.warn(`[LeetHub]`, lastError.message);

    } catch (err) {
      console.warn(`[LeetHub] Fetch error for model ${modelName}:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini API endpoints failed.');
}

/* ─────────────────────────────────────────────────────────────────
   Strip anything Gemini adds despite instructions:
   - Leading/trailing ```markdown or ``` fences
   - Any prose preamble before the first # heading
   - Trailing whitespace
───────────────────────────────────────────────────────────────── */
function sanitizeReadme(raw) {
  let text = raw.trim();

  // Remove opening ```markdown or ``` fence
  text = text.replace(/^```(?:markdown)?\s*/i, '');

  // Remove closing ``` fence
  text = text.replace(/\s*```\s*$/, '');

  // Drop any preamble lines that appear before the first # heading
  const headingIndex = text.indexOf('\n#');
  const startsWithHeading = text.startsWith('#');
  if (!startsWithHeading && headingIndex !== -1) {
    text = text.slice(headingIndex + 1); // +1 to skip the \n
  }

  return text.trim();
}

function isChrome() {
  return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';
}

function isFirefox() {
  return typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';
}