// GitHub Merge Conflict Helper - Refined GitHub Approach
// Based on refined-github's conflict resolution best practices

class MergeConflictHelper {
  constructor() {
    this.editor = null;
    this.resolvedContent = null;
    this.init();
    this.setupMessageListener();
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
    if (this.isConflictPage()) {
      // Wait for CodeMirror like refined-github does
      await this.waitForCodeMirror();
      this.setupHelper();
    }
  }

  async waitForCodeMirror() {
    const maxAttempts = 10; // Reduced attempts since we have good fallback
    let attempts = 0;

    while (attempts < maxAttempts) {
      const cmElement = document.querySelector(".CodeMirror");

      if (cmElement) {
        // Try different ways to access CodeMirror instance
        const cmInstance =
          cmElement.CodeMirror ||
          cmElement._codeMirror ||
          cmElement.__codemirror__ ||
          window.CodeMirror?.fromTextArea?.(cmElement) ||
          null;

        if (cmInstance) {
          this.editor = cmInstance;
          console.log("CodeMirror editor found and initialized");
          this.setupCodeMirrorEvents();
          return;
        }
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      "CodeMirror instance not accessible, using textarea-only approach"
    );
  }

  setupCodeMirrorEvents() {
    if (this.editor) {
      // Listen for content changes to update conflict status
      this.editor.on("changes", () => {
        this.updateConflictStatus();
      });

      // Listen for swapDoc events like refined-github does
      this.editor.on("swapDoc", () => {
        setTimeout(() => this.updateConflictStatus(), 100);
      });
    }
  }

  isConflictPage() {
    return (
      window.location.href.includes("/conflicts") ||
      document.querySelector(".file-editor-textarea") !== null
    );
  }

  setupHelper() {
    console.log("Setting up merge conflict helper...");
    this.addButtons();
    this.updateConflictStatus();
  }

  addButtons() {
    // Remove existing buttons
    const existing = document.querySelector(".merge-helper-buttons");
    if (existing) existing.remove();

    // Find the file header
    const fileHeader = document.querySelector(".file-header");
    if (!fileHeader) return;

    // Create button container
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "merge-helper-buttons";
    buttonContainer.style.cssText = `
      padding: 8px 16px;
      background: #f6f8fa;
      border-bottom: 1px solid #d1d9e0;
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    buttonContainer.innerHTML = `
      <button class="btn btn-sm merge-helper-current" style="background: #28a745; color: white;">
        Accept All Current
      </button>
      <button class="btn btn-sm merge-helper-incoming" style="background: #0366d6; color: white;">
        Accept All Incoming
      </button>
      <span class="merge-helper-status" style="margin-left: 12px; color: #586069;">
        Ready to resolve conflicts
      </span>
    `;

    // Insert after file header
    fileHeader.insertAdjacentElement("afterend", buttonContainer);

    // Add event listeners
    buttonContainer
      .querySelector(".merge-helper-current")
      .addEventListener("click", () => this.resolveAllConflicts("current"));

    buttonContainer
      .querySelector(".merge-helper-incoming")
      .addEventListener("click", () => this.resolveAllConflicts("incoming"));

    console.log("Buttons added successfully");
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

  getContent() {
    console.log("Getting content...");

    if (this.editor) {
      const content = this.editor.getValue();
      console.log(
        "Got content from CodeMirror:",
        content.substring(0, 200) + "..."
      );
      return content;
    }

    const textarea = document.querySelector(".file-editor-textarea");
    if (textarea) {
      const content = textarea.value;
      console.log(
        "Got content from textarea:",
        content.substring(0, 200) + "..."
      );
      return content;
    }

    // Fallback: try to find any textarea or input
    const fallbackTextarea = document.querySelector("textarea");
    if (fallbackTextarea) {
      const content = fallbackTextarea.value;
      console.log(
        "Got content from fallback textarea:",
        content.substring(0, 200) + "..."
      );
      return content;
    }

    console.log("No content source found");
    return "";
  }

  resolveAllConflicts(choice) {
    console.log(`Resolving all conflicts: ${choice}`);

    const content = this.getContent();
    if (!content.includes("<<<<<<<")) {
      console.log("No conflicts found");
      this.updateStatus("No conflicts found", "warning");
      return;
    }

    // Process conflicts using refined-github approach
    const resolvedContent = this.processConflicts(content, choice);
    this.resolvedContent = resolvedContent;

    // Update content using proper approach
    this.updateContentSafely(resolvedContent);

    // Trigger GitHub's conflict resolution detection
    this.triggerGitHubConflictCheck();

    this.updateStatus(
      "✅ Conflicts resolved - GitHub should enable commit button",
      "success"
    );
  }

  processConflicts(content, choice) {
    console.log(`Processing conflicts with choice: ${choice}`);
    console.log("Original content:", content);

    // Use refined-github's line-by-line approach
    const lines = content.split("\n");
    const resolvedLines = [];
    let i = 0;
    let conflictsResolved = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith("<<<<<<<")) {
        console.log(`Found conflict start at line ${i}: ${line}`);
        // Found conflict start - find boundaries like refined-github does
        const { middleIndex, endIndex } = this.findConflictBoundaries(lines, i);
        console.log(
          `Conflict boundaries: middle=${middleIndex}, end=${endIndex}`
        );

        if (middleIndex !== -1 && endIndex !== -1) {
          if (choice === "current") {
            // Keep current branch content (between start and middle)
            console.log("Keeping current branch content:");
            for (let k = i + 1; k < middleIndex; k++) {
              console.log(`  Line ${k}: ${lines[k]}`);
              resolvedLines.push(lines[k]);
            }
          } else {
            // Keep incoming branch content (between middle and end)
            console.log("Keeping incoming branch content:");
            for (let k = middleIndex + 1; k < endIndex; k++) {
              console.log(`  Line ${k}: ${lines[k]}`);
              resolvedLines.push(lines[k]);
            }
          }

          conflictsResolved++;
          i = endIndex + 1; // Skip past entire conflict
        } else {
          // Malformed conflict, treat as regular line
          resolvedLines.push(line);
          i++;
        }
      } else {
        // Regular line, keep it
        resolvedLines.push(line);
        i++;
      }
    }

    console.log(`Resolved ${conflictsResolved} conflicts`);
    const result = resolvedLines.join("\n");
    console.log("Final resolved content:", result);

    // Verify resolution
    if (
      result.includes("<<<<<<<") ||
      result.includes("=======") ||
      result.includes(">>>>>>>")
    ) {
      console.error(
        "❌ ERROR: Conflict markers still present after resolution!"
      );
    } else {
      console.log("✅ SUCCESS: All conflict markers removed");
    }

    return result;
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

  updateContentSafely(content) {
    console.log(
      "⚙️ Executing direct editor commands, simulating human action..."
    );

    const editorPane = document.querySelector(
      ".CodeMirror-code[contenteditable='true']"
    );
    const textarea = document.querySelector(".file-editor-textarea");

    if (!editorPane || !textarea) {
      console.error(
        "❌ Critical Error: Could not find the editor pane or textarea."
      );
      return;
    }

    // --- STEP 1: Focus the Editor ---
    // A human must first click into the editor.
    editorPane.focus();

    // --- STEP 2: Select All Text ---
    // A human would press Ctrl+A (or Cmd+A). This command does the same.
    document.execCommand("selectAll", false, null);
    console.log("✅ Action: Selected all text.");

    // --- STEP 3: Replace the Selection (Delete and Type) ---
    // When a user types while text is selected, the selection is replaced.
    // The 'insertText' command simulates this single action perfectly.
    const commandSuccess = document.execCommand("insertText", false, content);

    if (commandSuccess) {
      console.log("✅ Action: Replaced selection with resolved content.");
    } else {
      console.error(
        "❌ Action: 'insertText' command failed. This browser may not support it."
      );
      // Fallback for older browsers if 'insertText' fails
      document.execCommand("delete", false, null);
      document.execCommand("insertHTML", false, content);
      console.log("Fallback: Used delete and insertHTML.");
    }

    // --- STEP 4: Sync the Hidden Textarea ---
    // This is our failsafe to ensure the form submission is always correct.
    textarea.value = content;
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    console.log("✅ Synced hidden textarea.");

    // --- STEP 5: Trigger GitHub's UI Update ---
    this.triggerGitHubConflictCheck();
    this.setupFormSubmissionHook(content);
  }

  updateCodeMirrorDOM(content) {
    const cmElement = document.querySelector(".CodeMirror");
    if (!cmElement) return;

    try {
      // Find the content area within CodeMirror
      const cmLines = cmElement.querySelector(".CodeMirror-lines");
      const cmCode = cmElement.querySelector(".CodeMirror-code");

      if (cmCode) {
        // Create new content structure
        const lines = content.split("\n");
        let newHTML = "";

        lines.forEach((line, index) => {
          const lineNumber = index + 1;
          const escapedLine = line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

          newHTML += `<div class="CodeMirror-line" role="presentation">`;
          newHTML += `<span role="presentation" style="padding-right: 0.1px;">`;
          newHTML += `<span class="cm-line">${escapedLine || " "}</span>`;
          newHTML += `</span></div>`;
        });

        cmCode.innerHTML = newHTML;
        console.log("Updated CodeMirror DOM content");

        // Trigger visual refresh
        cmElement.dispatchEvent(new Event("refresh"));

        // Focus the editor to make changes visible
        const focusTarget =
          cmElement.querySelector('[contenteditable="true"]') || cmElement;
        focusTarget.focus();
      }
    } catch (error) {
      console.error("Error updating CodeMirror DOM:", error);
    }
  }

  updateFormData(content) {
    // Update all relevant form inputs that GitHub uses for submission
    const inputs = document.querySelectorAll('input[name*="files"]');
    inputs.forEach((input) => {
      input.value = content;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Also update any hidden inputs that might contain file content
    const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
    hiddenInputs.forEach((input) => {
      if (input.value && input.value.includes("<<<<<<<")) {
        input.value = content;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    console.log("Updated form data");
  }

  setupFormSubmissionHook(resolvedContent) {
    // Hook into form submission to ensure resolved content is sent
    const form = document.querySelector(
      '.js-resolve-conflicts-form, form[action*="resolve_conflicts"]'
    );
    if (!form) return;

    // Remove existing handler to avoid duplicates
    if (this.formSubmissionHandler) {
      form.removeEventListener("submit", this.formSubmissionHandler, true);
    }

    this.formSubmissionHandler = (event) => {
      console.log("Form submission - ensuring resolved content is sent");

      // Update all form inputs with resolved content right before submission
      const fileInputs = form.querySelectorAll(
        'input[name*="files"], textarea'
      );
      fileInputs.forEach((input) => {
        if (input.value && input.value.includes("<<<<<<<")) {
          input.value = resolvedContent;
        }
      });
    };

    // Add event listener with capture to run first
    form.addEventListener("submit", this.formSubmissionHandler, true);
    console.log("Form submission hook installed");
  }

  triggerGitHubConflictCheck() {
    console.log("Triggering GitHub conflict check...");

    // Method 1: Simulate user interaction on the editor
    const cmElement = document.querySelector(".CodeMirror");
    if (cmElement) {
      // Find contenteditable area or focus target
      const focusTarget =
        cmElement.querySelector('[contenteditable="true"]') ||
        cmElement.querySelector(".CodeMirror-focused") ||
        cmElement;

      if (focusTarget) {
        focusTarget.focus();

        // Simulate typing to trigger GitHub's conflict detection
        const events = [
          new KeyboardEvent("keydown", { bubbles: true, key: " " }),
          new KeyboardEvent("keypress", { bubbles: true, key: " " }),
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: " ",
          }),
          new KeyboardEvent("keyup", { bubbles: true, key: " " }),
        ];

        events.forEach((event) => focusTarget.dispatchEvent(event));

        // Remove the extra space we added
        setTimeout(() => {
          const textarea = document.querySelector(".file-editor-textarea");
          if (textarea && textarea.value.endsWith(" ")) {
            textarea.value = textarea.value.slice(0, -1);
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }, 50);
      }
    }

    // Method 2: Trigger textarea events
    const textarea = document.querySelector(".file-editor-textarea");
    if (textarea) {
      textarea.focus();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      textarea.dispatchEvent(new Event("keyup", { bubbles: true }));
    }

    // Method 3: Dispatch custom events that GitHub might listen for
    const conflictElements = [
      document.querySelector(".js-conflict-resolver"),
      document.querySelector(".conflict-editor"),
      document.querySelector(".file-editor"),
      document.body,
    ].filter(Boolean);

    conflictElements.forEach((element) => {
      const events = [
        "conflict:resolved",
        "conflicts:updated",
        "change",
        "input",
      ];
      events.forEach((eventName) => {
        element.dispatchEvent(
          new CustomEvent(eventName, {
            bubbles: true,
            detail: { conflicts: 0 },
          })
        );
      });
    });

    // Method 4: Update UI elements and counters
    setTimeout(() => {
      this.updateConflictCounters();
      this.enableConflictResolutionUI();
    }, 100);
  }

  updateConflictCounters() {
    // Update GitHub's conflict counter elements
    const counter = document.querySelector(".js-conflict-count");
    if (counter) {
      counter.textContent = "0";
    }

    // Update header if present
    const header = document.querySelector("h3");
    if (header && header.textContent.includes("conflicting file")) {
      header.textContent = "0 conflicting files";
    }

    // Update any other conflict counters
    const allCounters = document.querySelectorAll('[class*="conflict-count"]');
    allCounters.forEach((counter) => {
      if (counter.textContent.includes("1")) {
        counter.textContent = counter.textContent.replace(/1/, "0");
      }
    });
  }

  enableConflictResolutionUI() {
    // Try to enable the "Mark as resolved" button
    const markBtn = document.querySelector(".js-mark-resolved");
    if (markBtn) {
      markBtn.disabled = false;
      markBtn.removeAttribute("disabled");
      markBtn.classList.remove("disabled");
      console.log("Enabled 'Mark as resolved' button");
    }

    // Try to enable the commit button
    const commitButton = document.querySelector(".js-resolve-conflicts-button");
    if (commitButton) {
      commitButton.disabled = false;
      commitButton.removeAttribute("disabled");
      commitButton.classList.remove("disabled");
      console.log("Enabled commit button");
    }

    // Remove visual conflict indicators
    this.removeConflictIndicators();
  }

  removeConflictIndicators() {
    // Remove conflict background highlighting
    const conflictBackgrounds = document.querySelectorAll(
      ".conflict-background"
    );
    conflictBackgrounds.forEach((bg) => bg.remove());

    // Hide conflict gutter markers
    const conflictGutters = document.querySelectorAll(
      ".conflict-gutter-marker"
    );
    conflictGutters.forEach((marker) => (marker.style.display = "none"));

    // Remove conflict marker styling
    const conflictMarkers = document.querySelectorAll(".cm-conflict-marker");
    conflictMarkers.forEach((marker) =>
      marker.classList.remove("cm-conflict-marker")
    );
  }

  updateStatus(message, type = "info") {
    const status = document.querySelector(".merge-helper-status");
    if (status) {
      status.textContent = message;

      // Update styling based on type
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

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => new MergeConflictHelper()
  );
} else {
  new MergeConflictHelper();
}
