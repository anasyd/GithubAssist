# GitHub Merge Conflict Helper

A Chrome browser extension that simplifies resolving merge conflicts on GitHub by adding intuitive one-click buttons for conflict resolution.

## Features

- **Individual Conflict Resolution**: Add "Accept Current" and "Accept Incoming" buttons above each conflict section
- **Bulk Operations**: "Accept All Current" and "Accept All Incoming" buttons at the top of the file
- **Real-time Status**: Shows remaining conflict count and resolution status
- **Branch Name Display**: Shows which branch each conflict section comes from
- **Responsive Design**: Works on both desktop and mobile GitHub interfaces

## How It Works

When you open a file with merge conflicts on GitHub, the extension automatically detects conflict markers and adds helpful buttons:

### For Individual Conflicts
```
Accept Current (feat/initial-expo-migration) | Accept Incoming (main)
<<<<<<< feat/initial-expo-migration
your current branch code
=======
incoming branch code
>>>>>>> main
```

### Global Controls
At the top of the file, you'll see:
- **Accept All Current**: Resolves all conflicts by keeping your current branch changes
- **Accept All Incoming**: Resolves all conflicts by accepting the incoming branch changes
- **Status Indicator**: Shows how many conflicts remain

## Installation

1. **Download the Extension Files**
   - Save all the provided files in a folder (manifest.json, content.js, styles.css, popup.html)

2. **Load the Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select your extension folder
   - The extension should now appear in your Chrome toolbar

3. **Add Icons (Optional)**
   - Create icon files named `icon16.png`, `icon48.png`, and `icon128.png`
   - Place them in the same folder as your other extension files
   - The extension will work without icons, but they make it look more professional

## Usage

1. Navigate to any GitHub repository with merge conflicts
2. Open a file that contains conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
3. The extension will automatically add resolution buttons
4. Click the appropriate button to resolve conflicts:
   - **Accept Current**: Keep the code from your current branch
   - **Accept Incoming**: Accept the code from the branch being merged
   - **Accept All Current/Incoming**: Resolve all conflicts in the file at once

## File Structure

```
github-merge-helper/
├── manifest.json          # Extension configuration
├── content.js            # Main functionality
├── styles.css            # Extension styling
├── popup.html            # Extension popup interface
├── README.md             # This file
└── icons/                # Extension icons (optional)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: Only requires `activeTab` permission
- **Compatibility**: Works with GitHub's modern interface
- **Framework**: Vanilla JavaScript (no dependencies)

## Supported GitHub Features

- ✅ File editor conflicts (editable text areas)
- ✅ Read-only conflict view
- ✅ Pull request conflict resolution
- ✅ Direct file editing conflicts
- ✅ GitHub's PJAX navigation

## Browser Compatibility

- Chrome (Recommended)
- Edge (Chromium-based)
- Other Chromium-based browsers

## Troubleshooting

**Extension not working?**
- Make sure you're on a GitHub page with actual merge conflicts
- Refresh the page after installing the extension
- Check that the extension is enabled in Chrome settings

**Buttons not appearing?**
- Wait for the page to fully load (the extension waits 1 second)
- Try refreshing the page
- Ensure the file actually contains conflict markers

**Changes not saving?**
- The extension modifies the text area content and triggers change events
- Make sure to commit your changes through GitHub's interface after resolving

## Contributing

This extension can be enhanced with additional features:
- Support for more complex conflict scenarios
- Integration with GitHub CLI
- Keyboard shortcuts
- Conflict history tracking
- Custom conflict resolution rules

## License

This project is open source and available under the MIT License.