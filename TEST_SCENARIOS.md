# PrismoPlayer Test Scenarios

## Test Environment
- **Dev Server**: http://localhost:5173/
- **Electron Build**: CJS format (main.cjs: 1.88MB, preload.cjs: 0.54KB)
- **Testing Date**: 2025-12-12

## 1. Application Launch Tests

### 1.1 Initial Startup
**Test Steps:**
1. Run `npm run dev`
2. Verify Vite server starts on port 5173
3. Verify Electron window opens
4. Verify no console errors in Electron DevTools (View → Toggle Developer Tools)

**Expected Results:**
- ✅ Electron window appears with PrismoPlayer UI
- ✅ No `TypeError: Cannot read properties of undefined` errors
- ✅ UI loads completely with all components visible

**Status:** Ready for testing

---

## 2. UI Functionality Tests

### 2.1 Movie Search
**Test Steps:**
1. Locate the search input in the main interface
2. Type a movie name (e.g., "Inception")
3. Press Enter or click Search button
4. Observe search results

**Expected Results:**
- ✅ Search input accepts text
- ✅ IPC communication works (no console errors)
- ✅ Movie results appear with titles, years, and posters
- ✅ Results show correct movie type (movie/series)

**Test Data:**
- "Inception" → Should return 2010 movie
- "Breaking Bad" → Should return TV series
- "Nonexistent Movie XYZ123" → Should return empty results gracefully

---

### 2.2 Movie Details View
**Test Steps:**
1. Search for a movie
2. Click on a movie result
3. Verify detail modal opens
4. Check all information displays correctly

**Expected Results:**
- ✅ Modal opens smoothly
- ✅ Movie poster loads
- ✅ Title, year, and type display
- ✅ "Find Torrents" button is visible

---

## 3. Torrent Functionality Tests

### 3.1 Torrent Search
**Test Steps:**
1. Open movie details for "Inception"
2. Click "Find Torrents" button
3. Wait for torrent search to complete
4. Verify results appear

**Expected Results:**
- ✅ Loading indicator appears
- ✅ Multiple torrent sources queried (YTS, APIBay, EZTV, TorrentsCSV, BitSearch)
- ✅ Results sorted by score (quality, seeders)
- ✅ NSFW content filtered out
- ✅ Console shows source breakdown:
  ```
  [Torrent] Source: YTS          | Results: X
  [Torrent] Source: APIBay       | Results: X
  [Torrent] Source: TorrentsCSV  | Results: X
  [Torrent] Source: BitSearch    | Results: X
  ```

**Test IMDb IDs:**
- `tt1375666` (Inception)
- `tt0903747` (Breaking Bad - for EZTV series test)

---

### 3.2 Torrent Streaming
**Test Steps:**
1. Select a torrent from search results
2. Click to start streaming
3. Monitor console for WebTorrent initialization
4. Wait for video to start buffering

**Expected Results:**
- ✅ WebTorrent client initializes without errors
- ✅ Cache directory created at `userData/PrismoPlayerCache`
- ✅ Torrent progress events emitted
- ✅ Video server starts on `localhost:PORT`
- ✅ If multiple video files, file selection dialog appears
- ✅ Console shows:
  ```
  [Torrent] Metadata downloaded.
  [Torrent] Total files: X
  [Torrent] Auto-selected single file: filename.mp4
  [Torrent] Server ready at: http://localhost:XXXXX/0
  ```

**Known Behaviors:**
- First chunks download before playback starts
- Progress updates every 1 second via IPC
- Upload limited by settings (default: uploadLimitKB * 1024)

---

## 4. Video Player Tests

### 4.1 Basic Playback
**Test Steps:**
1. Start streaming a torrent
2. Video player loads with the stream URL
3. Click play button
4. Test playback controls (play/pause, volume, fullscreen)

**Expected Results:**
- ✅ Video loads and plays smoothly
- ✅ Playback controls respond correctly
- ✅ Progress bar updates
- ✅ Volume control works
- ✅ Fullscreen toggle works

---

### 4.2 Audio Track Switching
**Test Steps:**
1. Play a video with multiple audio tracks
2. Open audio track menu
3. Switch between available tracks

**Expected Results:**
- ✅ All audio tracks listed
- ✅ Current track indicated
- ✅ Switching works without interrupting playback

---

## 5. Subtitle Tests

### 5.1 Subtitle Search
**Test Steps:**
1. Play a video
2. Click subtitle button
3. Search for subtitles (requires IMDb ID)
4. Verify results from YIFY and OpenSubtitles

**Expected Results:**
- ✅ Turkish subtitles appear first (if available)
- ✅ Subtitles sorted by rating
- ✅ Sources indicated (YIFY/OpenSubtitles)
- ✅ Console shows:
  ```
  [YIFY] Listing from: https://yifysubtitles.org/movie-imdb/ttXXXXXXX
  [OpenSubtitles] Listing from: https://api.opensubtitles.com/...
  ```

**Test Data:**
- Movie with Turkish subs: "Inception" (tt1375666)
- English only: Most Hollywood movies

---

### 5.2 Subtitle Download & Display
**Test Steps:**
1. Select a subtitle from results
2. Click download
3. Wait for subtitle to load
4. Verify subtitle appears on video

**Expected Results:**
- ✅ ZIP file downloaded and extracted (YIFY)
- ✅ SRT converted to VTT format
- ✅ Turkish encoding handled correctly (windows-1254)
- ✅ Subtitle file saved to `userData/PrismoPlayerSubs`
- ✅ Subtitle displays on video at correct timestamps

---

## 6. Settings Tests

### 6.1 Settings Persistence
**Test Steps:**
1. Open settings
2. Change upload limit
3. Toggle any boolean settings
4. Close and reopen app
5. Verify settings persisted

**Expected Results:**
- ✅ Settings saved to `userData/settings.json`
- ✅ Settings load on app restart
- ✅ Default settings created if file doesn't exist

**Settings to Test:**
- `uploadLimitKB` (default: 1024)
- `openSubtitlesApiKey` (optional)
- Any Family Safety settings (if implemented)

---

### 6.2 Cache Management
**Test Steps:**
1. Stream several videos to populate cache
2. Open settings
3. Click "Clear Cache" button
4. Verify cache directory emptied

**Expected Results:**
- ✅ All torrents stopped
- ✅ Cache directory cleared: `userData/PrismoPlayerCache`
- ✅ Subtitle cache remains: `userData/PrismoPlayerSubs`
- ✅ No errors in console

---

## 7. IPC Communication Tests

### 7.1 Renderer → Main IPC
**Test Steps in DevTools Console:**
```javascript
// Test movie search
await window.ipcRenderer.invoke('search-movie', 'Inception')

// Test torrent search
await window.ipcRenderer.invoke('search-torrent', 'Inception 1080p')

// Test parents guide
await window.ipcRenderer.invoke('get-parents-guide', 'tt1375666')

// Test settings
await window.ipcRenderer.invoke('get-settings')
await window.ipcRenderer.invoke('update-settings', { uploadLimitKB: 2048 })

// Test subtitle search
await window.ipcRenderer.invoke('list-subtitles', 'tt1375666')
```

**Expected Results:**
- ✅ All IPC calls return valid responses
- ✅ No `undefined` errors
- ✅ Data structures match expected types

---

### 7.2 Main → Renderer IPC
**Test Steps:**
1. Start torrent streaming
2. Open DevTools Console
3. Monitor for `torrent-progress` events

**Expected in Console:**
```javascript
// Listen for events
window.ipcRenderer.on('torrent-progress', (event, data) => {
  console.log('Progress:', data);
});
```

**Expected Results:**
- ✅ Progress events emitted every ~1 second
- ✅ Data includes: `downloadSpeed`, `progress`, `numPeers`, `downloaded`, `length`

---

## 8. Error Handling Tests

### 8.1 Network Failures
**Test Steps:**
1. Disconnect from internet
2. Try to search for movies
3. Try to download subtitles
4. Verify graceful error handling

**Expected Results:**
- ✅ No app crashes
- ✅ User-friendly error messages
- ✅ Console shows error logs but app remains functional

---

### 8.2 Invalid IMDb IDs
**Test Steps:**
1. Manually trigger IPC with invalid IMDb ID:
```javascript
await window.ipcRenderer.invoke('get-parents-guide', 'invalid123')
```

**Expected Results:**
- ✅ Returns empty array or error message
- ✅ No app crash
- ✅ Console logs error gracefully

---

## 9. Series-Specific Tests

### 9.1 Series Details
**Test Steps:**
1. Search for "Breaking Bad"
2. Open series details
3. Verify season/episode structure loads

**Expected Results:**
- ✅ All seasons detected (5 for Breaking Bad)
- ✅ Episodes listed with titles, air dates, plots
- ✅ Episode ratings displayed
- ✅ Episode thumbnails load

---

### 9.2 Episode Selection
**Test Steps:**
1. Open series details
2. Select a specific episode
3. Click "Find Torrents"
4. Verify EZTV results appear

**Expected Results:**
- ✅ EZTV API queried with IMDb ID
- ✅ Episode-specific torrents shown
- ✅ Torrent names match selected episode

---

## 10. Performance Tests

### 10.1 Large Search Results
**Test Steps:**
1. Search for very common term (e.g., "The")
2. Monitor memory usage
3. Scroll through results

**Expected Results:**
- ✅ UI remains responsive
- ✅ No memory leaks
- ✅ Pagination or virtualization handles large lists

---

### 10.2 Concurrent Operations
**Test Steps:**
1. Start a torrent download
2. While downloading, search for subtitles
3. While subtitle searching, search for another movie

**Expected Results:**
- ✅ All operations proceed independently
- ✅ No race conditions or deadlocks
- ✅ Progress updates continue smoothly

---

## Test Checklist Summary

**Critical Path (Must Pass):**
- [ ] App launches without errors
- [ ] Movie search returns results
- [ ] Torrent search works
- [ ] Video playback starts
- [ ] Subtitles download and display
- [ ] Settings save/load

**Important Features:**
- [ ] Series episode listing
- [ ] Audio track switching
- [ ] Cache clearing
- [ ] IPC bidirectional communication

**Edge Cases:**
- [ ] Network error handling
- [ ] Invalid input handling
- [ ] Multiple file selection (torrents)
- [ ] Missing subtitle handling

---

## Debugging Tips

### Enable Verbose Logging
Open Electron DevTools and check Console for:
- `[Torrent]` logs for streaming issues
- `[YIFY]` / `[OpenSubtitles]` for subtitle issues
- `[Scraper]` for movie/series data issues
- `[Cache]` for storage issues

### Check File System
Monitor these directories:
- `~/Library/Application Support/prismo-player/` (macOS)
  - `settings.json`
  - `PrismoPlayerCache/`
  - `PrismoPlayerSubs/`

### Network Tab
Use DevTools Network tab to verify:
- API calls to YTS, APIBay, EZTV, etc.
- Torrent tracker connections
- Subtitle file downloads

### Process Manager
Monitor Electron/Node processes:
```bash
ps aux | grep -i electron
ps aux | grep -i prismo
```

---

## Automated Test Scripts (Future Implementation)

Consider adding:
- Unit tests for torrent-search aggregation
- Integration tests for IPC handlers
- E2E tests with Playwright/Spectron
- Subtitle parser unit tests
- Mock API responses for offline testing
