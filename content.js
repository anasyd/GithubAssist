// GitHub Merge Conflict Helper - Enhanced with PAT Support
class MergeConflictHelper {
  constructor() {
    this.editor = null;
    this.resolvedContent = null;
    this.debugMode = true;
    this.token = null;
    this.repoInfo = null;
    this.prInfo = null;
    this.init();
    this.setupMessageListener();
  }

  debug(message, data = null) {
    if (this.debugMode) {
      console.log(`[Merge Helper] ${message}`, data || "");
    }
  }

  async promptForFilePath() {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
            `;

      modal.innerHTML = `
                <div style="
                    background: white; border-radius: 8px; padding: 24px; 
                    max-width: 500px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                ">
                    <h3 style="margin: 0 0 16px 0; color: #24292f;">Enter File Path</h3>
                    <p style="margin: 0 0 16px 0; color: #586069; line-height: 1.5;">
                        Could not automatically detect the file path. Please enter the full path 
                        to the file you're resolving conflicts for (e.g., "src/components/App.js").
                    </p>
                    <input type="text" placeholder="e.g., src/components/App.js" style="
                        width: 100%; padding: 8px 12px; border: 1px solid #d1d9e0; 
                        border-radius: 6px; font-family: monospace; margin: 8px 0;
                    " id="filepath-input">
                    <div style="display: flex; gap: 8px; margin-top: 16px;">
                        <button id="confirm-filepath" style="
                            background: #28a745; color: white; border: none; 
                            padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;
                        ">Confirm</button>
                        <button id="cancel-filepath" style="
                            background: #6c757d; color: white; border: none; 
                            padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;
                        ">Cancel</button>
                    </div>
                </div>
            `;

      document.body.appendChild(modal);

      const input = modal.querySelector("#filepath-input");
      const confirmBtn = modal.querySelector("#confirm-filepath");
      const cancelBtn = modal.querySelector("#cancel-filepath");

      confirmBtn.onclick = () => {
        const filePath = input.value.trim();
        modal.remove();
        resolve(filePath || null);
      };

      cancelBtn.onclick = () => {
        modal.remove();
        resolve(null);
      };

      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(null);
        }
      };

      input.focus();
    });
  }

  async init() {
    this.debug("Initializing...");
    await this.loadToken();
    await this.extractRepoInfo();
    await this.waitForPageLoad();

    if (this.isConflictPage()) {
      this.debug("Conflict page detected, setting up helper...");
      await this.waitForCodeMirror();
      this.setupHelper();
    }
  }

  async loadToken() {
    try {
      const result = await chrome.storage.sync.get(["githubToken"]);
      this.token = result.githubToken;
      this.debug("Token loaded:", this.token ? "Present" : "Not set");
    } catch (error) {
      this.debug("Error loading token:", error);
    }
  }

  async saveToken(token) {
    try {
      await chrome.storage.sync.set({ githubToken: token });
      this.token = token;
      this.debug("Token saved successfully");
    } catch (error) {
      this.debug("Error saving token:", error);
    }
  }

  extractRepoInfo() {
    const pathParts = window.location.pathname.split("/");
    if (pathParts.length >= 3) {
      this.repoInfo = {
        owner: pathParts[1],
        repo: pathParts[2],
      };

      // Extract PR number if we're on a PR conflicts page
      const prMatch = window.location.pathname.match(
        /\/pull\/(\d+)\/conflicts/
      );
      if (prMatch) {
        this.prInfo = {
          number: parseInt(prMatch[1]),
        };
      }
    }
    this.debug("Repo info:", this.repoInfo);
    this.debug("PR info:", this.prInfo);
  }

  async githubApiCall(endpoint, options = {}) {
    if (!this.token) {
      throw new Error("GitHub token not set");
    }

    const url = `https://api.github.com${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `token ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  async setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "checkConflicts") {
        const hasConflicts = this.hasConflicts();
        const conflictCount = this.getConflictCount();
        sendResponse({
          hasConflicts: hasConflicts,
          conflictCount: conflictCount,
          hasToken: !!this.token,
        });
      }
    });
  }

  async waitForPageLoad() {
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      if (
        document.readyState === "complete" &&
        !document.querySelector(".js-pjax-loader-bar.is-loading")
      ) {
        this.debug("Page load complete");
        return;
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  async waitForCodeMirror() {
    this.debug("Looking for CodeMirror...");
    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const possibleSelectors = [
        ".CodeMirror",
        ".file-editor-textarea",
        'textarea[name*="file"]',
        ".js-file-editor-textarea",
      ];

      for (const selector of possibleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          this.debug(`Found editor element with selector: ${selector}`);

          if (element.classList.contains("CodeMirror")) {
            const cmInstance = element.CodeMirror || element._codeMirror;
            if (cmInstance) {
              this.editor = cmInstance;
              this.debug("CodeMirror instance found");
              return;
            }
          }

          if (element.tagName === "TEXTAREA") {
            this.debug("Using textarea directly");
            return;
          }
        }
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  isConflictPage() {
    const indicators = [
      window.location.href.includes("/conflicts"),
      window.location.href.includes("/resolve"),
      document.querySelector(".file-editor-textarea") !== null,
      document.title.includes("conflict"),
    ];
    return indicators.some((indicator) => indicator);
  }

  setupHelper() {
    this.debug("Setting up merge conflict helper...");
    this.addButtons();
    this.updateConflictStatus();
  }

  addButtons() {
    this.debug("Adding buttons...");

    const existing = document.querySelector(".merge-helper-buttons");
    if (existing) existing.remove();

    const insertionTargets = [".file-header", ".Box-header", "main"];
    let insertionPoint = null;

    for (const selector of insertionTargets) {
      const element = document.querySelector(selector);
      if (element) {
        insertionPoint = element;
        break;
      }
    }

    if (!insertionPoint) return;

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "merge-helper-buttons";
    buttonContainer.style.cssText = `
            padding: 12px 16px;
            background: ${this.token ? "#d4edda" : "#fff3cd"};
            border: 1px solid ${this.token ? "#c3e6cb" : "#ffeaa7"};
            border-radius: 6px;
            margin: 12px 0;
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        `;

    const tokenStatus = this.token
      ? "🔑 PAT Configured"
      : "⚠️ PAT Required for API calls";

    buttonContainer.innerHTML = `
            <div style="font-weight: 600; color: #24292f; margin-right: 12px;">
                🔧 Merge Conflict Helper - ${tokenStatus}
            </div>
            ${
              this.token
                ? `
                <button class="btn btn-sm merge-helper-current" style="
                    background: #28a745; color: white; border: none; 
                    padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
                ">Accept All Current (API)</button>
                <button class="btn btn-sm merge-helper-incoming" style="
                    background: #0366d6; color: white; border: none; 
                    padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
                ">Accept All Incoming (API)</button>
            `
                : ""
            }
            <button class="btn btn-sm merge-helper-current-dom" style="
                background: #ffc107; color: #212529; border: none; 
                padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
            ">Accept Current (DOM)</button>
            <button class="btn btn-sm merge-helper-incoming-dom" style="
                background: #ffc107; color: #212529; border: none; 
                padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
            ">Accept Incoming (DOM)</button>
            <button class="btn btn-sm merge-helper-token" style="
                background: #6f42c1; color: white; border: none; 
                padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
            ">${this.token ? "Update" : "Set"} PAT</button>
            <button class="btn btn-sm merge-helper-debug" style="
                background: #6c757d; color: white; border: none; 
                padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
            ">Debug</button>
            <span class="merge-helper-status" style="
                margin-left: 12px; color: #586069; font-weight: 500;
            ">Ready to resolve conflicts</span>
        `;

    insertionPoint.insertAdjacentElement(
      insertionPoint.classList.contains("file-header")
        ? "afterend"
        : "afterbegin",
      buttonContainer
    );

    this.attachEventListeners(buttonContainer);
  }

  attachEventListeners(container) {
    // API-based resolution (requires PAT)
    const currentApiBtn = container.querySelector(".merge-helper-current");
    const incomingApiBtn = container.querySelector(".merge-helper-incoming");

    if (currentApiBtn && incomingApiBtn) {
      currentApiBtn.addEventListener("click", () =>
        this.resolveConflictsViaAPI("current")
      );
      incomingApiBtn.addEventListener("click", () =>
        this.resolveConflictsViaAPI("incoming")
      );
    }

    // DOM-based resolution (fallback)
    const currentDomBtn = container.querySelector(".merge-helper-current-dom");
    const incomingDomBtn = container.querySelector(
      ".merge-helper-incoming-dom"
    );
    const tokenBtn = container.querySelector(".merge-helper-token");
    const debugBtn = container.querySelector(".merge-helper-debug");

    if (currentDomBtn)
      currentDomBtn.addEventListener("click", () =>
        this.resolveAllConflicts("current")
      );
    if (incomingDomBtn)
      incomingDomBtn.addEventListener("click", () =>
        this.resolveAllConflicts("incoming")
      );
    if (tokenBtn)
      tokenBtn.addEventListener("click", () => this.showTokenDialog());
    if (debugBtn)
      debugBtn.addEventListener("click", () => this.showDebugInfo());
  }

  async resolveConflictsViaAPI(choice) {
    if (!this.token) {
      this.updateStatus("❌ GitHub token required for API calls", "error");
      this.showTokenDialog();
      return;
    }

    if (!this.repoInfo || !this.prInfo) {
      this.updateStatus("❌ Could not extract repo/PR information", "error");
      return;
    }

    try {
      this.updateStatus("🔄 Resolving conflicts via GitHub API...", "info");

      // Get the current file content and resolve conflicts
      const content = this.getContent();
      const resolvedContent = this.processConflicts(content, choice);

      // Get detailed PR information
      const prData = await this.githubApiCall(
        `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/pulls/${this.prInfo.number}`
      );

      this.debug("PR Data:", {
        head: prData.head.ref,
        base: prData.base.ref,
        headSha: prData.head.sha,
        baseSha: prData.base.sha,
      });

      // Get the file path from the current page
      let filePath = this.extractFilePath();
      if (!filePath) {
        filePath = await this.promptForFilePath();
        if (!filePath) {
          throw new Error("File path is required for API resolution");
        }
      }

      this.debug("Using file path:", filePath);

      // Method 1: Try to create a merge commit that resolves conflicts
      try {
        await this.createMergeCommitWithResolution(
          prData,
          filePath,
          resolvedContent,
          choice
        );
        this.updateStatus(
          `✅ Merge conflict resolved via API (${choice})`,
          "success"
        );
      } catch (mergeError) {
        this.debug(
          "Merge commit failed, trying file update method:",
          mergeError
        );

        // Method 2: Fallback to direct file update
        await this.createResolvedCommit(
          prData.head.ref,
          filePath,
          resolvedContent,
          choice
        );
        this.updateStatus(
          `✅ File updated via API (${choice}) - May need manual merge`,
          "warning"
        );
      }

      // Refresh the page to show the resolved state
      setTimeout(() => {
        this.updateStatus(
          "🔄 Refreshing page to check conflict status...",
          "info"
        );
        window.location.reload();
      }, 2000);
    } catch (error) {
      this.debug("API resolution error:", error);
      this.updateStatus(`❌ API resolution failed: ${error.message}`, "error");
    }
  }

  async createMergeCommitWithResolution(
    prData,
    filePath,
    resolvedContent,
    choice
  ) {
    this.debug("Attempting to create merge commit...");

    // First, try GitHub's merge API to see if we can merge automatically
    try {
      const mergeResult = await this.githubApiCall(
        `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/merges`,
        {
          method: "POST",
          body: JSON.stringify({
            base: prData.head.ref, // Merge INTO the head branch
            head: prData.base.ref, // FROM the base branch
            commit_message: `Resolve merge conflicts in ${filePath} (accept ${choice})`,
          }),
        }
      );

      this.debug("Merge API successful:", mergeResult);
      return mergeResult;
    } catch (mergeError) {
      this.debug(
        "Merge API failed (expected for conflicts):",
        mergeError.message
      );

      // If merge fails due to conflicts, we need to create a commit that resolves them
      // This is more complex and requires creating a tree with resolved content
      return await this.createResolutionCommit(
        prData,
        filePath,
        resolvedContent,
        choice
      );
    }
  }

  async createResolutionCommit(prData, filePath, resolvedContent, choice) {
    this.debug("Creating resolution commit...");

    // Get the current tree from the head commit
    const headCommit = await this.githubApiCall(
      `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/commits/${prData.head.sha}`
    );

    // Get the base tree
    const baseTree = await this.githubApiCall(
      `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/trees/${headCommit.tree.sha}?recursive=1`
    );

    // Create a new tree with the resolved file content
    const newTreeData = {
      base_tree: headCommit.tree.sha,
      tree: [
        {
          path: filePath,
          mode: "100644",
          type: "blob",
          content: resolvedContent,
        },
      ],
    };

    const newTree = await this.githubApiCall(
      `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/trees`,
      {
        method: "POST",
        body: JSON.stringify(newTreeData),
      }
    );

    // Create a merge commit with both parents
    const commitData = {
      message: `Resolve merge conflicts in ${filePath} (accept ${choice})`,
      tree: newTree.sha,
      parents: [prData.head.sha, prData.base.sha], // This makes it a merge commit
    };

    const newCommit = await this.githubApiCall(
      `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify(commitData),
      }
    );

    // Update the head branch to point to the new commit
    await this.githubApiCall(
      `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/heads/${prData.head.ref}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sha: newCommit.sha,
          force: false,
        }),
      }
    );

    this.debug("Resolution commit created:", newCommit.sha);
    return newCommit;
  }

  extractFilePath() {
    this.debug("Extracting file path...");

    // Method 1: Look for file path in various header elements
    const selectors = [
      ".file-header .file-info .text-mono", // GitHub's typical file path location
      ".file-header [title]",
      ".js-file-header .file-info",
      ".file-header .file-info",
      ".Box-header .text-mono",
      ".file-header-text",
      ".file-header .flex-auto",
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        const title = element.getAttribute("title");

        // Check text content
        if (text && (text.includes("/") || text.includes("."))) {
          this.debug(`Found file path via selector ${selector}:`, text);
          return text;
        }

        // Check title attribute
        if (title && (title.includes("/") || title.includes("."))) {
          this.debug(`Found file path via title ${selector}:`, title);
          return title;
        }
      }
    }

    // Method 2: Look in URL hash or query parameters
    const urlMatch = window.location.hash.match(/#diff-[a-f0-9]+-(.+)/);
    if (urlMatch) {
      const filePath = decodeURIComponent(urlMatch[1]);
      this.debug("Found file path in URL hash:", filePath);
      return filePath;
    }

    // Method 3: Look for data attributes that might contain file info
    const dataElements = document.querySelectorAll(
      "[data-path], [data-file-path], [data-filename]"
    );
    for (const element of dataElements) {
      const path =
        element.getAttribute("data-path") ||
        element.getAttribute("data-file-path") ||
        element.getAttribute("data-filename");
      if (path) {
        this.debug("Found file path in data attribute:", path);
        return path;
      }
    }

    // Method 4: Look in the document title or meta tags
    const titleMatch = document.title.match(/([^\/]+\.[^\/\s]+)/);
    if (titleMatch) {
      this.debug("Found potential file path in title:", titleMatch[1]);
      return titleMatch[1];
    }

    // Method 5: Try to find it in the page content
    const codeElements = document.querySelectorAll("code, .text-mono, .f6");
    for (const element of codeElements) {
      const text = element.textContent?.trim();
      if (text && text.match(/^[a-zA-Z0-9._\/-]+\.[a-zA-Z0-9]+$/)) {
        this.debug("Found potential file path in code element:", text);
        return text;
      }
    }

    // Method 6: Debug - log all potential file-related elements
    this.debug("File path extraction failed, debugging...");
    this.debugFilePathElements();

    return null;
  }

  debugFilePathElements() {
    this.debug("=== File Path Debug Info ===");
    this.debug("Current URL:", window.location.href);
    this.debug("Page title:", document.title);

    // Log all elements that might contain file paths
    const potentialElements = document.querySelectorAll(
      '.file-header, .Box-header, [class*="file"], [class*="path"]'
    );
    potentialElements.forEach((element, index) => {
      this.debug(`Element ${index}:`, {
        tagName: element.tagName,
        className: element.className,
        textContent: element.textContent?.trim().substring(0, 100),
        title: element.getAttribute("title"),
        innerHTML: element.innerHTML.substring(0, 200),
      });
    });

    // Also check for any obvious file names in the entire document
    const allText = document.body.textContent;
    const fileMatches = allText.match(
      /[a-zA-Z0-9._-]+\.(js|ts|css|html|json|md|txt|py|java|cpp|c|h|yml|yaml|xml|php|rb|go|rs|swift|kt|scala)/g
    );
    if (fileMatches) {
      this.debug(
        "Potential file names found in page:",
        [...new Set(fileMatches)].slice(0, 10)
      );
    }
  }

  async createResolvedCommit(branch, filePath, content, choice) {
    // Get the current file's SHA
    const fileData = await this.githubApiCall(
      `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/contents/${filePath}?ref=${branch}`
    );

    // Update the file with resolved content
    const updateData = {
      message: `Resolve merge conflict in ${filePath} (accept ${choice})`,
      content: btoa(unescape(encodeURIComponent(content))), // Base64 encode
      sha: fileData.sha,
      branch: branch,
    };

    await this.githubApiCall(
      `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/contents/${filePath}`,
      {
        method: "PUT",
        body: JSON.stringify(updateData),
      }
    );
  }

  showTokenDialog() {
    const modal = document.createElement("div");
    modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;

    modal.innerHTML = `
            <div style="
                background: white; border-radius: 8px; padding: 24px; 
                max-width: 500px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            ">
                <h3 style="margin: 0 0 16px 0; color: #24292f;">GitHub Personal Access Token</h3>
                <p style="margin: 0 0 16px 0; color: #586069; line-height: 1.5;">
                    To properly resolve conflicts via GitHub's API, you need a Personal Access Token with 
                    <code>repo</code> scope.
                </p>
                <div style="margin: 12px 0;">
                    <a href="https://github.com/settings/tokens/new?scopes=repo&description=Merge%20Conflict%20Helper" 
                       target="_blank" style="
                        display: inline-block; background: #0366d6; color: white; 
                        padding: 8px 16px; border-radius: 6px; text-decoration: none; 
                        font-weight: 500; margin-bottom: 12px;
                    ">Create Token on GitHub</a>
                </div>
                <input type="password" placeholder="Paste your token here..." style="
                    width: 100%; padding: 8px 12px; border: 1px solid #d1d9e0; 
                    border-radius: 6px; font-family: monospace; margin: 8px 0;
                " id="token-input">
                <div style="display: flex; gap: 8px; margin-top: 16px;">
                    <button id="save-token" style="
                        background: #28a745; color: white; border: none; 
                        padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;
                    ">Save Token</button>
                    <button id="cancel-token" style="
                        background: #6c757d; color: white; border: none; 
                        padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;
                    ">Cancel</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    const input = modal.querySelector("#token-input");
    const saveBtn = modal.querySelector("#save-token");
    const cancelBtn = modal.querySelector("#cancel-token");

    if (this.token) {
      input.value = this.token;
    }

    saveBtn.onclick = async () => {
      const token = input.value.trim();
      if (token) {
        await this.saveToken(token);
        this.updateStatus("✅ Token saved successfully", "success");
        modal.remove();
        // Refresh the buttons to show API options
        this.addButtons();
      }
    };

    cancelBtn.onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    input.focus();
  }

  // Keep existing DOM-based methods as fallback
  getContent() {
    if (this.editor) {
      return this.editor.getValue();
    }

    const selectors = [
      ".file-editor-textarea",
      ".js-file-editor-textarea",
      "textarea[name*='file']",
      "textarea",
    ];

    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea && textarea.value) {
        return textarea.value;
      }
    }
    return "";
  }

  hasConflicts() {
    const content = this.getContent();
    return (
      content.includes("<<<<<<<") &&
      content.includes("=======") &&
      content.includes(">>>>>>>")
    );
  }

  getConflictCount() {
    const content = this.getContent();
    const conflicts = content.match(/<<<<<<</g);
    return conflicts ? conflicts.length : 0;
  }

  processConflicts(content, choice) {
    const lines = content.split("\n");
    const resolvedLines = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith("<<<<<<<")) {
        const { middleIndex, endIndex } = this.findConflictBoundaries(lines, i);

        if (middleIndex !== -1 && endIndex !== -1) {
          if (choice === "current") {
            for (let k = i + 1; k < middleIndex; k++) {
              resolvedLines.push(lines[k]);
            }
          } else {
            for (let k = middleIndex + 1; k < endIndex; k++) {
              resolvedLines.push(lines[k]);
            }
          }
          i = endIndex + 1;
        } else {
          resolvedLines.push(line);
          i++;
        }
      } else {
        resolvedLines.push(line);
        i++;
      }
    }

    return resolvedLines.join("\n");
  }

  findConflictBoundaries(lines, startIndex) {
    let middleIndex = -1;
    let endIndex = -1;

    for (let j = startIndex + 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (line === "=======") {
        middleIndex = j;
      } else if (line.startsWith(">>>>>>>")) {
        endIndex = j;
        break;
      }
    }

    return { middleIndex, endIndex };
  }

  resolveAllConflicts(choice) {
    this.debug(`DOM-based resolution: ${choice}`);
    const content = this.getContent();

    if (!content.includes("<<<<<<<")) {
      this.updateStatus("No conflicts found", "warning");
      return;
    }

    const resolvedContent = this.processConflicts(content, choice);
    this.updateContentSafely(resolvedContent);
    this.updateStatus(
      `✅ DOM updated (${choice}) - Use API method for GitHub recognition`,
      "info"
    );
  }

  updateContentSafely(content) {
    const textareaSelectors = [
      ".file-editor-textarea",
      ".js-file-editor-textarea",
      "textarea[name*='file']",
      "textarea",
    ];

    for (const selector of textareaSelectors) {
      const textarea = document.querySelector(selector);
      if (textarea) {
        textarea.value = content;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    setTimeout(() => this.updateConflictStatus(), 100);
  }

  updateConflictStatus() {
    const hasConflicts = this.hasConflicts();
    const conflictCount = this.getConflictCount();
    const status = document.querySelector(".merge-helper-status");

    if (status) {
      if (hasConflicts) {
        status.textContent = `${conflictCount} conflict${
          conflictCount === 1 ? "" : "s"
        } detected`;
        status.style.color = "#d73a49";
      } else {
        status.textContent = "No conflicts detected";
        status.style.color = "#28a745";
      }
    }
  }

  showDebugInfo() {
    const content = this.getContent();
    const debugInfo = {
      hasToken: !!this.token,
      repoInfo: this.repoInfo,
      prInfo: this.prInfo,
      currentContent: content.substring(0, 200),
      hasConflicts: this.hasConflicts(),
      conflictCount: this.getConflictCount(),
    };

    console.log("Debug Info:", debugInfo);
    alert(`Debug Info:\n${JSON.stringify(debugInfo, null, 2)}`);
  }

  updateStatus(message, type = "info") {
    const status = document.querySelector(".merge-helper-status");
    if (status) {
      status.textContent = message;

      switch (type) {
        case "success":
          status.style.color = "#28a745";
          break;
        case "warning":
          status.style.color = "#f66a0a";
          break;
        case "error":
          status.style.color = "#d73a49";
          break;
        default:
          status.style.color = "#586069";
      }
    }
  }
}

// Initialize
try {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => new MergeConflictHelper()
    );
  } else {
    new MergeConflictHelper();
  }
} catch (error) {
  console.error("[Merge Helper] Initialization error:", error);
}
