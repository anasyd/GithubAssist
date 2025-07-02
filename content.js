// GitHub Merge Conflict Helper - Minimal Safe Approach
// Only updates content without interfering with CodeMirror's internal state
class MergeConflictHelper {
  constructor() {
    this.debugMode = true;
    this.init();
    this.setupMessageListener();
  }

  debug(message, data = null) {
    if (this.debugMode) {
      console.log(`[Merge Helper] ${message}`, data || "");
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "checkConflicts") {
        const hasConflicts = this.hasConflicts();
        const conflictCount = this.getConflictCount();
        sendResponse({
          hasConflicts: hasConflicts,
          conflictCount: conflictCount,
        });
      }
    });
  }

  async init() {
    this.debug("Initializing...");
    await this.waitForPageLoad();

    if (this.isConflictPage()) {
      this.debug("Conflict page detected, setting up helper...");
      await this.waitForElements();
      this.setupHelper();
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
      const hasCodeMirror = document.querySelector(".CodeMirror") !== null;
      const hasTextarea =
        document.querySelector(".file-editor-textarea") !== null;

      if (hasCodeMirror || hasTextarea) {
        this.debug("Found conflict editor elements");
        return;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  isConflictPage() {
    return (
      window.location.href.includes("/conflicts") ||
      document.querySelector(".file-editor-textarea") !== null ||
      document.title.includes("conflict")
    );
  }

  setupHelper() {
    this.debug("Setting up helper...");
    this.detectBranches();
    this.addButtons();
    this.updateConflictStatus();
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
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            margin: 12px 0;
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        `;

    const currentDisplay = this.formatBranchName(this.currentBranch);
    const incomingDisplay = this.formatBranchName(this.incomingBranch);

    buttonContainer.innerHTML = `
            <div style="font-weight: 600; color: #856404; margin-right: 12px;">
                🔧 Conflict Helper (Safe Mode)
            </div>
            <button class="btn btn-sm merge-helper-current" style="
                background: #28a745; color: white; border: none; 
                padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
                position: relative;
            ">
                Accept All Current
                <div style="
                    font-size: 10px; opacity: 0.8; font-weight: normal; margin-top: 2px;
                ">${currentDisplay}</div>
            </button>
            <button class="btn btn-sm merge-helper-incoming" style="
                background: #0366d6; color: white; border: none; 
                padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
                position: relative;
            ">
                Accept All Incoming
                <div style="
                    font-size: 10px; opacity: 0.8; font-weight: normal; margin-top: 2px;
                ">${incomingDisplay}</div>
            </button>
            <button class="btn btn-sm merge-helper-both" style="
                background: #6f42c1; color: white; border: none; 
                padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
            ">Keep Both</button>
            <button class="btn btn-sm merge-helper-show" style="
                background: #ffc107; color: #212529; border: none; 
                padding: 6px 12px; border-radius: 6px; font-weight: 500; cursor: pointer;
            ">Show Resolved</button>
            <span class="merge-helper-status" style="
                margin-left: 12px; color: #856404; font-weight: 500;
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
                background: #d1ecf1;
                border: 1px solid #bee5eb;
                border-radius: 6px;
                padding: 12px 16px;
                margin: 12px 0;
                color: #0c5460;
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
                <strong>Content copied to clipboard!</strong><br>
                <span style="font-size: 14px;">
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
                background: #d4edda;
                border: 1px solid #c3e6cb;
                border-radius: 6px;
                padding: 16px;
                margin: 12px 0;
                font-family: monospace;
                white-space: pre-wrap;
                max-height: 400px;
                overflow-y: auto;
                position: relative;
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
                <strong style="color: #155724;">Resolved Content:</strong>
                <div style="display: flex; gap: 8px;">
                    <button id="copy-resolved" style="
                        background: #28a745; color: white; border: none; 
                        padding: 4px 8px; border-radius: 4px; cursor: pointer;
                    ">Copy Again</button>
                    <button id="hide-resolved" style="
                        background: #6c757d; color: white; border: none; 
                        padding: 4px 8px; border-radius: 4px; cursor: pointer;
                    ">Hide</button>
                </div>
            </div>
            <div style="
                background: #f8f9fa; 
                border: 1px solid #c3e6cb; 
                border-radius: 4px; 
                padding: 12px; 
                font-size: 14px;
                line-height: 1.4;
                color: #212529;
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
    if (textarea) {
      return textarea.value;
    }

    // Fallback: try other textareas
    const allTextareas = document.querySelectorAll("textarea");
    for (const ta of allTextareas) {
      if (ta.value && ta.value.includes("<<<<<<<")) {
        return ta.value;
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
        status.style.color = "#856404";
      } else {
        status.textContent = "No conflicts detected";
        status.style.color = "#155724";
      }
    }
  }

  updateStatus(message, type = "info") {
    const status = document.querySelector(".merge-helper-status");
    if (status) {
      status.textContent = message;

      switch (type) {
        case "success":
          status.style.color = "#155724";
          break;
        case "warning":
          status.style.color = "#856404";
          break;
        case "error":
          status.style.color = "#721c24";
          break;
        default:
          status.style.color = "#856404";
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
