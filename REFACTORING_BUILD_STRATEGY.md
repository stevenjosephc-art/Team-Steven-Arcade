# Team Steven Arcade - Refactoring Build & Extraction Strategy

**Status:** Planning Document (Step 3 - Refactoring Preparation)
**Target File:** `javascript.html` (~13,000 lines)
**Constraint:** Planning and build-strategy design only. NO application code changes, file moves, renames, deletions, or PR code modifications are permitted in this task.

---

## 1. Current Build/Loading Mechanism

**CONFIRMED:** The Team Steven Arcade application uses a Google Apps Script (GAS) server-side template inclusion pattern to combine HTML, CSS, and client-side JavaScript into a single web response at runtime.

### How `Index.html` Loads Client Code
1. In `Code.gs`, the primary web app endpoint `doGet()` serves `Index.html`:
   ```javascript
   function doGet(e) {
     return HtmlService.createTemplateFromFile('Index').evaluate()
       .setTitle('Google Play Arcade')
       .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
   }
   ```
2. In `Index.html`, server-side scriptlets include external HTML snippets:
   - `<?!= include('Stylesheet'); ?>` (L5 in `Index.html`)
   - `<?!= include('PokemonData.js'); ?>` (L738 in `Index.html`)
   - `<?!= include('JavaScript'); ?>` (L739 in `Index.html`)
3. In `Code.gs`, the `include(filename)` helper retrieves file contents:
   ```javascript
   function include(filename) {
     return HtmlService.createHtmlOutputFromFile(filename).getContent();
   }
   ```

### Current Local Bundling Mechanism (`bundle.py`)
- **Purpose:** Local Python script used for automated testing (Playwright) outside the Google Apps Script runtime.
- **Input:** Reads `Index.html`.
- **Processing:** Performs regex string replacement `re.sub(r'<\?!= include\(\'(.+?)\'\); \?>', include_file, index_content)`.
- **Script Wrapping:** Automatically wraps `.js.html` or `javascript.html` files in `<script>...</script>` tags if missing.
- **Mock Injection:** Injects a mock `window.google.script.run` object before `</head>` to simulate server RPCs during headless browser tests.
- **Output:** Generates `bundled.html` (used locally for testing; never committed to git).

---

## 2. Google Apps Script Compatibility & Environment Rules

**CONFIRMED:** The frontend refactor must operate strictly within the constraints of the Google Apps Script HTML Service (`HtmlService`).

| Architectural Factor | Technical Behavior in GAS | Status | Risk / Guidance |
| :--- | :--- | :---: | :--- |
| **Script Execution Scope** | All included `<script>` blocks run in a shared global `window` context inside the rendered HTML document. | **CONFIRMED** | **Low Risk:** Functions and variables declared globally in earlier `<script>` tags are immediately accessible to later `<script>` tags. |
| **Execution Order** | `<script>` blocks execute strictly in top-to-bottom document order as they appear in `Index.html`. | **CONFIRMED** | **Critical:** Order of inclusion must be strictly controlled to prevent `ReferenceError` calls before declaration. |
| **`var` vs `let` / `const` Across Files** | Top-level `var` and `function` declarations register properties on `window`. Top-level `let` and `const` do NOT register on `window` and throw `SyntaxError` if declared twice across files. | **CONFIRMED** | **High Risk:** Preserve standard function declarations or explicit `window.x` assignments to avoid scope conflicts. |
| **ES Modules (`type="module"`)** | Native ES modules using relative import paths (`import { x } from './file.js'`) fail in GAS HTML Service because GAS serves content via blob/data URIs. | **CONFIRMED** | **Prohibited:** Do NOT use ES modules (`type="module"` or dynamic `import()`). Rely on concatenated/included script blocks. |
| **`google.script.run` RPC Availability** | `google.script.run` is globally attached to `window.google.script.run` by GAS runtime before scripts execute. | **CONFIRMED** | **Low Risk:** Available globally to all extracted modules without imports. |
| **Content Security Policy (CSP)** | GAS executes inside a sandboxed iframe. Inline scripts inside `<script>` tags are permitted. | **CONFIRMED** | **Safe:** Plain `<script>` tags are natively supported. |

---

## 3. Global Scope Strategy

**CONFIRMED:** The current monolith relies heavily on shared global variables and global function visibility.

To ensure **zero regression**, the initial refactoring phases MUST preserve the existing global declaration model.

### Global Strategy Rules:
1. **Preserve Function Declarations:** Extracted functions must remain standard top-level function declarations (`function playSound(...)`) or explicit `window` assignments (`window.playSound = ...`).
2. **Global Variables Registry:** Variables consumed across multiple subsystems (`score`, `currentPlayerLevel`, `soundEnabled`, `masterVolume`) will be initialized in a core state module (`src/core/AppState.js.html`) prior to dependent scripts.
3. **RPC Callbacks:** Functions called by `google.script.run` success/failure handlers must remain globally exposed on `window`.

---

## 4. Proposed Load Order

The proposed script inclusion sequence in `Index.html` enforces strict dependency precedence:

```text
1. Stylesheet.html                   (Design System & Layout)
        ↓
2. src/core/AppState.js.html         (Global Variables & Version Lock)
        ↓
3. src/data/PokemonData.js.html      (Static Metadata & Lookup Tables)
        ↓
4. src/audio/AudioSubsystem.js.html  (Web Audio Synth & BGM Manager)
        ↓
5. src/services/RPCGateway.js.html   (Wrapper around google.script.run)
        ↓
6. src/ui/UIComponents.js.html       (Tabs, Bento Cards, Toasts, Modals)
        ↓
7. src/services/WalletService.js.html(XP, Tickets, Store, Bounties)
        ↓
8. src/modules/CasinoSuite.js.html   (Slots, Blackjack, Baccarat, Derby)
        ↓
9. src/modules/PokemonPlay.js.html   (Pokemon RPG Combat & GTS Market)
        ↓
10. src/games/ArcadeGames.js.html    (Canvas & DOM Mini-Game Engines)
        ↓
11. src/core/AppInit.js.html         (DOMContentLoaded Bootstrapper & Listeners)
```

### Dependency Rules:
- **Hard Dependencies:** `AppState` and `AudioSubsystem` MUST load before any game engines or UI listeners.
- **Soft Dependencies:** Mini-game engines register into `GAMES` object; `Catalog.js` reads `GAMES` at UI render time.
- **Bootstrapper:** `AppInit.js.html` MUST load last to trigger `DOMContentLoaded` after all modules and event listeners are registered.

---

## 5. `bundle.py` Assessment & Technical Analysis

**CONFIRMED:** A line-referenced analysis of `bundle.py` reveals key limitations that must be addressed before multi-file refactoring begins.

### `bundle.py` Line-by-Line Breakdown:
- **L4–L38 (`include_file(match)`):** Resolves filename matches against root directory. Automatically wraps `.js.html` files in `<script>...</script>` tags if not present.
- **L40–L45 (`index_content` substitution):** Reads `Index.html` and executes single-pass regex replacement:
  ```python
  bundled_content = re.sub(r'<\?!= include\(\'(.+?)\'\); \?>', include_file, index_content)
  ```
- **L48–L75 (`mock_script` injection):** Inserts mock `google.script.run` before `</head>`.
- **L77–L78 (`bundled.html` output):** Writes consolidated file for local Playwright tests.

### Key Limitations & Recommendations:
1. **No Recursive Includes (CONFIRMED):** `bundle.py` currently executes a single non-recursive `re.sub` pass over `Index.html`. If an included file contains nested `include()` calls, they will NOT be resolved.
   - *Recommendation:* Maintain all `include('path/file')` directives directly inside `Index.html` rather than using nested includes.
2. **Directory Traversal (CONFIRMED):** `bundle.py` currently checks `filename + ext` and `filename.lower() + ext` in the root folder. It does not search subdirectories like `src/audio/`.
   - *Recommendation:* Update `include_file()` in `bundle.py` to support relative directory paths (e.g., `<?!= include('src/audio/AudioSubsystem'); ?>`) when file splitting begins.

---

## 6. Proposed Source Structure

```text
Team-Steven-Arcade/
├── Index.html                       # Primary HTML Shell & Include Manifest
├── stylesheet.html                  # CSS Design System
├── Code.gs                          # Backend GAS Entry Points & RPC Handlers
├── bundle.py                        # Local Playwright Test Bundler
├── ARCHITECTURE.md                  # System Architecture Inventory
├── REFACTORING_BLUEPRINT.md         # Monolith Analysis Blueprint
├── REFACTORING_BUILD_STRATEGY.md    # Build Strategy & Safety Rules
└── src/                             # Extracted Modular Frontend Source
    ├── core/
    │   ├── AppState.js.html         # Global State Variables (L1-L18)
    │   ├── RPCGateway.js.html       # RPC Handlers & Error Catchers
    │   └── AppInit.js.html          # Bootstrapper & Global Hotkeys (L12496-L12670)
    ├── audio/
    │   └── AudioSubsystem.js.html   # BGM Playlist & Web Audio Synth (L19-L206, L244-L482)
    ├── ui/
    │   ├── UIComponents.js.html     # Tabs, Bento Cards, Toasts, Modals
    │   └── Carousel.js.html         # Banner Carousel (L207-L243)
    ├── services/
    │   ├── WalletService.js.html    # XP, Tickets, Store, Bounties (L12113-L12495)
    │   └── LeaderboardService.js.html # Hall of Fame & Rankings (L11761-L11943)
    ├── modules/
    │   ├── CasinoSuite.js.html      # Slots, Blackjack, Baccarat, Derby (L8716-L9221)
    │   └── PokemonPlay.js.html      # Pokemon Combat & GTS Market (L2074-L4745)
    └── games/
        └── ArcadeGames.js.html      # 22 Self-Contained Canvas/DOM Game Engines
```

---

## 7. First Extraction Target: Detailed Audio Subsystem Evaluation

**CONFIRMED:** The Audio Subsystem is the safest candidate for Task 1 of implementation.

### Exact Source Line Ranges in `javascript.html`:
1. **L19–L27:** Lobby playlist array definition (`lobbyPlaylist`).
2. **L244–L274:** BGM Audio Controller (`playBGM`, track switching logic).
3. **L275–L368:** Volume controller & Mute toggle (`updateVolume`, `toggleSound`, `soundEnabled`, `masterVolume`).
4. **L369–L482:** Web Audio API synthesizer (`audioCtx`, `getAudioCtx`, `playSound`, `playBeep`, 15 synthesized sound effects).

### Dependency Surface Analysis:

| Factor | Technical Detail | Status |
| :--- | :--- | :---: |
| **Globals Consumed** | `localStorage` (`arcade_vol`), HTML Audio elements (`#bgmLobby`, `#bgmCasino`, `#bgmGame`), `#soundBtn` DOM buttons. | **CONFIRMED** |
| **Globals Created / Exposed** | `lobbyPlaylist`, `currentLobbyTrack`, `currentBGM`, `soundEnabled`, `masterVolume`, `audioCtx`, `playBGM`, `toggleSound`, `updateVolume`, `playSound`, `playBeep`, `getAudioCtx`. | **CONFIRMED** |
| **External Functions Called** | None. Audio functions are 100% self-contained. | **CONFIRMED** |
| **Functions Calling Audio** | 271 `playSound()` calls across all 27 games; 6 `playBGM()` calls in `showTab` navigation and game launcher; `updateVolume()` called by Settings modal. | **CONFIRMED** |
| **Hidden / Indirect Coupling** | `showTab(id)` in `javascript.html` (L471) directly calls `playBGM('bgmCasino')` or `playBGM('bgmLobby')`. `openGameModal()` (L11417) calls `playBGM('bgmGame')`. `visibilitychange` listener (L554) pauses `currentBGM`. | **CONFIRMED** |
| **Extraction Risk** | **LOW.** As long as `AudioSubsystem.js.html` loads before UI navigation and games, zero call sites need modification. | **CONFIRMED** |

---

## 8. Verification Strategy

Every extraction step must pass a 4-tier verification protocol:

### 1. Build Verification
- Execute `python3 bundle.py` locally.
- Verify `bundled.html` generates cleanly with zero syntax errors.
- Confirm extracted code blocks appear in `bundled.html` in correct load order without duplicates.

### 2. Browser Runtime Verification
- Open `bundled.html` in browser.
- Verify application boots up, header stats render, and initial BGM loads.
- Verify tab navigation (`showTab`) works smoothly.
- Test sound toggle (`#soundBtn`) and volume slider in Settings.

### 3. Backend RPC Verification
- Confirm mock/live `google.script.run` endpoints receive requests and update wallet/XP balances.

### 4. Representative Game Verification
- Test 1 Arcade Game (e.g., `Basketball Hoops` or `2048`).
- Test 1 Casino Game (e.g., `High-Roller Slots`).
- Test 1 Complex RPG (e.g., `Pokemon Play`).
- Confirm sound effects (`playSound`) and score submissions function cleanly.

---

## 9. Rollback Strategy

Each extraction task must be isolated in a single, atomic git commit.

If a regression is discovered during testing:
```bash
# 1. Reset working directory to previous clean commit
git reset --hard HEAD~1

# 2. Re-run bundle check
python3 bundle.py

# 3. Confirm application returns to 100% working state
```

---

## 10. Refactoring Safety Rules

1. **One Subsystem at a Time:** Extract only one logical subsystem per task.
2. **One Logical Extraction per Commit:** Never combine multiple extractions into a single commit.
3. **Zero Gameplay Changes:** Physics, rules, and scoring logic must not be modified.
4. **Zero Visual Redesign:** CSS styles and layout HTML must remain unchanged.
5. **Zero Backend Changes:** `Code.gs` logic must remain untouched unless explicitly required.
6. **Zero Security Changes:** Security tokens and level gating rules must remain intact.
7. **Preserve Global APIs:** Extracted functions must remain globally accessible on `window`.
8. **Preserve Execution Order:** Extracted modules must be included in `Index.html` in strict load order.
9. **Test After Every Step:** Run build and browser verification immediately after extracting a module.
10. **Clean Working Tree:** Delete temporary build artifacts (like `bundled.html`) before committing.
11. **Do Not Delete Unverified Code:** Never remove code that appears unused without static verification.
12. **Do Not Combine Cleanup with Extraction:** Keep structural extraction distinct from code refactoring.
13. **Do Not Alter Behavior & Structure Simultaneously:** Keep structural changes 100% behavior-neutral.

---

## 11. Recommended Workflow

```text
1. Create new extracted file in src/<subsystem>/<FileName>.js.html
        ↓
2. Copy target source lines from javascript.html into new file
        ↓
3. Remove extracted lines from javascript.html
        ↓
4. Add <?!= include('src/<subsystem>/<FileName>'); ?> to Index.html in correct load order
        ↓
5. Run python3 bundle.py and verify bundled.html locally
        ↓
6. Delete temporary bundled.html file
        ↓
7. Commit changes with message: refactor(frontend): extract <subsystem> module
```

---

## 12. Final Recommendation

### Recommended Build Strategy
Utilize Google Apps Script's native `<?!= include('path/filename'); ?>` template inclusion mechanism directly in `Index.html`. Update `bundle.py` to support directory path includes during local Playwright testing. Maintain standard global function/variable declarations across extracted files to guarantee 100% backward compatibility without modifying call sites.

---

### First Implementation Task (When Approved)

**Task Title:** Update `bundle.py` for directory paths & extract Audio Subsystem to `src/audio/AudioSubsystem.js.html`.

**Scope:**
1. Update `bundle.py` `include_file()` helper to support nested directory paths (e.g. `src/audio/AudioSubsystem`).
2. Create `src/audio/AudioSubsystem.js.html`.
3. Move Audio Subsystem code (L19–L27, L244–L482) from `javascript.html` into `src/audio/AudioSubsystem.js.html`.
4. Add `<?!= include('src/audio/AudioSubsystem'); ?>` to `Index.html` prior to `JavaScript` inclusion.
5. Test and verify build, audio playback, sound toggle, and `playSound()` calls across all games.
