// GitHub Merge Conflict Helper - Improved Version
class MergeConflictHelper {
  constructor() {
    this.editor = null;
    this.resolvedContent = null;
    this.debugMode = true; // Enable for debugging
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
      this.debug("Received message:", request);
      if (request.action === "checkConflicts") {
        const hasConflicts = this.hasConflicts();
        const conflictCount = this.getConflictCount();
        this.debug("Conflict check result:", { hasConflicts, conflictCount });
        sendResponse({
          hasConflicts: hasConflicts,
          conflictCount: conflictCount,
        });
      }
    });
  }

  async init() {
    this.debug("Initializing...");
    this.debug("Current URL:", window.location.href);
    this.debug("Page title:", document.title);

    // Wait a bit for GitHub's dynamic content to load
    await this.waitForPageLoad();

    if (this.isConflictPage()) {
      this.debug("Conflict page detected, setting up helper...");
      await this.waitForCodeMirror();
      this.setupHelper();
    } else {
      this.debug("Not a conflict page, skipping setup");
    }
  }

  async waitForPageLoad() {
    // Wait for GitHub's PJAX navigation to complete
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      // Check if the page has finished loading
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

    this.debug("Page load timeout, proceeding anyway");
  }

  async waitForCodeMirror() {
    this.debug("Looking for CodeMirror...");
    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Try multiple possible selectors for the editor
      const possibleSelectors = [
        ".CodeMirror",
        ".file-editor-textarea",
        'textarea[name*="file"]',
        ".js-file-editor-textarea",
        ".conflict-editor textarea",
      ];

      for (const selector of possibleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          this.debug(
            `Found editor element with selector: ${selector}`,
            element
          );

          if (element.classList.contains("CodeMirror")) {
            const cmInstance =
              element.CodeMirror ||
              element._codeMirror ||
              window.CodeMirror?.fromTextArea?.(element);
            if (cmInstance) {
              this.editor = cmInstance;
              this.debug("CodeMirror instance found");
              this.setupCodeMirrorEvents();
              return;
            }
          }

          // If it's a textarea, we can work with it directly
          if (element.tagName === "TEXTAREA") {
            this.debug("Using textarea directly");
            return;
          }
        }
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.debug("Editor not found, but proceeding with setup");
  }

  setupCodeMirrorEvents() {
    if (this.editor) {
      this.debug("Setting up CodeMirror events");
      this.editor.on("changes", () => {
        this.updateConflictStatus();
      });
    }
  }

  isConflictPage() {
    const indicators = [
      window.location.href.includes("/conflicts"),
      window.location.href.includes("/resolve"),
      document.querySelector(".file-editor-textarea") !== null,
      document.querySelector(".js-file-editor-textarea") !== null,
      document.querySelector(".conflict-editor") !== null,
      document.title.includes("conflict"),
      document.querySelector('[data-hotkey="cmd+s"]') !== null, // GitHub's save shortcut
    ];

    const isConflict = indicators.some((indicator) => indicator);
    this.debug("Conflict page indicators:", indicators);
    this.debug("Is conflict page:", isConflict);

    return isConflict;
  }

  setupHelper() {
    this.debug("Setting up merge conflict helper...");

    // Log current DOM structure for debugging
    this.debug(
      "File headers found:",
      document.querySelectorAll(".file-header").length
    );
    this.debug(
      "Textareas found:",
      document.querySelectorAll("textarea").length
    );
    this.debug(
      "CodeMirror elements found:",
      document.querySelectorAll(".CodeMirror").length
    );

    this.addButtons();
    this.updateConflictStatus();
  }

  addButtons() {
    this.debug("Adding buttons...");

    // Remove existing buttons
    const existing = document.querySelector(".merge-helper-buttons");
    if (existing) {
      this.debug("Removing existing buttons");
      existing.remove();
    }

    // Try multiple selectors for where to insert buttons
    const insertionTargets = [
      ".file-header",
      ".file-info",
      ".Box-header",
      ".js-file-header",
      ".file-editor",
    ];

    let insertionPoint = null;
    for (const selector of insertionTargets) {
      const element = document.querySelector(selector);
      if (element) {
        insertionPoint = element;
        this.debug(`Found insertion point: ${selector}`, element);
        break;
      }
    }

    if (!insertionPoint) {
      // Fallback: insert at the beginning of the main content
      insertionPoint = document.querySelector("main") || document.body;
      this.debug("Using fallback insertion point", insertionPoint);
    }

    if (!insertionPoint) {
      this.debug("ERROR: No insertion point found");
      return;
    }

    // Create button container
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "merge-helper-buttons";
    buttonContainer.style.cssText = `
            padding: 12px 16px;
            background: #f6f8fa;
            border: 1px solid #d1d9e0;
            border-radius: 6px;
            margin: 12px 0;
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        `;

    buttonContainer.innerHTML = `
            <div style="font-weight: 600; color: #24292f; margin-right: 12px;">
                🔧 Merge Conflict Helper
            </div>
            <button class="btn btn-sm merge-helper-current" style="
                background: #28a745; 
                color: white; 
                border: none; 
                padding: 6px 12px; 
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
            ">
                Accept All Current
            </button>
            <button class="btn btn-sm merge-helper-incoming" style="
                background: #0366d6; 
                color: white; 
                border: none; 
                padding: 6px 12px; 
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
            ">
                Accept All Incoming
            </button>
            <button class="btn btn-sm merge-helper-enable" style="
                background: #f66a0a; 
                color: white; 
                border: none; 
                padding: 6px 12px; 
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
            ">
                Enable Buttons
            </button>
            <button class="btn btn-sm merge-helper-debug" style="
                background: #6f42c1; 
                color: white; 
                border: none; 
                padding: 6px 12px; 
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
            ">
                Debug Info
            </button>
            <span class="merge-helper-status" style="
                margin-left: 12px; 
                color: #586069;
                font-weight: 500;
            ">
                Ready to resolve conflicts
            </span>
        `;

    // Insert the buttons
    if (
      insertionPoint.classList.contains("file-header") ||
      insertionPoint.classList.contains("Box-header")
    ) {
      insertionPoint.insertAdjacentElement("afterend", buttonContainer);
    } else {
      insertionPoint.insertAdjacentElement("afterbegin", buttonContainer);
    }

    // Add event listeners
    const currentBtn = buttonContainer.querySelector(".merge-helper-current");
    const incomingBtn = buttonContainer.querySelector(".merge-helper-incoming");
    const enableBtn = buttonContainer.querySelector(".merge-helper-enable");
    const debugBtn = buttonContainer.querySelector(".merge-helper-debug");

    if (currentBtn && incomingBtn && enableBtn && debugBtn) {
      currentBtn.addEventListener("click", () =>
        this.resolveAllConflicts("current")
      );
      incomingBtn.addEventListener("click", () =>
        this.resolveAllConflicts("incoming")
      );
      enableBtn.addEventListener("click", () => {
        this.enableGitHubButtons();
        this.forceEnableButtons();
        this.updateStatus("🔓 Attempted to enable all buttons", "info");
      });
      debugBtn.addEventListener("click", () => this.showDebugInfo());
      this.debug("Event listeners added successfully");
    } else {
      this.debug("ERROR: Could not find buttons to attach event listeners");
    }

    this.debug("Buttons added successfully");
  }

  updateConflictStatus() {
    const hasConflicts = this.hasConflicts();
    const conflictCount = this.getConflictCount();
    const status = document.querySelector(".merge-helper-status");

    this.debug("Updating conflict status:", { hasConflicts, conflictCount });

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
    const hasConflicts =
      content.includes("<<<<<<<") &&
      content.includes("=======") &&
      content.includes(">>>>>>>");
    this.debug("Has conflicts check:", hasConflicts);
    return hasConflicts;
  }

  getConflictCount() {
    const content = this.getContent();
    const conflicts = content.match(/<<<<<<</g);
    const count = conflicts ? conflicts.length : 0;
    this.debug("Conflict count:", count);
    return count;
  }

  getContent() {
    this.debug("Getting content...");

    // Try CodeMirror first
    if (this.editor) {
      const content = this.editor.getValue();
      this.debug(
        "Got content from CodeMirror:",
        content.substring(0, 100) + "..."
      );
      return content;
    }

    // Try various textarea selectors
    const textareaSelectors = [
      ".file-editor-textarea",
      ".js-file-editor-textarea",
      "textarea[name*='file']",
      "textarea[name*='content']",
      ".conflict-editor textarea",
      "textarea",
    ];

    for (const selector of textareaSelectors) {
      const textarea = document.querySelector(selector);
      if (textarea && textarea.value) {
        this.debug(
          `Got content from textarea (${selector}):`,
          textarea.value.substring(0, 100) + "..."
        );
        return textarea.value;
      }
    }

    this.debug("No content source found");
    return "";
  }

  resolveAllConflicts(choice) {
    this.debug(`Resolving all conflicts: ${choice}`);
    const content = this.getContent();

    if (!content) {
      this.updateStatus("No content found", "error");
      return;
    }

    if (!content.includes("<<<<<<<")) {
      this.updateStatus("No conflicts found", "warning");
      return;
    }

    const resolvedContent = this.processConflicts(content, choice);
    this.updateContentSafely(resolvedContent);

    // Verify the content was actually updated
    setTimeout(() => {
      const verificationContent = this.getContent();
      if (verificationContent.includes("<<<<<<<")) {
        this.debug(
          "WARNING: Content still contains conflicts after resolution!"
        );
        this.updateStatus(
          "⚠️ Resolution may not have worked - try manual edit",
          "warning"
        );

        // Try one more aggressive update
        this.aggressiveContentUpdate(resolvedContent);
      } else {
        this.debug("SUCCESS: Content verification passed");
        this.updateStatus(
          `✅ Conflicts resolved (${choice}) - Enabling buttons...`,
          "success"
        );

        // Try to enable GitHub's buttons since conflicts are resolved
        setTimeout(() => {
          this.enableGitHubButtons();
          this.forceEnableButtons();
          this.updateStatus(
            `✅ Conflicts resolved (${choice}) - Ready to commit!`,
            "success"
          );
        }, 300);
      }
    }, 500);
  }

  processConflicts(content, choice) {
    this.debug(`Processing conflicts with choice: ${choice}`);

    const lines = content.split("\n");
    const resolvedLines = [];
    let i = 0;
    let conflictsResolved = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith("<<<<<<<")) {
        this.debug(`Found conflict start at line ${i}: ${line}`);

        const { middleIndex, endIndex } = this.findConflictBoundaries(lines, i);

        if (middleIndex !== -1 && endIndex !== -1) {
          if (choice === "current") {
            // Keep current branch content
            for (let k = i + 1; k < middleIndex; k++) {
              resolvedLines.push(lines[k]);
            }
          } else {
            // Keep incoming branch content
            for (let k = middleIndex + 1; k < endIndex; k++) {
              resolvedLines.push(lines[k]);
            }
          }
          conflictsResolved++;
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

    this.debug(`Resolved ${conflictsResolved} conflicts`);
    const result = resolvedLines.join("\n");

    // Verify resolution
    if (
      result.includes("<<<<<<<") ||
      result.includes("=======") ||
      result.includes(">>>>>>>")
    ) {
      this.debug("ERROR: Conflict markers still present after resolution!");
    } else {
      this.debug("SUCCESS: All conflict markers removed");
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
    this.debug("Updating content safely...");

    // Method 1: Update CodeMirror if available
    if (this.editor) {
      try {
        this.editor.setValue(content);
        this.editor.clearHistory();
        this.editor.refresh();
        this.debug("Updated CodeMirror content successfully");
      } catch (error) {
        this.debug("Error updating CodeMirror:", error);
      }
    }

    // Method 2: Force update the CodeMirror instance through DOM manipulation
    this.forceUpdateCodeMirror(content);

    // Method 3: Update all textareas
    const textareaSelectors = [
      ".file-editor-textarea",
      ".js-file-editor-textarea",
      "textarea[name*='file']",
      "textarea[name*='content']",
      "textarea",
    ];

    let updated = false;
    for (const selector of textareaSelectors) {
      const textarea = document.querySelector(selector);
      if (textarea) {
        // Force enable the textarea temporarily
        const wasDisabled = textarea.disabled;
        textarea.disabled = false;
        textarea.style.display = "block";

        textarea.value = content;

        // Trigger all possible events that GitHub might listen to
        const events = [
          new Event("input", { bubbles: true }),
          new Event("change", { bubbles: true }),
          new Event("keyup", { bubbles: true }),
          new Event("blur", { bubbles: true }),
          new KeyboardEvent("keydown", { bubbles: true, key: " " }),
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: " ",
          }),
        ];

        events.forEach((event) => textarea.dispatchEvent(event));

        // Restore original state
        textarea.disabled = wasDisabled;
        if (wasDisabled) {
          textarea.style.display = "none";
        }

        this.debug(`Updated textarea: ${selector}`);
        updated = true;
      }
    }

    // Method 4: Hook into GitHub's form submission
    this.setupFormInterception(content);

    // Method 5: Update hidden inputs and form data
    this.updateAllFormInputs(content);

    // Method 6: Trigger GitHub's conflict resolution detection
    this.triggerGitHubConflictDetection();

    if (!updated) {
      this.debug("WARNING: No textarea found to update");
    }

    // Update conflict status
    setTimeout(() => this.updateConflictStatus(), 100);
  }

  triggerGitHubConflictDetection() {
    this.debug("Triggering GitHub conflict detection...");

    // Method 1: Simulate user interaction that GitHub listens for
    const textarea = document.querySelector(".file-editor-textarea");
    if (textarea) {
      // Focus the textarea
      textarea.focus();

      // Simulate typing a space and then deleting it to trigger change detection
      const originalValue = textarea.value;
      textarea.value = originalValue + " ";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));

      setTimeout(() => {
        textarea.value = originalValue;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.dispatchEvent(new Event("change", { bubbles: true }));
        textarea.blur();

        // Try to trigger GitHub's conflict resolution check
        this.enableGitHubButtons();
      }, 100);
    }

    // Method 2: Try to trigger CodeMirror events
    const cmElement = document.querySelector(".CodeMirror");
    if (cmElement && window.CodeMirror) {
      try {
        const cm = cmElement.CodeMirror;
        if (cm) {
          // Trigger CodeMirror change events
          cm.focus();
          cm.setCursor(cm.lineCount(), 0);
          cm.replaceRange("", cm.getCursor());
          cm.refresh();

          // Dispatch custom events that GitHub might listen for
          cmElement.dispatchEvent(
            new CustomEvent("conflict-resolved", {
              bubbles: true,
              detail: { resolved: true },
            })
          );
        }
      } catch (error) {
        this.debug("Error triggering CodeMirror events:", error);
      }
    }

    // Method 3: Try to find and trigger GitHub's conflict resolution checker
    setTimeout(() => {
      this.forceEnableButtons();
    }, 200);
  }

  enableGitHubButtons() {
    this.debug("Attempting to enable GitHub buttons...");

    // Look for the "Mark as resolved" button with various selectors
    const buttonSelectors = [
      ".js-mark-resolved",
      '[data-disable-with*="resolved"]',
      'button[type="submit"]',
      ".btn[disabled]",
      'input[type="submit"][disabled]',
    ];

    buttonSelectors.forEach((selector) => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach((button) => {
        if (
          button.textContent.toLowerCase().includes("resolved") ||
          button.textContent.toLowerCase().includes("commit") ||
          button
            .getAttribute("data-disable-with")
            ?.toLowerCase()
            .includes("resolved")
        ) {
          this.debug(`Found potential resolve button: ${selector}`, button);

          // Enable the button
          button.disabled = false;
          button.removeAttribute("disabled");
          button.classList.remove("disabled");

          // Remove any disabled styling
          button.style.opacity = "1";
          button.style.pointerEvents = "auto";

          this.debug("Enabled button:", button);
        }
      });
    });

    // Also try to enable any form submit buttons
    const forms = document.querySelectorAll("form");
    forms.forEach((form) => {
      const submitButtons = form.querySelectorAll(
        'button[type="submit"], input[type="submit"]'
      );
      submitButtons.forEach((button) => {
        if (button.disabled) {
          button.disabled = false;
          button.removeAttribute("disabled");
          button.classList.remove("disabled");
          this.debug("Enabled form submit button:", button);
        }
      });
    });
  }

  forceEnableButtons() {
    this.debug("Force enabling all disabled buttons...");

    // Get all disabled buttons and try to enable them
    const allDisabledButtons = document.querySelectorAll(
      "button[disabled], input[disabled]"
    );
    allDisabledButtons.forEach((button) => {
      const buttonText =
        button.textContent ||
        button.value ||
        button.getAttribute("aria-label") ||
        "";

      // Only enable buttons that seem related to conflict resolution
      if (
        buttonText.toLowerCase().includes("resolved") ||
        buttonText.toLowerCase().includes("commit") ||
        buttonText.toLowerCase().includes("merge") ||
        button
          .getAttribute("data-disable-with")
          ?.toLowerCase()
          .includes("resolved")
      ) {
        button.disabled = false;
        button.removeAttribute("disabled");
        button.classList.remove("disabled");

        // Force remove any GitHub-specific disabled classes
        button.classList.remove("btn-disabled");

        // Override any disabled styling
        button.style.cssText += `
                    opacity: 1 !important;
                    pointer-events: auto !important;
                    cursor: pointer !important;
                `;

        this.debug("Force enabled button:", buttonText, button);
      }
    });

    // Try to trigger any GitHub-specific conflict resolution events
    this.triggerGitHubEvents();
  }

  triggerGitHubEvents() {
    this.debug("Triggering GitHub-specific events...");

    // Try to trigger events that GitHub's conflict resolution system might listen for
    const events = [
      "conflict:resolved",
      "conflicts:updated",
      "merge:resolved",
      "file:resolved",
      "editor:change",
      "turbo:load",
    ];

    events.forEach((eventName) => {
      document.dispatchEvent(
        new CustomEvent(eventName, {
          bubbles: true,
          detail: { resolved: true, conflicts: 0 },
        })
      );

      // Also try on the body and main elements
      const targets = [document.body, document.querySelector("main")].filter(
        Boolean
      );
      targets.forEach((target) => {
        target.dispatchEvent(
          new CustomEvent(eventName, {
            bubbles: true,
            detail: { resolved: true, conflicts: 0 },
          })
        );
      });
    });

    // Try to find and click any hidden "check conflicts" buttons
    const hiddenButtons = document.querySelectorAll(
      'button[style*="display: none"], button[hidden]'
    );
    hiddenButtons.forEach((button) => {
      const buttonText =
        button.textContent || button.getAttribute("aria-label") || "";
      if (
        buttonText.toLowerCase().includes("check") ||
        buttonText.toLowerCase().includes("conflict") ||
        buttonText.toLowerCase().includes("refresh")
      ) {
        this.debug("Found hidden button, clicking:", buttonText);
        button.click();
      }
    });
  }

  forceUpdateCodeMirror(content) {
    const cmElement = document.querySelector(".CodeMirror");
    if (!cmElement) return;

    try {
      // Try to get the CodeMirror instance through various methods
      const cm =
        cmElement.CodeMirror ||
        window.CodeMirror?.fromTextArea?.(cmElement) ||
        cmElement._codeMirror;

      if (cm) {
        cm.setValue(content);
        cm.save(); // This syncs with the underlying textarea
        cm.refresh();
        this.debug("Force updated CodeMirror instance");
      } else {
        // Fallback: manually update the DOM
        this.updateCodeMirrorDOM(content);
      }
    } catch (error) {
      this.debug("Error force updating CodeMirror:", error);
    }
  }

  updateCodeMirrorDOM(content) {
    const cmElement = document.querySelector(".CodeMirror");
    if (!cmElement) return;

    try {
      const cmCode = cmElement.querySelector(".CodeMirror-code");
      if (cmCode) {
        const lines = content.split("\n");
        let newHTML = "";

        lines.forEach((line, index) => {
          const escapedLine = this.escapeHtml(line || " ");
          newHTML += `<div class="CodeMirror-line" role="presentation">`;
          newHTML += `<span role="presentation" style="padding-right: 0.1px;">`;
          newHTML += `<span class="cm-line">${escapedLine}</span>`;
          newHTML += `</span></div>`;
        });

        cmCode.innerHTML = newHTML;
        this.debug("Updated CodeMirror DOM");
      }
    } catch (error) {
      this.debug("Error updating CodeMirror DOM:", error);
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  updateAllFormInputs(content) {
    // Find and update all possible form inputs that might contain the file content
    const form = document.querySelector("form");
    if (!form) return;

    // Update all inputs that might contain file content
    const inputs = form.querySelectorAll("input, textarea");
    inputs.forEach((input) => {
      if (input.value && input.value.includes("<<<<<<<")) {
        input.value = content;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        this.debug("Updated form input:", input.name || input.className);
      }
    });

    // Look for hidden inputs specifically
    const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
    hiddenInputs.forEach((input) => {
      if (input.value && input.value.includes("<<<<<<<")) {
        input.value = content;
        this.debug("Updated hidden input:", input.name);
      }
    });
  }

  setupFormInterception(resolvedContent) {
    const form = document.querySelector("form");
    if (!form) return;

    // Remove existing handler to avoid duplicates
    if (this.formSubmissionHandler) {
      form.removeEventListener("submit", this.formSubmissionHandler, true);
    }

    this.formSubmissionHandler = (event) => {
      this.debug("Form submission intercepted - forcing resolved content");

      // Update all textareas one more time right before submission
      const textareas = form.querySelectorAll("textarea");
      textareas.forEach((textarea) => {
        if (textarea.value && textarea.value.includes("<<<<<<<")) {
          textarea.value = resolvedContent;
          this.debug("Pre-submission: Updated textarea");
        }
      });

      // Update all inputs one more time
      const inputs = form.querySelectorAll("input");
      inputs.forEach((input) => {
        if (input.value && input.value.includes("<<<<<<<")) {
          input.value = resolvedContent;
          this.debug("Pre-submission: Updated input");
        }
      });

      // Add the resolved content as a new hidden input as backup
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = "resolved_content_backup";
      hiddenInput.value = resolvedContent;
      form.appendChild(hiddenInput);

      this.debug("Added backup hidden input with resolved content");
    };

    // Add event listener with capture to run first
    form.addEventListener("submit", this.formSubmissionHandler, true);
    this.debug("Form submission interceptor installed");
  }

  aggressiveContentUpdate(content) {
    this.debug("Attempting aggressive content update...");

    // Method 1: Direct DOM manipulation
    const allTextareas = document.querySelectorAll("textarea");
    allTextareas.forEach((textarea, index) => {
      textarea.disabled = false;
      textarea.readOnly = false;
      textarea.value = content;

      // Force focus and trigger events
      textarea.focus();
      textarea.select();

      // Simulate typing to force GitHub to recognize the change
      const inputEvent = new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertReplacementText",
        data: content,
      });

      textarea.dispatchEvent(inputEvent);
      textarea.blur();

      this.debug(`Aggressively updated textarea ${index}`);
    });

    // Method 2: Try to find and click any "refresh" or "reload" buttons
    const refreshButtons = document.querySelectorAll(
      '[aria-label*="refresh"], [title*="refresh"], [data-hotkey*="r"]'
    );
    if (refreshButtons.length > 0) {
      this.debug("Found refresh button, clicking...");
      refreshButtons[0].click();
    }

    // Method 3: Create a visual indicator that the extension is working
    this.showContentPreview(content);
  }

  showContentPreview(content) {
    // Create a preview modal to show what content should be submitted
    const modal = document.createElement("div");
    modal.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 2px solid #0366d6;
            border-radius: 8px;
            padding: 16px;
            max-width: 400px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 9999;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            font-family: monospace;
            font-size: 12px;
        `;

    modal.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #0366d6;">
                🔧 Resolved Content Preview
            </div>
            <div style="margin-bottom: 8px; font-size: 11px; color: #666;">
                This is what should be committed:
            </div>
            <pre style="background: #f6f8fa; padding: 8px; border-radius: 4px; margin: 0; white-space: pre-wrap;">${content}</pre>
            <button onclick="this.parentElement.remove()" style="
                margin-top: 8px; 
                background: #0366d6; 
                color: white; 
                border: none; 
                padding: 4px 8px; 
                border-radius: 4px;
                cursor: pointer;
            ">Close</button>
        `;

    document.body.appendChild(modal);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (modal.parentElement) {
        modal.remove();
      }
    }, 10000);
  }

  showDebugInfo() {
    this.debug("Showing debug info...");

    const content = this.getContent();
    const allTextareas = document.querySelectorAll("textarea");
    const allInputs = document.querySelectorAll("input");
    const form = document.querySelector("form");

    const debugInfo = {
      currentContent: content,
      hasConflicts: content.includes("<<<<<<<"),
      textareaCount: allTextareas.length,
      inputCount: allInputs.length,
      formFound: !!form,
      textareas: Array.from(allTextareas).map((ta, i) => ({
        index: i,
        name: ta.name,
        className: ta.className,
        disabled: ta.disabled,
        readOnly: ta.readOnly,
        hasConflicts: ta.value.includes("<<<<<<<"),
        valueLength: ta.value.length,
      })),
      inputs: Array.from(allInputs).map((inp, i) => ({
        index: i,
        name: inp.name,
        type: inp.type,
        hasConflicts: inp.value.includes("<<<<<<<"),
        valueLength: inp.value.length,
      })),
    };

    // Create debug modal
    const modal = document.createElement("div");
    modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #0366d6;
            border-radius: 8px;
            padding: 20px;
            width: 80%;
            max-width: 800px;
            max-height: 80%;
            overflow-y: auto;
            z-index: 10000;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            font-family: monospace;
            font-size: 12px;
        `;

    modal.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 16px; color: #0366d6; font-size: 16px;">
                🔧 GitHub Merge Conflict Helper - Debug Info
            </div>
            <div style="margin-bottom: 12px;">
                <strong>Current Content Has Conflicts:</strong> ${
                  debugInfo.hasConflicts ? "❌ YES" : "✅ NO"
                }
            </div>
            <div style="margin-bottom: 12px;">
                <strong>Form Found:</strong> ${
                  debugInfo.formFound ? "✅ YES" : "❌ NO"
                }
            </div>
            <div style="margin-bottom: 12px;">
                <strong>Textareas Found:</strong> ${debugInfo.textareaCount}
            </div>
            <div style="margin-bottom: 12px;">
                <strong>Inputs Found:</strong> ${debugInfo.inputCount}
            </div>
            
            <details style="margin: 12px 0;">
                <summary style="cursor: pointer; font-weight: bold;">Current Content (first 500 chars)</summary>
                <pre style="background: #f6f8fa; padding: 8px; border-radius: 4px; margin: 8px 0; white-space: pre-wrap;">${content.substring(
                  0,
                  500
                )}${content.length > 500 ? "..." : ""}</pre>
            </details>
            
            <details style="margin: 12px 0;">
                <summary style="cursor: pointer; font-weight: bold;">Textarea Details</summary>
                <pre style="background: #f6f8fa; padding: 8px; border-radius: 4px; margin: 8px 0;">${JSON.stringify(
                  debugInfo.textareas,
                  null,
                  2
                )}</pre>
            </details>
            
            <details style="margin: 12px 0;">
                <summary style="cursor: pointer; font-weight: bold;">Input Details</summary>
                <pre style="background: #f6f8fa; padding: 8px; border-radius: 4px; margin: 8px 0;">${JSON.stringify(
                  debugInfo.inputs,
                  null,
                  2
                )}</pre>
            </details>
            
            <div style="margin-top: 16px; display: flex; gap: 8px;">
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #0366d6; 
                    color: white; 
                    border: none; 
                    padding: 8px 16px; 
                    border-radius: 4px;
                    cursor: pointer;
                ">Close</button>
                <button onclick="navigator.clipboard.writeText('${JSON.stringify(
                  debugInfo
                ).replace(
                  /'/g,
                  "\\'"
                )}').then(() => alert('Debug info copied!'))" style="
                    background: #28a745; 
                    color: white; 
                    border: none; 
                    padding: 8px 16px; 
                    border-radius: 4px;
                    cursor: pointer;
                ">Copy Debug Info</button>
            </div>
        `;

    // Add backdrop
    const backdrop = document.createElement("div");
    backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        `;

    backdrop.onclick = () => {
      backdrop.remove();
      modal.remove();
    };

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    console.log("Debug Info:", debugInfo);
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

// Initialize with better error handling
try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      new MergeConflictHelper();
    });
  } else {
    new MergeConflictHelper();
  }
} catch (error) {
  console.error("[Merge Helper] Initialization error:", error);
}
