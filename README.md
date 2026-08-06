<h1 align="center">
  LeetHub v2 (with Gemini AI Integration)


  
</h1>

<p align="center">
  <strong>Automatically sync your LeetCode solutions to GitHub, now powered by Google's Gemini AI to generate detailed, beautiful README explanations!</strong>
</p>

## ✨ What's New?

We've supercharged LeetHub 2.0 with **Gemini AI Integration**! 
Now, when you submit a successful solution on LeetCode, LeetHub doesn't just upload your code—it uses Gemini to analyze your solution and generate a complete, Markdown-formatted README for that problem. 

The AI-generated README includes:
- Plain English problem descriptions
- Input/Output examples
- Step-by-step algorithm breakdowns
- Time & Space complexity analysis
- Inline-commented code

## 🚀 How to Set Up LeetHub Locally

If you want to use this modified version of LeetHub locally, follow these steps:

### 1. Clone the Repository
Fork this repository to your own GitHub account, and then clone it to your local machine:
```bash
git clone https://github.com/YOUR_USERNAME/LeetHub-2.0.git
cd LeetHub-2.0
```

### 2. Install Dependencies
Make sure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
npm install
# or
npm run setup
```

### 3. Build the Extension
Compile the source code into the final extension files:
```bash
npm run build
```
*(This will generate a `./dist/chrome/` directory which we will load into the browser).*

### 4. Load the Extension in Chrome
1. Open Google Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** (the toggle switch in the top right corner).
3. Click the **Load unpacked** button.
4. Select the `./dist/chrome/` folder inside your cloned LeetHub directory.
5. The LeetHub extension should now appear in your browser!

---

## 🔑 Setting Up Gemini AI (Google AI Studio)

To get AI-generated explanations for your code, you need to provide your own Gemini API key.

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click on **Get API key** in the left sidebar and create a new API key.
4. **Copy your API key**.

### Integrating the API Key into LeetHub
1. Click the LeetHub extension icon in your Chrome toolbar.
2. In the popup, you will see a section for **Gemini AI Explanations**.
3. Paste your API key into the input field and click **Save API Key**.
4. You are all set! LeetHub will now use this key whenever you solve a problem.

---

## 🔗 Authenticating with GitHub

Before LeetHub can upload your code, you need to link it to your GitHub account:

1. Click on the LeetHub extension icon.
2. Click **Authorize with GitHub**. Follow the prompts to authenticate.
3. Once authenticated, click **Get Started** in the extension popup.
4. You can either:
   - Create a **New Repository** (LeetHub will create a private repo for you).
   - Link an **Existing Repository**.
5. You're ready to go!

---

## 💡 How to Use

- **New Submissions:** Go to [LeetCode](https://leetcode.com/), solve any problem, and click **Submit**. Once your solution is Accepted, a loading spinner will appear on the button while LeetHub generates your AI README and pushes both the README and your code file to your GitHub repository.
- **Past Submissions:** Go to the Problem page of an older question you've already solved. Click the **Submissions** tab (clock icon), and click on your Accepted submission. A **Sync w/ LeetHub** button will appear above your code. Click it to upload your old solution!

---

## 🛠️ Developer Commands

```bash
npm run               # Show list of commands available
npm run build         # Build the extension for Chrome & Firefox
npm run format        # Auto-format JavaScript, HTML/CSS
npm run format-test   # Test all code is formatted properly
npm run lint          # Lint JavaScript
npm run lint-test     # Test all code is linted properly
```
