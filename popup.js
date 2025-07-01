// Check if we're on a GitHub page with conflicts
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const currentTab = tabs[0];
  const statusDiv = document.getElementById("status");

  if (currentTab.url.includes("github.com")) {
    // We're on GitHub, but need to check if conflicts are present
    chrome.tabs.sendMessage(
      currentTab.id,
      { action: "checkConflicts" },
      function (response) {
        if (chrome.runtime.lastError) {
          statusDiv.className = "status inactive";
          statusDiv.textContent =
            "Extension ready - navigate to a conflict page";
        } else if (response && response.hasConflicts) {
          statusDiv.className = "status active";
          statusDiv.textContent = `Active - ${response.conflictCount} conflicts detected`;
        } else {
          statusDiv.className = "status inactive";
          statusDiv.textContent = "No merge conflicts detected on this page";
        }
      }
    );
  } else {
    statusDiv.className = "status inactive";
    statusDiv.textContent = "Please navigate to GitHub.com";
  }
});
