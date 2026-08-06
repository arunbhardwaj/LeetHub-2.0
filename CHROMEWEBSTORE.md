# Chrome Web Store Metadata & Publishing Details

This document contains the listing copy, permissions justifications, and privacy disclosures for **LeetHub v2** to assist when submitting to the Chrome Developer Dashboard.

---

## 📝 Store Listing Details

### Product Name
`LeetHub v2`

### Summary Description (Max 150 characters)
`Automatically sync and commit your LeetCode and GeeksforGeeks solutions to your GitHub repositories with independent stats and separate repos.`

### Detailed Description
```markdown
LeetHub v2 is a browser extension that automatically integrates your coding practice with GitHub. When you solve a problem and successfully pass all test cases on LeetCode or GeeksforGeeks, LeetHub automatically commits the solution code and problem description directly to your GitHub repository in real time.

🌟 KEY FEATURES
- **Separate Repositories**: Link two different GitHub repositories—one specifically for LeetCode and one for GeeksforGeeks.
- **Topic-Grouped READMEs**: Automatically creates and updates a root README in your repository, grouping solved problems under their respective Topic Tags.
- **Independent Statistics**: Tracks your solved problem counts (Easy, Medium, Hard, and Total Solved) separately for both platforms.
- **Stats Synchronization**: Syncs your stats dynamically through a stats.json file in your repository, so you never lose your progress if you change computers.
- **Multi-Language Support**: Supports C++, Python, Java, JavaScript, C, Kotlin, Go, and more.

🚀 HOW IT WORKS
1. Click "Authenticate" in the extension popup to authorize LeetHub with your GitHub account.
2. Link or create your repositories on the onboarding dashboard.
3. Solve questions on LeetCode or GeeksforGeeks.
4. Watch LeetHub automatically push your code, runtime statistics, and formatted problem descriptions to your GitHub repositories!
```

---

## 🔒 Permissions & Justification

Every permission declared in [manifest-chrome.json](file:///Users/anshjohnson/LeetHub/manifest-chrome.json) is strictly necessary for core functionality:

| Permission | Justification |
|------------|---------------|
| `storage` | Required to securely store your GitHub OAuth token, linked repository names, and local statistics. |
| `unlimitedStorage` | Required to prevent local statistics databases (the list of committed SHAs) from running out of allocated browser storage. |
| `webNavigation` | Required to monitor history state changes on `leetcode.com` and `geeksforgeeks.org` so the extension knows when you navigate to and successfully submit a problem. |

### Host Permissions (Content Script Matches)
- `https://leetcode.com/*`: Required to parse solved problem details, code, and submission status.
- `https://github.com/*`: Required to capture the OAuth redirect code during the GitHub authorization process.
- `https://www.geeksforgeeks.org/problems/*`: Required to parse solved problem details, code, and submission status on GFG.
- `https://practice.geeksforgeeks.org/*`: Legacy match pattern for GeeksforGeeks practice domain.

---

## 📄 Privacy & Data Use Disclosure

- **Data Collection**: LeetHub v2 does not collect or transmit any user data to external servers.
- **Authentication**: Authentication is handled directly with the GitHub OAuth API. The resulting access token is stored locally on your machine via the `chrome.storage.local` API and is only used to make API calls to commit files to your repositories.
- **Third-Party Services**: The extension interacts exclusively with `github.com`, `leetcode.com`, and `geeksforgeeks.org`.

---

## 📈 Version History

### Version 2.0.10 (Current)
- Added support for linking separate GitHub repositories for LeetCode and GeeksforGeeks.
- Added separate statistics cards and independent stats reset features to the popup.
- Restored GeeksforGeeks auto-sync by updating match patterns to GFG's current domain (`geeksforgeeks.org/problems/*`).
- Added robust, fallback-equipped DOM selectors to GeeksforGeeks scrapers.
- Added topic-grouped root README updates and stats.json persistence for GeeksforGeeks repositories.
