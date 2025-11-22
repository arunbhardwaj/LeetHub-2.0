(function() {
  const api = typeof chrome !== 'undefined' ? chrome : browser;
  
  // Import functions from leetcode.js through window.LeetHubExports
  const {
    uploadGitWith409Retry,
    encode,
    decode
  } = window.LeetHubExports || {};

  class LeetHubError extends Error {
    constructor(message) {
      super(message);
      this.name = 'LeetHubError';
    }
  }

  function getLanguageExtension(lang) {
    const langToExtension = {
      'cpp': '.cpp', 'java': '.java', 'python': '.py', 'python3': '.py', 'c': '.c',
      'csharp': '.cs', 'javascript': '.js', 'typescript': '.ts', 'php': '.php',
      'swift': '.swift', 'kotlin': '.kt', 'golang': '.go', 'ruby': '.rb',
      'scala': '.scala', 'rust': '.rs', 'mysql': '.sql', 'mssql': '.sql',
      'oraclesql': '.sql', 'bash': '.sh'
    };
    return langToExtension[lang.toLowerCase()] || '.txt';
  }

  function formatProblemNameSlug(frontend_id, title_slug) {
    return `${frontend_id.toString().padStart(4, '0')}-${title_slug}`;
  }

  async function fetchAllAcceptedSubmissions() {
    let offset = 0, limit = 20, allAccepted = [], keepGoing = true, lastkey = null;

    // First make sure we're on LeetCode
    if (!window.location.href.includes('leetcode.com')) {
      throw new Error("Please run this from leetcode.com");
    }

    // Make sure user is logged in - check for user avatar
    const userAvatar = document.querySelector('[alt="avatar"]');
    if (!userAvatar) {
      throw new Error("You don't appear to be logged into LeetCode. Please log in first.");
    }

    // Get csrf token from cookies
    const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1];
    if (!csrf) throw new Error("CSRF token not found - make sure you're logged into LeetCode");

    console.log("Starting to fetch submissions...");

    while (keepGoing) {
      try {
        let url = `https://leetcode.com/api/submissions/?offset=${offset}&limit=${limit}`;
        if (lastkey) url += `&lastkey=${encodeURIComponent(lastkey)}`;

        console.log(`Fetching submissions from ${url}`);

        const resp = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': csrf,
            'Referer': 'https://leetcode.com/submissions/',
            'Origin': 'https://leetcode.com'
          }
        });

        if (resp.status === 403) {
          const errorText = await resp.text();
          console.error("403 Forbidden Error:", errorText);
          throw new Error("403 Forbidden - LeetCode API access denied. Try refreshing the page.");
        }
        
        if (!resp.ok) throw new LeetHubError(`Failed to fetch submissions: ${resp.status}`);
        
        const data = await resp.json();
        console.log(`Fetched ${data.submissions_dump?.length || 0} submissions`);

        // Add only accepted submissions to our collection
        allAccepted = allAccepted.concat((data.submissions_dump || []).filter(
          sub => sub.status_display === "Accepted"
        ));
        
        // Pagination handling
        if (data.has_next) {
          offset += limit;
          lastkey = data.last_key;
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          keepGoing = false;
        }
      } catch (error) {
        console.error("Error fetching submissions:", error);
        throw error;
      }
    }

    console.log(`Found ${allAccepted.length} accepted submissions`);
    return allAccepted;
  }

  // Fetch problem details including description and topic tags
  async function fetchProblemDetails(titleSlug) {
    const query = `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          questionFrontendId
          title
          titleSlug
          content
          difficulty
          topicTags {
            name
            slug
          }
          stats
        }
      }
    `;

    const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1];
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf,
        'Referer': 'https://leetcode.com/problems/'
      },
      body: JSON.stringify({
        query: query,
        variables: { titleSlug: titleSlug }
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch problem details: ${response.status}`);
    }

    const result = await response.json();
    return result.data.question;
  }

  // Create a mock LeetCode object for loader() function
  function createMockLeetCode(submission, problemDetails) {
    // Format similar to what leetcode.js expects
    return {
      submissionId: submission.id,
      submissionData: {
        code: submission.code,
        question: {
          ...problemDetails,
          content: problemDetails.content,
          titleSlug: problemDetails.titleSlug,
          title: problemDetails.title,
          topicTags: problemDetails.topicTags
        }
      },
      difficulty: problemDetails.difficulty.toLowerCase(),
      
      // Mock methods required by loader()
      getSuccessStateAndUpdate: () => true,
      startSpinner: () => {},
      init: async () => {},
      parseStats: () => `Add solution - LeetHub`,
      parseQuestion: () => {
        return `# ${problemDetails.title}\n\n${problemDetails.content}`;
      },
      getProblemNameSlug: () => formatProblemNameSlug(problemDetails.questionFrontendId, problemDetails.titleSlug),
      getLanguageExtension: () => getLanguageExtension(submission.lang),
      findCode: () => submission.code,
      getNotesIfAny: () => "",
      markUploaded: () => {},
      markUploadFailed: () => {}
    };
  }

  async function syncAllPreviouslySolved() {
    // Create a status indicator
    const statusDiv = document.createElement('div');
    statusDiv.style.position = 'fixed';
    statusDiv.style.top = '20px';
    statusDiv.style.right = '20px';
    statusDiv.style.backgroundColor = '#f0f0f0';
    statusDiv.style.padding = '10px';
    statusDiv.style.border = '1px solid #ccc';
    statusDiv.style.borderRadius = '5px';
    statusDiv.style.zIndex = '10000';
    document.body.appendChild(statusDiv);
    
    try {
      statusDiv.textContent = "Fetching accepted submissions...";
      const acceptedSubs = await fetchAllAcceptedSubmissions();
      
      // Deduplicate by taking only the most recent accepted submission for each problem
      const problemMap = {};
      for (const sub of acceptedSubs) {
        const key = sub.title_slug;
        if (!problemMap[key] || new Date(sub.timestamp) > new Date(problemMap[key].timestamp)) {
          problemMap[key] = sub;
        }
      }
      
      const uniqueSubs = Object.values(problemMap);
      
      if (uniqueSubs.length === 0) {
        statusDiv.textContent = "No accepted submissions found.";
        setTimeout(() => document.body.removeChild(statusDiv), 3000);
        return;
      }
      
      statusDiv.textContent = `Found ${uniqueSubs.length} unique problems. Starting sync...`;
      
      let syncedCount = 0;
      for (const sub of uniqueSubs) {
        try {
          statusDiv.textContent = `Fetching details for ${sub.title} (${++syncedCount}/${uniqueSubs.length})`;
          
          // Get problem details including description and topic tags
          const problemDetails = await fetchProblemDetails(sub.title_slug);
          
          // Create a mock LeetCode object for the loader function
          const mockLeetCode = createMockLeetCode(sub, problemDetails);
          
          // Call the loader function directly
          statusDiv.textContent = `Syncing ${sub.title} (${syncedCount}/${uniqueSubs.length})`;
          window.leetCodeLoader(mockLeetCode);
          
          // Add a delay to avoid overwhelming GitHub API
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          console.error("Error syncing solution:", err);
        }
      }
      
      statusDiv.textContent = `Successfully synced ${syncedCount} solutions!`;
      setTimeout(() => document.body.removeChild(statusDiv), 3000);
    } catch (error) {
      statusDiv.textContent = `Error: ${error.message}`;
      statusDiv.style.backgroundColor = '#ffdddd';
      setTimeout(() => document.body.removeChild(statusDiv), 5000);
    }
  }

  // Keep this message listener, which will trigger sync automatically
  api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncPreviousSolutions') {
      // Start syncing automatically without requiring button click
      syncAllPreviouslySolved();
      sendResponse({ status: 'Sync started' });
      return true;
    }
  });

  // If the page is already loaded and we're on the submissions page, start syncing
  if (document.readyState === 'complete' && window.location.href.includes('leetcode.com/submissions')) {
    // Create an auto-start notification
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '15px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '10000';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.textContent = 'LeetHub sync starting automatically in 3 seconds...';
    document.body.appendChild(notification);

    // Start syncing after a small delay
    setTimeout(() => {
      document.body.removeChild(notification);
      syncAllPreviouslySolved();
    }, 3000);
  }

  // Add a backup trigger button in case auto-sync fails
  setTimeout(() => {
    // Check if sync has already started by looking for the status div
    if (!document.querySelector('[style*="LeetHub sync"]')) {
      const syncButton = document.createElement('button');
      syncButton.textContent = 'Start LeetHub Sync';
      syncButton.style.position = 'fixed';
      syncButton.style.bottom = '20px';
      syncButton.style.right = '20px';
      syncButton.style.backgroundColor = '#2cbb5d';
      syncButton.style.color = 'white';
      syncButton.style.border = 'none';
      syncButton.style.borderRadius = '5px';
      syncButton.style.padding = '10px 15px';
      syncButton.style.zIndex = '10000';
      syncButton.style.cursor = 'pointer';
      syncButton.style.fontSize = '14px';
      syncButton.style.fontWeight = 'bold';
      syncButton.onclick = syncAllPreviouslySolved;
      document.body.appendChild(syncButton);
    }
  }, 5000); // Wait 5 seconds before showing backup button
})();
