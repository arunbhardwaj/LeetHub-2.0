<h1 align="center">
  <a href="https://standardjs.com"><img src="assets/octocode.png" alt="LeetHub v2 - Automatically sync your code to GitHub." width="400"></a>
  <br>
  <a href="https://chrome.google.com/webstore/detail/leethub-v2/mhanfgfagplhgemhjfeolkkdidbakocm">LeetHub v2</a> - Automatically sync your code to GitHub.
  <br>
  <br>
</h1>

<p align="center">
  <a href="https://github.com/arunbhardwaj/LeetHub-2.0/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"/>
  </a>
</p>

## What is LeetHub 2.0?
<p>A <a href="https://chromewebstore.google.com/detail/leethub-v2/mhanfgfagplhgemhjfeolkkdidbakocm">chrome</a> and (new) <a href="https://addons.mozilla.org/en-US/firefox/addon/leethub-v2/">firefox</a> extension that automatically pushes your code to GitHub when you pass all tests on a <a href="https://leetcode.com/">Leetcode</a> problem. It's forked from the original <a href="https://chrome.google.com/webstore/detail/leethub/aciombdipochlnkbpcbgdpjffcfdbggi?hl=en">LeetHub</a> and improves on it to be faster, cleaner and compatible with the new dynamic LeetCode UI.</p>

## Why LeetHub?
<p> <strong>1.</strong> Recruiters <em>want</em> to see your contributions to the Open Source community, be it through side projects, solving algorithms/data-structures, or contributing to existing OS projects.<br>
As of now, GitHub is developers' #1 portfolio. LeetHub just makes it much easier (autonomous) to keep track of progress and contributions on the largest network of engineering community, GitHub.</p>

<p> <strong>2.</strong> There's no easy way of accessing your leetcode problems in one place! <br>
Moreover, pushing code manually to GitHub from Leetcode is very time consuming. So, why not just automate it entirely without spending a SINGLE additional second on it? </p>

## How does LeetHub work?     

<p>It's as simple as:</p>
<ol>
  <li>After installation, launch LeetHub.</li>
  <li>Click <code>Authorize with GitHub</code> to set up your account.</li>
  <li>Click <code>Get Started</code> to create or link a repository (private by default).</li>
  <li>Begin Leetcoding! To view your progress, simply click on the extension!</li>
</ol>


#### BONUS: Star [this repository](https://github.com/arunbhardwaj/LeetHub-2.0) for further development of features. If you want a particular feature, simply [request](https://github.com/arunbhardwaj/LeetHub-2.0/labels/feature) for it!


## Privacy & security

- LeetHub uses GitHub's OAuth Device Flow to obtain a token with <code>repo</code> scope and stores it in extension local storage (<code>chrome.storage.local</code>/<code>browser.storage.local</code>).
- The token is used to create/link repositories and upload solutions and <code>stats.json</code> to GitHub.
- LeetHub runs locally in your browser; this repo does not include a backend service.
- To revoke access, remove extension data or unlink in the extension, then revoke the OAuth app in GitHub Settings > Applications > Authorized OAuth Apps.


## Why did I decide to work on LeetHub?
<p>
After the 2023 SVB bank closure and growing layoffs, it became clear to me that maintaining your skills is incredibly important. In that effort, it helps to have a source to contain all your learnings over the years: a repo you can go back to and see your commit history and any notes you've taken. With the previous and other extensions broken by recent LeetCode and GitHub changes, I decided to build one out myself using the original as a starting point.
</p>

# Let's see you ACE that coding interview!

![leetcode view](assets/extension/leetcode.png)


## How to set up LeetHub for local development?


  1. Fork this repo and clone it locally.
  2. Run <code>npm run setup</code> to install developer dependencies.
  3. Run <code>npm run build</code> to build the extension into <code>./dist/</code>.
  4. Open <code>chrome://extensions</code> (Chrome) or <code>about:debugging</code> (Firefox).
  5. In Chrome, enable <code>Developer mode</code>.
  6. Click <code>Load unpacked</code> (Chrome) or <code>Load Temporary Add-on...</code> (Firefox).
  7. Select <code>./dist/chrome</code> or <code>./dist/firefox</code>.
  8. Re-run <code>npm run build</code> and reload the extension after changes.


## Contributing & testing

Prerequisites:

- Node.js 18+ (LTS)
- npm (bundled with Node.js)

Common scripts:

```
npm run format        Auto-format JavaScript, HTML/CSS
npm run format-test   Test all code is formatted properly
npm run lint          Lint JavaScript
npm run lint-test     Test all code is linted properly
npm run test          Run Jasmine tests
npm run build         Build the extension
```

Build output:

- <code>./dist/</code> contains the base build output.
- <code>./dist/chrome</code> and <code>./dist/firefox</code> contain browser-specific packages after <code>npm run build</code>.
