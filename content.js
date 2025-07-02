// GitHub Merge Conflict Helper - Minimal Safe Approach
// Only updates content without interfering with CodeMirror's internal state
class MergeConflictHelper {
  constructor() {
    // Set debug mode based on extension manifest version or development detection
    this.debugMode = this.isDevelopmentMode();
    this.init();
    this.setupMessageListener();
  }
  isDevelopmentMode() {
    // Simple debug control - change this for development vs production
    // For development: set to true
    // For production: set to false
    const DEBUG_MODE = true; // ← Change this to false for production releases

    try {
      // You can also check version patterns if needed
      if (chrome.runtime && chrome.runtime.getManifest) {
        const manifest = chrome.runtime.getManifest();

        // Uncomment the line below and comment out DEBUG_MODE
        // return manifest.version.endsWith('.0'); // Debug for .0 versions, production for .1+ versions
      }

      return DEBUG_MODE;
    } catch (error) {
      // If we can't determine, default to false for safety
      return false;
    }
  }

  debug(message, data = null) {
    if (this.debugMode) {
      console.log(`[Merge Helper] ${message}`, data || "");
    }
  }

  setupMessageListener() {
    this.messageListener = (request, sender, sendResponse) => {
      if (request.action === "checkConflicts") {
        const hasConflicts = this.hasConflicts();
        const conflictCount = this.getConflictCount();
        sendResponse({
          hasConflicts: hasConflicts,
          conflictCount: conflictCount,
        });
      }
    };
    chrome.runtime.onMessage.addListener(this.messageListener);
  }

  async init() {
    this.debug("Initializing...");
    await this.waitForPageLoad();
    this.setupDOMObserver();
    this.startPeriodicCheck();

    if (this.isConflictPage()) {
      this.debug("Conflict page detected, setting up helper...");
      const elementsFound = await this.waitForElements();
      this.debug("Elements found:", elementsFound);
      await this.setupHelper();
    } else {
      this.debug("Not a conflict page, skipping setup");
    }
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

  async waitForElements() {
    this.debug("Looking for conflict elements...");
    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const selectors = [
        ".CodeMirror",
        ".file-editor-textarea",
        "textarea[data-testid='file-editor-textarea']",
        ".merge-editor",
        "[data-testid='merge-editor']",
        ".js-file-line-container",
        ".blob-wrapper",
        ".js-code-editor",
        "textarea",
      ];

      let foundElement = null;
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          foundElement = selector;
          break;
        }
      }

      this.debug(`Attempt ${attempts + 1}: Looking for elements...`, {
        found: foundElement,
        availableTextareas: document.querySelectorAll("textarea").length,
        availableCodeMirror: document.querySelectorAll(".CodeMirror").length,
      });

      if (foundElement) {
        this.debug("Found conflict editor elements:", foundElement);
        return true;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.debug("Timeout waiting for elements, proceeding anyway...");
    return false;
  }

  async waitForContent() {
    this.debug("Waiting for conflict content to load...");
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const content = this.getContent();
      this.debug(
        `Content check attempt ${attempts + 1}: ${content.length} characters`,
        {
          hasConflictMarkers: content.includes("<<<<<<<"),
          contentPreview: content.substring(0, 100),
        }
      );

      if (content && content.length > 0) {
        this.debug("Content found, updating status...");
        return true;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    this.debug("Timeout waiting for content");
    return false;
  }

  isConflictPage() {
    // Check URL patterns
    const url = window.location.href;
    const hasConflictURL =
      url.includes("/conflicts") ||
      url.includes("/edit/") ||
      url.includes("/merge") ||
      url.match(/\/pull\/\d+\/files/);

    // Check for conflict-related elements
    const hasConflictElements =
      document.querySelector(".file-editor-textarea") !== null ||
      document.querySelector(".CodeMirror") !== null ||
      document.querySelector("[data-testid='merge-editor']") !== null;

    // Check page title
    const hasConflictTitle =
      document.title.includes("conflict") ||
      document.title.includes("merge") ||
      document.title.includes("edit");

    // Check for conflict markers in any text content
    const pageText = document.body.textContent || "";
    const hasConflictMarkers =
      pageText.includes("<<<<<<<") ||
      pageText.includes(">>>>>>>") ||
      pageText.includes("=======");

    const isConflict =
      hasConflictURL ||
      hasConflictElements ||
      hasConflictTitle ||
      hasConflictMarkers;

    this.debug("Conflict page detection:", {
      url: hasConflictURL,
      elements: hasConflictElements,
      title: hasConflictTitle,
      markers: hasConflictMarkers,
      result: isConflict,
    });

    return isConflict;
  }

  isConflictPageQuiet() {
    const url = window.location.href;
    const hasConflictURL =
      url.includes("/conflicts") ||
      url.includes("/edit/") ||
      url.includes("/merge") ||
      url.match(/\/pull\/\d+\/files/);

    const hasConflictElements =
      document.querySelector(
        ".file-editor-textarea, .CodeMirror, [data-testid='merge-editor']"
      ) !== null;

    return hasConflictURL || hasConflictElements;
  }

  async setupHelper() {
    this.debug("Setting up helper...");
    this.detectBranches();
    this.addButtons();
    this.setupContentObserver();

    // Wait for content to load before checking conflicts
    const contentLoaded = await this.waitForContent();
    if (contentLoaded) {
      this.updateConflictStatus();
    } else {
      // Fallback: try again after longer delay
      setTimeout(() => {
        this.updateConflictStatus();
      }, 2000);
    }
  }

  detectBranches() {
    this.debug("Detecting branch information...");

    // Method 1: Try to extract from conflict markers in content
    const content = this.getContent();
    const lines = content.split("\n");

    let currentBranch = "current";
    let incomingBranch = "incoming";

    for (const line of lines) {
      // Look for conflict start marker: <<<<<<< branch-name
      const startMatch = line.match(/^<<<<<<< (.+)$/);
      if (startMatch) {
        currentBranch = startMatch[1].trim();
        this.debug("Found current branch from conflict marker:", currentBranch);
      }

      // Look for conflict end marker: >>>>>>> branch-name
      const endMatch = line.match(/^>>>>>>> (.+)$/);
      if (endMatch) {
        incomingBranch = endMatch[1].trim();
        this.debug(
          "Found incoming branch from conflict marker:",
          incomingBranch
        );
      }
    }

    // Method 2: Try to extract from page elements
    if (currentBranch === "current" || incomingBranch === "incoming") {
      this.detectBranchesFromPage();
    }

    // Method 3: Try to extract from URL
    if (currentBranch === "current" || incomingBranch === "incoming") {
      this.detectBranchesFromURL();
    }

    this.currentBranch = currentBranch;
    this.incomingBranch = incomingBranch;

    this.debug("Branch detection result:", {
      current: this.currentBranch,
      incoming: this.incomingBranch,
    });
  }

  detectBranchesFromPage() {
    // Try to find branch names in the page DOM
    const selectors = [
      ".branch-name",
      ".js-branch-name",
      "[data-branch]",
      ".head-ref",
      ".base-ref",
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length >= 2) {
        this.currentBranch = elements[0].textContent?.trim() || "current";
        this.incomingBranch = elements[1].textContent?.trim() || "incoming";
        this.debug(
          "Found branches from page elements:",
          this.currentBranch,
          this.incomingBranch
        );
        return;
      }
    }

    // Try to find in page text
    const pageText = document.body.textContent;
    const branchMatch = pageText.match(/merge\s+([^\s]+)\s+into\s+([^\s]+)/i);
    if (branchMatch) {
      this.incomingBranch = branchMatch[1];
      this.currentBranch = branchMatch[2];
      this.debug(
        "Found branches from page text:",
        this.currentBranch,
        this.incomingBranch
      );
    }
  }

  detectBranchesFromURL() {
    // Extract from URL if possible
    const url = window.location.href;
    const match = url.match(/\/pull\/\d+/);
    if (match) {
      // This is a PR conflict page, try to find branch info in the page title or meta
      const title = document.title;
      const titleMatch = title.match(/(.+)\s+by\s+(.+)/);
      if (titleMatch) {
        this.debug("Found potential branch info in title");
      }
    }
  }

  formatBranchName(branchName) {
    // Clean up branch name for display
    if (!branchName || branchName === "current" || branchName === "incoming") {
      return branchName;
    }

    // Remove common prefixes
    const cleaned = branchName
      .replace(/^(origin\/|refs\/heads\/|refs\/remotes\/)/, "")
      .replace(/^HEAD$/, "current");

    // Truncate if too long
    return cleaned.length > 20 ? cleaned.substring(0, 17) + "..." : cleaned;
  }

  addButtons() {
    this.debug("Adding buttons...");

    const existing = document.querySelector(".merge-helper-buttons");
    if (existing) {
      this.debug("Buttons already exist, removing old ones");
      existing.remove();
    }

    // Expanded list of possible insertion targets
    const insertionTargets = [
      ".file-header",
      ".Box-header",
      ".file-navigation",
      ".js-file-header",
      ".repository-content",
      ".application-main",
      "main",
      "body",
    ];

    let insertionPoint = null;

    for (const selector of insertionTargets) {
      const element = document.querySelector(selector);
      if (element) {
        insertionPoint = element;
        this.debug("Found insertion point:", selector);
        break;
      }
    }

    if (!insertionPoint) {
      this.debug("No insertion point found, cannot add buttons");
      return;
    }

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "merge-helper-buttons";
    buttonContainer.style.cssText = `
            padding: 12px 16px;
            background: #1e1e1e;
            border: 1px solid #333;
            border-radius: 6px;
            margin: 12px 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            position: relative;
            z-index: 1000;
        `;

    const currentDisplay = this.formatBranchName(this.currentBranch);
    const incomingDisplay = this.formatBranchName(this.incomingBranch);

    buttonContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: 600; color: #58a6ff;">
                    🔧 Conflict Helper
                </div>
                <span class="merge-helper-status" style="
                    color: #f0883e; font-weight: 500;
                ">Ready to resolve conflicts</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-sm merge-helper-current" style="
                    background: #238636; color: white; border: none; 
                    padding: 6px 12px; border-radius: 4px; font-weight: 500; cursor: pointer;
                    font-size: 12px; white-space: nowrap;
                ">Accept All Current ${
                  currentDisplay ? `(${currentDisplay})` : ""
                }</button>
                <button class="btn btn-sm merge-helper-incoming" style="
                    background: #1f6feb; color: white; border: none; 
                    padding: 6px 12px; border-radius: 4px; font-weight: 500; cursor: pointer;
                    font-size: 12px; white-space: nowrap;
                ">Accept All Incoming ${
                  incomingDisplay ? `(${incomingDisplay})` : ""
                }</button>
                <button class="btn btn-sm merge-helper-both" style="
                    background: #8957e5; color: white; border: none; 
                    padding: 6px 12px; border-radius: 4px; font-weight: 500; cursor: pointer;
                    font-size: 12px;
                ">Keep Both</button>
                <button class="btn btn-sm merge-helper-show" style="
                    background: #f0883e; color: white; border: none; 
                    padding: 6px 12px; border-radius: 4px; font-weight: 500; cursor: pointer;
                    font-size: 12px;
                ">Show Resolved</button>
            </div>
        `;

    // Try different insertion strategies
    try {
      if (insertionPoint.classList.contains("file-header")) {
        insertionPoint.insertAdjacentElement("afterend", buttonContainer);
      } else if (
        insertionPoint.tagName === "MAIN" ||
        insertionPoint.classList.contains("application-main")
      ) {
        insertionPoint.insertAdjacentElement("afterbegin", buttonContainer);
      } else {
        insertionPoint.insertAdjacentElement("afterbegin", buttonContainer);
      }

      this.debug("Buttons added successfully");
      this.attachEventListeners(buttonContainer);
    } catch (error) {
      this.debug("Error adding buttons:", error);
    }
  }

  attachEventListeners(container) {
    const currentBtn = container.querySelector(".merge-helper-current");
    const incomingBtn = container.querySelector(".merge-helper-incoming");
    const bothBtn = container.querySelector(".merge-helper-both");
    const showBtn = container.querySelector(".merge-helper-show");

    if (currentBtn)
      currentBtn.addEventListener("click", () =>
        this.resolveConflicts("current")
      );
    if (incomingBtn)
      incomingBtn.addEventListener("click", () =>
        this.resolveConflicts("incoming")
      );
    if (bothBtn)
      bothBtn.addEventListener("click", () => this.resolveConflicts("both"));
    if (showBtn)
      showBtn.addEventListener("click", () => this.showResolvedContent());
  }

  resolveConflicts(choice) {
    this.debug(`Resolving conflicts: ${choice}`);

    const content = this.getContent();
    if (!content.includes("<<<<<<<")) {
      this.updateStatus("No conflicts found", "warning");
      return;
    }

    const resolvedContent = this.processConflicts(content, choice);

    // Store resolved content
    this.resolvedContent = resolvedContent;

    // Automatically copy to clipboard
    this.copyToClipboard(resolvedContent, choice);
  }

  async copyToClipboard(content, choice) {
    try {
      await navigator.clipboard.writeText(content);
      this.updateStatus(
        `✅ Resolved (${choice}) & copied! Just paste (Ctrl+V) in the editor`,
        "success"
      );
      this.showCopySuccess(choice);
    } catch (error) {
      this.debug("Clipboard API failed, trying fallback:", error);
      this.fallbackCopy(content, choice);
    }
  }

  fallbackCopy(content, choice) {
    // Fallback copy method for browsers that don't support clipboard API
    const textArea = document.createElement("textarea");
    textArea.value = content;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        this.updateStatus(
          `✅ Resolved (${choice}) & copied! Just paste (Ctrl+V) in the editor`,
          "success"
        );
        this.showCopySuccess(choice);
      } else {
        throw new Error("execCommand failed");
      }
    } catch (err) {
      this.debug("Fallback copy failed:", err);
      this.updateStatus(
        `✅ Resolved (${choice}) but copy failed - use "Show Resolved" button`,
        "warning"
      );
      this.resolvedContent = content; // Store for manual copy
    }

    document.body.removeChild(textArea);
  }

  showCopySuccess(choice) {
    // Show a temporary visual confirmation
    let successMessage = document.querySelector(".merge-helper-copy-success");

    if (!successMessage) {
      successMessage = document.createElement("div");
      successMessage.className = "merge-helper-copy-success";
      successMessage.style.cssText = `
                background: #1e1e1e;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 12px 16px;
                margin: 12px 0;
                color: #58a6ff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                display: flex;
                align-items: center;
                gap: 8px;
            `;

      // Insert after our buttons
      const buttons = document.querySelector(".merge-helper-buttons");
      if (buttons) {
        buttons.insertAdjacentElement("afterend", successMessage);
      }
    }

    successMessage.innerHTML = `
            <span style="font-size: 18px;">📋</span>
            <div>
                <strong style="color: #238636;">Content copied to clipboard!</strong><br>
                <span style="font-size: 14px; color: #c9d1d9;">
                    1. Click in the GitHub editor<br>
                    2. Select all (Ctrl+A)<br>
                    3. Paste (Ctrl+V)<br>
                    4. Click "Mark as resolved"
                </span>
            </div>
        `;

    // Auto-hide the message after 10 seconds
    setTimeout(() => {
      if (successMessage.parentElement) {
        successMessage.remove();
      }
    }, 10000);
  }

  showResolvedContent() {
    if (!this.resolvedContent) {
      this.updateStatus(
        "No resolved content available - click an Accept button first",
        "warning"
      );
      return;
    }

    // Create or update the display area
    let displayArea = document.querySelector(".merge-helper-display");

    if (!displayArea) {
      displayArea = document.createElement("div");
      displayArea.className = "merge-helper-display";
      displayArea.style.cssText = `
                background: #1e1e1e;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 16px;
                margin: 12px 0;
                font-family: monospace;
                white-space: pre-wrap;
                max-height: 400px;
                overflow-y: auto;
                position: relative;
                color: #c9d1d9;
            `;

      // Insert after our buttons or success message
      const buttons = document.querySelector(".merge-helper-buttons");
      const successMsg = document.querySelector(".merge-helper-copy-success");
      const insertAfter = successMsg || buttons;
      if (insertAfter) {
        insertAfter.insertAdjacentElement("afterend", displayArea);
      }
    }

    displayArea.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <strong style="color: #238636;">Resolved Content:</strong>
                <div style="display: flex; gap: 8px;">
                    <button id="copy-resolved" style="
                        background: #238636; color: white; border: none; 
                        padding: 4px 8px; border-radius: 4px; cursor: pointer;
                    ">Copy Again</button>
                    <button id="hide-resolved" style="
                        background: #6c757d; color: white; border: none; 
                        padding: 4px 8px; border-radius: 4px; cursor: pointer;
                    ">Hide</button>
                </div>
            </div>
            <div style="
                background: #161b22; 
                border: 1px solid #333; 
                border-radius: 4px; 
                padding: 12px; 
                font-size: 14px;
                line-height: 1.4;
                color: #c9d1d9;
                font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', monospace;
            ">${this.escapeHtml(this.resolvedContent)}</div>
        `;

    // Add copy functionality
    const copyBtn = displayArea.querySelector("#copy-resolved");
    const hideBtn = displayArea.querySelector("#hide-resolved");

    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        this.copyToClipboard(this.resolvedContent, "manual");
      });
    }

    if (hideBtn) {
      hideBtn.addEventListener("click", () => {
        displayArea.remove();
      });
    }
  }

  fallbackCopy() {
    // Fallback copy method
    const textArea = document.createElement("textarea");
    textArea.value = this.resolvedContent;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand("copy");
      this.updateStatus("✅ Content copied to clipboard", "success");
    } catch (err) {
      this.updateStatus(
        "❌ Copy failed - please select and copy manually",
        "error"
      );
    }

    document.body.removeChild(textArea);
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
          } else if (choice === "incoming") {
            for (let k = middleIndex + 1; k < endIndex; k++) {
              resolvedLines.push(lines[k]);
            }
          } else if (choice === "both") {
            for (let k = i + 1; k < middleIndex; k++) {
              resolvedLines.push(lines[k]);
            }
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

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  getContent() {
    // Try to get content safely without breaking CodeMirror
    const textarea = document.querySelector(".file-editor-textarea");
    if (textarea && textarea.value) {
      return textarea.value;
    }

    // Try CodeMirror content
    const codeMirror = document.querySelector(".CodeMirror");
    if (codeMirror && codeMirror.CodeMirror) {
      const content = codeMirror.CodeMirror.getValue();
      if (content) {
        return content;
      }
    }

    // Fallback: try other textareas that have content
    const allTextareas = document.querySelectorAll("textarea");
    for (const ta of allTextareas) {
      if (ta.value && ta.value.trim()) {
        return ta.value;
      }
    }

    // Last resort: try to find content in the DOM
    const blobWrapper = document.querySelector(".blob-wrapper");
    if (blobWrapper) {
      const textContent = blobWrapper.textContent || "";
      if (textContent.includes("<<<<<<<")) {
        return textContent;
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

  updateConflictStatus() {
    const hasConflicts = this.hasConflicts();
    const conflictCount = this.getConflictCount();
    const status = document.querySelector(".merge-helper-status");

    if (status) {
      if (hasConflicts) {
        status.textContent = `${conflictCount} conflict${
          conflictCount === 1 ? "" : "s"
        } detected`;
        status.style.color = "#f0883e";
      } else {
        status.textContent = "No conflicts detected";
        status.style.color = "#238636";
      }
    }
  }

  updateStatus(message, type = "info") {
    const status = document.querySelector(".merge-helper-status");
    if (status) {
      status.textContent = message;

      switch (type) {
        case "success":
          status.style.color = "#238636";
          break;
        case "warning":
          status.style.color = "#f0883e";
          break;
        case "error":
          status.style.color = "#da3633";
          break;
        default:
          status.style.color = "#f0883e";
      }
    }
  }
  cleanup() {
    this.debug("Cleaning up merge conflict helper...");

    // Stop periodic check
    this.stopPeriodicCheck();

    // Remove DOM observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Remove content observer
    if (this.contentObserver) {
      this.contentObserver.disconnect();
      this.contentObserver = null;
    }

    // Remove any elements we added
    const elementsToRemove = [
      ".merge-helper-buttons",
      ".merge-helper-status",
      ".merge-helper-copy-success",
      ".merge-helper-resolved-content",
    ];

    elementsToRemove.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    });

    // Clear any stored data
    this.resolvedContent = null;

    // Remove message listener
    if (this.messageListener && chrome.runtime.onMessage.hasListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
    }
  }

  startPeriodicCheck() {
    // Fallback: periodically check if we're on a conflict page without buttons
    this.periodicCheck = setInterval(async () => {
      // Only check if we don't already have buttons
      if (!document.querySelector(".merge-helper-buttons")) {
        // Use a lighter check to avoid excessive logging
        const url = window.location.href;
        const hasConflictURL =
          url.includes("/conflicts") ||
          url.includes("/edit/") ||
          url.includes("/merge");

        if (
          hasConflictURL ||
          document.querySelector(".file-editor-textarea, .CodeMirror")
        ) {
          this.debug(
            "Periodic check: conflict page without buttons, setting up..."
          );
          await this.setupHelper();
        }
      }
    }, 3000); // Reduced frequency to every 3 seconds
  }

  stopPeriodicCheck() {
    if (this.periodicCheck) {
      clearInterval(this.periodicCheck);
      this.periodicCheck = null;
    }
  }

  setupDOMObserver() {
    // Watch for DOM changes that might indicate a page change
    this.observer = new MutationObserver((mutations) => {
      let shouldReinit = false;

      mutations.forEach((mutation) => {
        // Check if the main content area changed
        if (
          mutation.target.matches?.(
            ".application-main, #js-repo-pjax-container, .js-repo-pjax-container, .repository-content"
          )
        ) {
          shouldReinit = true;
        }

        // Check if added nodes include important content
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (
              node.matches?.(
                ".application-main, .file-editor-textarea, .CodeMirror, textarea, .merge-editor"
              )
            ) {
              shouldReinit = true;
            }
            // Also check if any child nodes contain these elements
            if (
              node.querySelector?.(
                ".file-editor-textarea, .CodeMirror, textarea, .merge-editor"
              )
            ) {
              shouldReinit = true;
            }
          }
        });
      });

      if (shouldReinit) {
        this.debug(
          "DOM change detected, checking if we should reinitialize..."
        );

        // Small delay to let DOM settle
        setTimeout(async () => {
          if (
            this.isConflictPageQuiet() &&
            !document.querySelector(".merge-helper-buttons")
          ) {
            this.debug("Reinitializing helper due to DOM changes...");
            await this.setupHelper();
          }
        }, 100);
      }
    });

    // Start observing with more comprehensive options
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false, // Don't watch attribute changes to reduce noise
      attributeOldValue: false,
      characterData: false,
      characterDataOldValue: false,
    });
  }

  setupContentObserver() {
    // Watch for changes to textareas that might indicate content loading
    this.contentObserver = new MutationObserver((mutations) => {
      let shouldUpdateStatus = false;

      mutations.forEach((mutation) => {
        if (mutation.target.matches?.("textarea, .CodeMirror")) {
          shouldUpdateStatus = true;
        }

        // Check if any added nodes are textareas or contain textareas
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.matches?.("textarea, .CodeMirror")) {
              shouldUpdateStatus = true;
            }
            if (node.querySelector?.("textarea, .CodeMirror")) {
              shouldUpdateStatus = true;
            }
          }
        });
      });

      if (
        shouldUpdateStatus &&
        document.querySelector(".merge-helper-buttons")
      ) {
        // Only update if we already have buttons (avoid unnecessary checks)
        this.debug("Content change detected, updating status...");
        setTimeout(() => {
          this.updateConflictStatus();
        }, 200);
      }
    });

    // Start observing
    this.contentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value"],
    });
  }
}

// Navigation detection for GitHub's PJAX
let currentHelper = null;
let currentURL = window.location.href;

function initializeHelper() {
  try {
    // Clean up previous instance if it exists
    if (currentHelper) {
      currentHelper.cleanup?.();
    }

    currentHelper = new MergeConflictHelper();
    currentURL = window.location.href;
  } catch (error) {
    console.error("[Merge Helper] Initialization error:", error);
  }
}

// Detect URL changes (GitHub PJAX navigation)
function setupNavigationDetection() {
  // Override pushState and replaceState to detect navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    setTimeout(checkForNavigation, 100);
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    setTimeout(checkForNavigation, 100);
  };

  // Listen for popstate (back/forward button)
  window.addEventListener("popstate", () => {
    setTimeout(checkForNavigation, 100);
  });

  // Also listen for GitHub's pjax events
  document.addEventListener("pjax:success", () => {
    setTimeout(checkForNavigation, 100);
  });

  document.addEventListener("pjax:end", () => {
    setTimeout(checkForNavigation, 100);
  });
}

function checkForNavigation() {
  if (window.location.href !== currentURL) {
    console.log("[Merge Helper] Navigation detected, reinitializing...");

    // Try multiple times with increasing delays to handle GitHub's async loading
    setTimeout(() => initializeHelper(), 200);
    setTimeout(() => {
      if (
        currentHelper &&
        currentHelper.isConflictPage() &&
        !document.querySelector(".merge-helper-buttons")
      ) {
        console.log("[Merge Helper] Retrying initialization (1s)...");
        initializeHelper();
      }
    }, 1000);
    setTimeout(() => {
      if (
        currentHelper &&
        currentHelper.isConflictPage() &&
        !document.querySelector(".merge-helper-buttons")
      ) {
        console.log("[Merge Helper] Retrying initialization (3s)...");
        initializeHelper();
      }
    }, 3000);
  }
}

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupNavigationDetection();
    initializeHelper();
  });
} else {
  setupNavigationDetection();
  initializeHelper();
}
