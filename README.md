# GFGHub

GFGHub is a browser extension that automatically uploads an Accepted GeeksforGeeks solution to a selected GitHub repository. It captures the editor contents when **Submit** is clicked, waits for the final verdict, and uploads that exact snapshot only after GitHub confirms the write.

Failed submissions—Wrong Answer, Compilation Error, Time Limit Exceeded, and Runtime Error—do not trigger GitHub activity.

## What it does

- Connects to GitHub through the extension setup flow.
- Lets you select a writable existing repository or create a private repository.
- Uploads `README.md` and `Solution.<extension>` under a stable problem-slug folder.
- Updates the same language file on re-submission without creating duplicates.
- Keeps different languages side by side, such as `Solution.java`, `Solution.cpp`, and `Solution.py`.
- Avoids a commit when the GitHub file already has identical content.
- Tracks unique solved problems and Easy, Medium, and Hard totals locally.
- Shows success/failure feedback on the GFG page and the latest outcome in the popup.

## Install in Chrome developer mode

1. Install [Node.js](https://nodejs.org/) and clone this repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Open `chrome://extensions` in Chrome.
5. Enable **Developer mode**.
6. Select **Load unpacked** and choose `dist/chrome`.
7. Pin GFGHub if you want quick access to setup and statistics.

## GitHub setup

1. Open the GFGHub popup and select **Connect GitHub**.
2. Complete GitHub authorization.
3. Select a writable repository, enter an `owner/name`, or create a private repository.
4. Confirm the popup shows **Sync: Ready**.
5. Open a modern GeeksforGeeks problem page and submit a solution.

GFGHub never chooses a repository automatically. Changing repositories preserves local solved statistics. Existing legacy storage key names are retained for compatibility.

## Repository layout

For a problem with slug `binary-search`, the repository contains:

```text
binary-search/
├── README.md
├── Solution.java
├── Solution.cpp
└── Solution.py
```

The README includes the problem title, canonical GeeksforGeeks URL, available difficulty, and available problem statement. Source code is not stored in popup status or statistics records.

## Supported languages

C, C++, C#, Dart, Go, Java, JavaScript, Kotlin, PHP, Python, Ruby, Rust, Scala, Swift, and TypeScript.

## Local development

```bash
npm install
npm run build
npm test
npm run lint
```

Additional commands:

- `npm run dev` — production-mode watch build.
- `npm run format` — format JavaScript, HTML, and CSS.
- `npm run format-test` — check formatting.
- `npm run lint:fix` — apply safe ESLint fixes.

Build output is generated in `dist/`, with ready-to-load Chrome and Firefox directories at `dist/chrome` and `dist/firefox`.

## Current limitations

- GFG DOM selectors can require maintenance when GeeksforGeeks changes its problem-page UI.
- The repository picker lists the first 100 recently updated writable repositories; any other repository can be entered manually as `owner/name`.
- Firefox build output is produced, but the complete OAuth-to-Accepted flow still needs live release validation in Firefox.
- Failed sync retry is not implemented; submit the captured solution again after fixing setup or connectivity.

## License

MIT. See [LICENSE](LICENSE).
