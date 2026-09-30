# Team Steven Arcade - Frontend Refactoring Blueprint (`javascript.html`)

**Status:** Planning Document (Step 2 - Refactoring Preparation)
**Target File:** `javascript.html` (13,054 lines)
**Constraint:** Planning and structural blueprint only. NO application code changes, file moves, renames, deletions, or PR code modifications are permitted in this step.

---

## 1. Map the Entire `javascript.html`

The `javascript.html` file is a monolithic client-side JavaScript bundle wrapped in `<script>` tags. The following map outlines its complete internal structure from L1 to L13054.

| Line Range | Major Section / Component | Key Functions / Objects / Globals | Purpose & Summary | Dependencies | Coupling & Reusability |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **L1–L18** | Global State & Config | `score`, `currentPlayerLevel`, `reqAnimFrame`, `canvas`, `domEngine`, `globalUserLdap`, `activeSecurityToken`, `CLIENT_VERSION` | Initializes core global state variables and client version lock. | Browser window/document | **Tightly Coupled / Confirmed** — Read/written by almost all systems. |
| **L19–L206** | Lobby Radio Station & Carousel | `lobbyPlaylist`, `currentLobbyTrack`, `_buildCarouselSlides`, `carouselSlides` | Manages background audio track listing and dynamic top banner carousel slides. | `_cachedRankings`, `GAMES`, DOM elements | **Shared / Confirmed** — Depends on game definitions and leaderboard cache. |
| **L207–L274** | Carousel Helper Utilities | Carousel navigation event bindings | Handles left/right arrow clicks and automatic slide rotation for the top banner. | DOM `.carousel-slide` | **Shared UI / Confirmed** — Self-contained carousel UI logic. |
| **L275–L368** | Audio Controller & System SFX | `initBGM`, `playBGM`, `playSound`, `playBeep`, `soundEnabled`, `masterVolume` | Web Audio API synthesizer and HTML5 Audio manager for background music and sound effects. | `#bgmLobby`, `AudioContext`, `localStorage` | **Shared Core / Confirmed** — Reusable audio subsystem used by all 27 games. |
| **L369–L482** | Web Audio SFX Generators | AudioContext tone generators for game interactions | Synthesizes retro sounds (jump, laser, coin, explosion, win, lose) without external asset files. | `audioCtx`, `masterVolume` | **Shared Utility / Confirmed** — Pure functional sound generator. |
| **L483–L553** | Hotkeys & Accessibility | Universal `keydown` listener, Konami code, Babi code, ARIA keyboard helpers | Handles Enter/Space triggers for `role="button"`, roving tabindex, '/' search shortcut, and cheat codes. | DOM focus, active tab | **Core Application / Confirmed** — Tightly bound to global window events. |
| **L554–L586** | Auto-Pause & Tab Focus | `visibilitychange` listener | Automatically pauses active game engine and background music when browser tab loses focus. | `currentBGM`, active game engine | **Core Application / Confirmed** — Depends on active game state. |
| **L587–L640** | How-To Instructions & Data Maps | `HOW_TO`, `POKEMON_WEAKNESS`, `POKEDEX_MAP` | Static lookup dictionaries mapping game keys to instructional text and Pokemon metadata. | `PokemonData.js.html` | **Shared Data / Confirmed** — Used by game detail modals and Pokemon Play. |
| **L641–L1114** | Game 1: Pou (Virtual Pet) | `GAMES['Pou']` (`init`, `_tick`, `_feed`, `_save`, `_load`) | Virtual pet game with hunger/health/fun meters and local persistent state. | DOM elements, `localStorage` | **Self-Contained Game / Confirmed** — Reads/writes local storage. |
| **L1115–L1416** | Game 2: Basketball Hoops | `GAMES['Basketball Hoops']` (`init`, `update`, `draw`, `resetBall`) | Canvas-based arcade basketball shooting game with trajectory physics. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Standard canvas engine. |
| **L1417–L1633** | Game 3: Darts | `GAMES['Darts']` (`init`, `resolveThrow`, `update`) | Canvas dart throwing game with wind wobble calculations. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Standard canvas engine. |
| **L1634–L1889** | Game 4: 8-Ball Pool | `GAMES['8-Ball Pool']` (`init`, `potBall`, `update`, `draw`) | Canvas 2D physics pool simulation with elastic ball collisions and ghost ball aiming line. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Heavy self-contained physics loop. |
| **L1890–L2073** | Game 5: Block Blast | `GAMES['Block Blast']` (`init`, `generatePieces`, `place`, `draw`) | Canvas grid puzzle game where players place block shapes onto an 8x8 grid. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Independent grid engine. |
| **L2074–L4745** | Game 6: Pokemon Play | `GAMES['Pokemon Play']` (`init`, `renderHub`, `executeTurn`, `buyItem`) | Massive RPG engine featuring turn-based combat, move calculations, inventory, binder, safari mode, and GTS marketplace. | `POKEDEX`, `google.script.run`, DOM | **High Coupling / Confirmed** — Tightly coupled to backend GTS, wallet, and static Pokemon data. |
| **L4746–L5166** | Game 7: Cafe Tycoon | `GAMES['Cafe Tycoon']` (`init`, `click`, `update`, `draw`) | Canvas cooking management simulation with customer queue and heat meter UI. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Independent timer and order logic. |
| **L5167–L5582** | Game 8: Candy Run | `GAMES['Candy Run']` (`init`, `spawnPlatform`, `update`, `draw`) | Endless runner canvas game with jumping, platform generation, and collision detection. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Independent runner loop. |
| **L5583–L5644** | Game 9: Severity 1: Core Breach | `GAMES['Severity 1: Core Breach']` (`init`, `update`, `draw`) | Rapid action defense canvas game. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Minimal canvas loop. |
| **L5645–L5746** | Game 10: Piano Tiles | `GAMES['Piano Tiles']` (`init`, `playNote`, `processInput`, `update`) | Rhythm tile-tapping canvas game with streak combo logic. | `canvas`, `ctx`, `playSound` | **Self-Contained Canvas Game / Confirmed** — Independent timing engine. |
| **L5747–L5796** | Game 11: PacMan | `GAMES['PacMan']` (`init`, `buildLevel`, `update`, `draw`) | Grid maze canvas game with ghost AI pathfinding. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Independent maze engine. |
| **L5797–L6524** | Game 12: Candy Crush | `GAMES['Candy Crush']` (`init`, `analyzeBoard`, `doSwap`, `findHintMove`) | Match-3 canvas puzzle game with gravity cascade drops and hint solver. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Complex grid solver. |
| **L6525–L6810** | Game 13: Tetris | `GAMES['Tetris']` (`init`, `createPiece`, `collide`, `merge`, `update`) | Canvas block falling puzzle game featuring SRS-lite wall kick system and ghost piece renderer. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — SRS rotation logic. |
| **L6811–L7018** | Game 14: Minesweeper | `GAMES['Minesweeper']` (`init`, `placeMines`, `reveal`, `update`) | Grid mine clearing canvas game with particle explosion visual effects. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Grid matrix logic. |
| **L7019–L7511** | Game 15: 2048 | `GAMES['2048']` (`init`, `addTile`, `handleKey`, `update`, `draw`) | Sliding block tile merger canvas game with animated merging and score tracking. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Grid sliding logic. |
| **L7512–L7807** | Game 16: Battleship | `GAMES['Battleship']` (`init`, `canPlace`, `click`, `computeProbabilityGrid`) | 10x10 grid naval target shooting canvas game with probability AI overlay. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Independent naval grid AI. |
| **L7808–L8224** | Game 17: Connect Four | `GAMES['Connect Four']` (`init`, `attemptDrop`, `attemptHint`, `startDrop`) | Connect 4 token drop canvas game with Minimax AI decision tree. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Minimax solver engine. |
| **L8225–L8715** | Game 18: Spam Defender | `GAMES['Spam Defender']` (`init`, `spawnWave`, `update`, `draw`) | Tower defense style filter canvas game with wave management. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Independent wave loop. |
| **L8716–L8834** | Game 19: High-Roller Slots | `GAMES['High-Roller Slots']` (`init`, `spin`, `update`, `draw`) | Casino slot machine canvas wheel spinner linked to backend casino RPC. | `google.script.run.playCasino` | **Casino Module / Confirmed** — Depends on backend casino RPC. |
| **L8835–L8955** | Game 20: Auto-Blackjack | `GAMES['Auto-Blackjack']` (`init`, `handleKey`, `update`, `draw`) | Casino card game simulating blackjack dealer hands via backend RPC. | `google.script.run.playCasino` | **Casino Module / Confirmed** — Depends on backend casino RPC. |
| **L8956–L9082** | Game 21: Rigged Baccarat | `GAMES['Rigged Baccarat']` (`init`, `handleKey`, `update`, `draw`) | Casino card game simulating baccarat hand resolution. | `google.script.run.playCasino` | **Casino Module / Confirmed** — Depends on backend casino RPC. |
| **L9083–L9221** | Game 22: Derby Racing | `GAMES['Derby Racing']` (`init`, `handleKey`, `update`, `draw`) | Casino horse race canvas simulation with betting system. | `google.script.run.playCasino` | **Casino Module / Confirmed** — Depends on backend casino RPC. |
| **L9222–L10539** | Game 23: Sector Defense | `GAMES['Sector Defense']` (`init`, `_step`, `_bindPointerEvents`, `draw`) | Massive tower defense engine with path tile mapping, enemy rosters, wave ticks, and upgrades. | `canvas`, `ctx`, `submitScore` | **Complex Canvas Game / Confirmed** — Heavy state machine. |
| **L10540–L10642** | Game 24: Flappy Bot | `GAMES['Flappy Bot']` (`init`, `flap`, `spawnPipe`, `update`, `die`) | Flappy bird style obstacle dodging canvas game with particle trail physics. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Simple physics engine. |
| **L10643–L11118** | Game 25: Cosmic Merge | `GAMES['Cosmic Merge']` (`init`, `click`, `update`, `draw`) | Planet dropping and merging physics puzzle canvas game. | `canvas`, `ctx`, `submitScore` | **Self-Contained Canvas Game / Confirmed** — Circle collision engine. |
| **L11119–L11294** | Game 26: Retro Snake | `GAMES['Retro Snake']` (`init`, `spawnFood`, `update`, `die`, `draw`) | Classic grid snake eating game with diet food mechanics. | `canvas`, `ctx`, `submitScore` | **Retired Code / Confirmed** — Present in code, hidden from primary tabs. |
| **L11295–L11389** | Game 27: Sudoku | `GAMES['Sudoku']` (`init`, `click`, `handleKey`, `win`, `update`) | Standard Sudoku grid matrix solver and visual canvas renderer. | `canvas`, `ctx`, `submitScore` | **Retired Code / Confirmed** — Present in code, hidden from primary tabs. |
| **L11390–L11538** | Game Container & Modal Engine | `openGameModal`, `closeGameModal`, `submitScore`, `clearCanvas` | Handles launching games, setting up modal canvas, starting requestAnimationFrame loop, submitting scores, and cleaning up pixel contexts. | `GAMES`, `score`, `reqAnimFrame`, `google.script.run` | **Core Application / Confirmed** — Central bridge between games and UI/backend. |
| **L11539–L11666** | Catalog & Categorization | `ARCADE`, `BRAIN`, `CURRENT_SEASON`, `NEW_GAMES`, `CASINO_GAMES`, `renderRow`, `renderFeatured` | Defines game categories, season metadata, and generates Bento grid app cards dynamically. | `GAMES`, DOM elements | **UI System / Confirmed** — Drives Store Front game grid layout. |
| **L11667–L11760** | Search & Filter Systems | `#searchInput` listener, debounce search handler | Filters visible app cards across Store Front tabs in real-time. | DOM `.app-card`, `.feat-card` | **UI System / Confirmed** — Global search engine. |
| **L11761–L11943** | Leaderboard & Hall of Fame | `getLeaderboard`, `renderTeamLeaderboards`, `renderPvPLeaderboards` | Renders global rankings, team squads, personal best lists, and monthly top player lists. | `google.script.run`, DOM | **UI & Data System / Confirmed** — RPC data renderer. |
| **L11944–L12112** | Profile, Settings & Feedback | `openSettings` (x2), `saveSettings` (x2), profile stats renderer, feedback submission | Displays user XP/CSAT stats, handles theme changes, and sends feedback to Google Sheets backend. | `google.script.run`, `localStorage` | **UI System / Confirmed** — User drawer and modal settings. |
| **L12113–L12294** | VVIP & Rewards Marketplace | `showVvipModal`, `claimReward`, `convertTickets` | Handles ticket conversions, item purchases, and VVIP reward notifications. | `google.script.run`, DOM | **UI & Score System / Confirmed** — Wallet/Rewards controller. |
| **L12295–L12495** | 5-Star Universal Bounty Engine | `logBountyProgress`, `claimBountyReward` | Tracks daily bounty achievements (e.g., win blackjack, complete puzzle) and grants rewards. | `localStorage`, `google.script.run` | **Score & RPG System / Confirmed** — Daily reward tracker. |
| **L12496–L12670** | App Lifecycle & Level Gating | `DOMContentLoaded` listener, `showTab`, `enforceLevelGates`, `updateHeaderStats` | Central bootstrapper: checks user level, locks/unlocks tabs, fetches session data, initializes header stats. | `google.script.run`, DOM | **Core Application / Confirmed** — Primary entry point. |
| **L12671–L12753** | Progress Bar & Ticket Utilities | `updateTicketProgressBar` | Calculates XP remaining until next ticket/level increment and updates header progress bar. | `currentPlayerLevel`, DOM | **UI / Confirmed** — Header progress bar helper. |
| **L12754–L12938** | Theme Particle Canvas | `pixieCanvas`, `pixieCtx`, `pixies` particle generator | Renders background floating theme-responsive sparkles/particles on lobby canvas. | `#pixieCanvas`, `requestAnimationFrame` | **UI Visual Effect / Confirmed** — Standalone lobby particle animation. |
| **L12939–L12988** | Admin Operations Panel | Admin action execution forms, point injection controls | Admin-only controls for updating player stats, wiping data, and monitoring system status. | `google.script.run`, `verifyAdmin` | **Admin Module / Confirmed** — Gated by admin LDAP. |
| **L12989–L13054** | Mock Ad / Corporate PSA System | `loadRandomAds` | Renders corporate PSA humor banner ads in the lobby footer and sidebar. | DOM `#mockAdContainer` | **UI Component / Confirmed** — Standalone mock ad renderer. |

---

## 2. Identify Actual Module Boundaries

Based on actual dependency relationships in the code, the monolithic `javascript.html` file decomposes into 10 logical boundaries:

```text
javascript.html (Monolith)
    │
    ├── 1. Core Engine & State (Lifecycle, Globals, Version Lock, Hotkeys)
    ├── 2. UI Subsystem (Tabs, Bento Grids, Search, Modals, Toasts, Ads)
    ├── 3. Audio Subsystem (Web Audio Synthesizer, BGM Playlist Manager)
    ├── 4. RPG & Rewards Subsystem (XP, Wallet, Bounties, Level Gating, Store)
    ├── 5. Leaderboard & Hall of Fame (Rankings, Squads, Monthly Records)
    ├── 6. Backend RPC Gateway (Wrapper around google.script.run)
    ├── 7. Pokemon Engine & GTS Marketplace (Pokemon Play RPG, Combat, GTS)
    ├── 8. Casino Module (Slots, Blackjack, Baccarat, Derby Racing)
    ├── 9. Standalone Canvas & DOM Game Engines (22 Active Arcade & Puzzle Games)
    └── 10. Admin Subsystem (Admin Panel, User Controls)
```

---

## 3. Proposed Module Map

| Proposed Module | Current Line Range | Main Responsibilities | Important Dependencies | Risk | Status |
| :--- | ---: | :--- | :--- | :---: | :---: |
| **Core Engine & State** | L1–L18, L483–L586, L11390–L11538, L12496–L12670 | Global state init, version check, game loop launcher, level gating, window listeners. | `window`, `document`, `google.script.run` | **High** | **Confirmed** |
| **Audio Subsystem** | L19–L206 (partial), L244–L482 | Background music rotation, Web Audio SFX generation, mute/volume controls. | `AudioContext`, `#bgmLobby`, `localStorage` | **Low** | **Confirmed** |
| **UI Subsystem** | L207–L274, L11539–L11760, L12754–L12938, L12989–L13054 | Navigation tabs, Bento app cards, banner carousel, search filter, particle background, ads. | DOM IDs, `GAMES` registry | **Medium** | **Confirmed** |
| **RPG & Rewards Subsystem** | L12113–L12495, L12671–L12753 | Wallet balances, CSAT, tickets, daily bounty tracker, level progress bar, store purchases. | `google.script.run`, `localStorage` | **Medium** | **Confirmed** |
| **Leaderboards & Hall of Fame** | L11761–L11943 | Personal bests, global standings, squad rankings, monthly bests. | `google.script.run`, DOM `#leaderboardRows` | **Medium** | **Confirmed** |
| **Profile, Settings & Admin** | L11944–L12112, L12939–L12988 | Settings drawer, theme swapper, feedback form, admin user control panel. | `google.script.run`, `localStorage` | **Medium** | **Confirmed** |
| **Backend RPC Gateway** | Scattered throughout | Centralized wrapper for server-side `google.script.run` calls with error handling. | `google.script.run` | **High** | **Confirmed** |
| **Pokemon Play & GTS Engine** | L2074–L4745 | Full Pokemon RPG loop, movesets, turn battle, safari, binder, GTS market bids. | `POKEDEX`, `POKEMON_MOVES`, RPC | **High** | **Confirmed** |
| **Casino Games Module** | L8716–L9221 | High-Roller Slots, Auto-Blackjack, Rigged Baccarat, Derby Racing. | `google.script.run.playCasino`, canvas | **Medium** | **Confirmed** |
| **Arcade & Puzzle Games** | L641–L2073, L4746–L8715, L9222–L11389 | 22 self-contained canvas and DOM game implementations (Pou, Pool, Tetris, 2048, etc.). | `canvas`, `ctx`, `submitScore`, `playSound` | **Low–Medium** | **Confirmed** |

---

## 4. Global State Dependencies Analysis

The following table provides a complete dependency analysis of all major global variables declared in `javascript.html`:

| Global Variable | Declared Line | Read By | Modified By | Requires Global Scope? | Target Location in Refactored App | Status |
| :--- | ---: | :--- | :--- | :---: | :--- | :---: |
| `score` | L5 | Active game engine, `submitScore` | Game loops during score updates | No | `AppState.activeGameScore` | **Confirmed** |
| `currentPlayerLevel` | L6 | `enforceLevelGates`, `updateHeaderStats`, `showTab` | `saveScore` RPC response | Yes | `AppState.playerLevel` | **Confirmed** |
| `reqAnimFrame` | L7 | `openGameModal`, `closeGameModal` | `requestAnimationFrame`, `cancelAnimationFrame` | No | `GameLifecycle.animFrameId` | **Confirmed** |
| `canvas` | L8 | Game engines, modal launcher | `openGameModal`, `clearCanvas` | Yes | `DOMRefs.gameCanvas` | **Confirmed** |
| `domEngine` | L10 | DOM-based games (Pou, Pokemon, etc.) | `openGameModal` | Yes | `DOMRefs.domEngine` | **Confirmed** |
| `globalUserLdap` | L11 | Admin panel, profile, GTS, leaderboards | `getSessionInfo` RPC response | Yes | `UserSession.ldap` | **Confirmed** |
| `activeSecurityToken` | L12 | `submitScore` | `startGame` RPC response | Yes (Security) | `UserSession.token` | **Confirmed** |
| `drawsSinceLastPlay` | L13 | Game modal renderer | `openGameModal` | No | `GameLifecycle.drawCount` | **Confirmed** |
| `currentCarouselIndex` | L15 | Carousel auto-rotator | Carousel controls | No | `CarouselModule.currentIndex` | **Confirmed** |
| `carouselSlides` | L16 | Carousel navigator | `_buildCarouselSlides` | No | `CarouselModule.slidesList` | **Confirmed** |
| `currentBGM` | L18 | Audio auto-pause listener | `playBGM`, `initBGM` | No | `AudioSubsystem.currentAudio` | **Confirmed** |
| `lobbyPlaylist` | L20 | `initBGM`, carousel BGM trigger | Hardcoded array | No | `AudioSubsystem.playlist` | **Confirmed** |
| `activeThemeName` | L28 | `setTheme`, particle canvas, games | `setTheme` | Yes | `AppState.theme` | **Confirmed** |
| `sessionGamesCount` | L31 | Score submission, stats tracker | `submitScore` | No | `UserSession.gamesPlayed` | **Confirmed** |
| `CLIENT_VERSION` | L39 | Score submission verification | Hardcoded constant | Yes | `Config.CLIENT_VERSION` | **Confirmed** |
| `audioCtx` | L369 | `playSound`, `playBeep` | `initAudioContext` | No | `AudioSubsystem.ctx` | **Confirmed** |
| `HOW_TO` | L587 | Game launch modal | Hardcoded dictionary | No | `GameData.howTo` | **Confirmed** |
| `POKEMON_WEAKNESS` | L628 | `Pokemon Play` damage calculator | Hardcoded dictionary | No | `PokemonModule.weaknessMap` | **Confirmed** |
| `POKEDEX_MAP` | L636 | `Pokemon Play` lookup engine | Hardcoded dictionary | No | `PokemonModule.pokedexMap` | **Confirmed** |
| `GAMES` | L639 | Game launcher, search, categories | Game object declarations | Yes | `GameRegistry` | **Confirmed** |
| `ARCADE` / `BRAIN` / `CASINO_GAMES` | L11539 | Store front Bento grid renderer | Hardcoded array categories | Yes | `GameRegistry.categories` | **Confirmed** |
| `modalCallback` | L12115 | VVIP reward modal, store dialogs | Modal triggers | No | `UIModule.modalCallback` | **Confirmed** |
| `pixieCanvas` / `pixieCtx` | L12756 | Background particle animation loop | Particle canvas setup | No | `UIModule.particles` | **Confirmed** |

---

## 5. Function Dependency Analysis

### Category A: Safe Extraction Candidates (Self-Contained Utilities)
Functions with zero coupling to global UI or backend state:
- `_wobbleOffset(t)` (L1435): Mathematical vector wobble helper for Darts.
- `getRemainingLengths(ships)` (L7612): Pure array filter function for Battleship.
- `computeProbabilityGrid(grid, remaining)` (L7620): Pure AI target calculation function for Battleship.
- `playBeep(freq, type, duration)` (L370): Pure Web Audio synth helper.
- `_buildPathBlockMap()` (L9225): Pure path block generator for Sector Defense.

### Category B: Shared/Core Functions (Used Across Multiple Subsystems)
Functions heavily consumed across the codebase that should be encapsulated in core services:
- `submitScore(finalScore)` (L11440): Invoked by all 27 games upon game over.
- `playSound(soundName)` (L280): Invoked by all games and UI buttons for sound effects.
- `showToast(message, type)` (L11410): Universal UI notification alert called by games, RPCs, and marketplace.
- `showTab(tabId)` (L12500): Universal navigation handler called by tabs, cards, and modal callbacks.
- `updateHeaderStats(data)` (L12660): Updates XP bar, Tickets, Points, and CSAT in top sticky header.

### Category C: High-Risk Functions (Deeply Coupled / Complex State)
Functions that are extremely risky to move early due to multi-system coupling:

1. **`openGameModal(gameTitle)` (L11390):**
   - *Why Risky:* Clears canvas, stops active `requestAnimationFrame` loop, resets global `score`, sets up canvas context dimensions, injects DOM HTML into modal container, and launches the game's `init()` function.

2. **`saveScore(score, gameName, token)` (Client/Backend RPC Bridge L11470):**
   - *Why Risky:* Validates security token, sends RPC call to `Code.gs`, updates global `currentPlayerLevel`, checks for level ups, triggers level-up celebration overlays, and updates ticket progress bars.

3. **`enforceLevelGates(playerLevel)` (L12550):**
   - *Why Risky:* Queries user level, toggles `locked` CSS classes on navigation tabs, sets `tabindex="-1"` and `aria-disabled="true"` for locked tabs, and restricts access to Casino (Level 99) and Store (Level 5).

4. **`executeTurn(action, target)` (Pokemon Play L2793):**
   - *Why Risky:* 336 pure lines of complex RPG combat logic checking status conditions (paralyzed, burned, asleep), move accuracy, held item effects, stat multipliers, and UI animations.

5. **`renderHub()` (Pokemon Play L3791):**
   - *Why Risky:* 489 pure lines handling tab switching between Pokemon team, inventory, trainer profile, binder, safari zone, and GTS marketplace listings.

---

## 6. Game-by-Game Dependency Map (All 27 Active Games + Retired Code)

### 6.1 Active Games Inventory (27 Games)

| Game Name | Line Range | Entry Function | Main Update/Draw Loop | Important Globals / State | DOM / Canvas Touched | RPC Calls | Refactoring Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Pou** | L641–L1114 | `init` | `_tick` (setInterval) | `this.state`, `localStorage` | `#domEngine`, DOM bars | None | **Medium** |
| **Basketball Hoops** | L1115–L1416 | `init` | `update`, `draw` | `score`, physics vectors | `#gameCanvas` | `saveAchievement` | **Low** |
| **Darts** | L1417–L1633 | `init` | `update`, `draw` | `score`, wind state | `#gameCanvas` | `saveAchievement` | **Low** |
| **8-Ball Pool** | L1634–L1889 | `init` | `update`, `draw` | `score`, ball vectors | `#gameCanvas` | `saveAchievement` | **Medium** |
| **Block Blast** | L1890–L2073 | `init` | `draw` | `score`, 8x8 grid matrix | `#gameCanvas` | None | **Low** |
| **Pokemon Play** | L2074–L4745 | `init` | `executeTurn`, `renderHub` | `playerData`, movesets | `#domEngine` | GTS, Sync, Defense | **High** |
| **Cafe Tycoon** | L4746–L5166 | `init` | `update`, `draw` | `score`, orders, heat meter | `#gameCanvas` | None | **Low** |
| **Candy Run** | L5167–L5582 | `init` | `update`, `draw` | `score`, platform array | `#gameCanvas` | None | **Low** |
| **Severity 1: Core Breach** | L5583–L5644 | `init` | `update`, `draw` | `score`, core health | `#gameCanvas` | `saveAchievement` | **Low** |
| **Piano Tiles** | L5645–L5746 | `init` | `update`, `draw` | `score`, streak combo | `#gameCanvas` | `saveAchievement` | **Low** |
| **PacMan** | L5747–L5796 | `init` | `update`, `draw` | `score`, ghost AI path | `#gameCanvas` | `saveAchievement` | **Medium** |
| **Candy Crush** | L5797–L6524 | `init` | `update`, `draw` | `score`, grid solver matrix | `#gameCanvas` | `saveAchievement` | **Medium** |
| **Tetris** | L6525–L6810 | `init` | `update`, `draw` | `score`, grid matrix, SRS | `#gameCanvas` | `saveAchievement` | **Low** |
| **Minesweeper** | L6811–L7018 | `init` | `update`, `draw` | `score`, bomb matrix | `#gameCanvas` | `saveAchievement` | **Low** |
| **2048** | L7019–L7511 | `init` | `update`, `draw` | `score`, tile grid matrix | `#gameCanvas` | `saveAchievement` | **Low** |
| **Battleship** | L7512–L7807 | `init` | `update`, `draw` | `score`, ship grid, AI | `#gameCanvas` | None | **Low** |
| **Connect Four** | L7808–L8224 | `init` | `update`, `draw` | `score`, minimax AI tree | `#gameCanvas` | None | **Medium** |
| **Spam Defender** | L8225–L8715 | `init` | `update`, `draw` | `score`, tower array | `#gameCanvas` | `saveAchievement` | **Medium** |
| **High-Roller Slots** | L8716–L8834 | `init` | `update`, `draw` | `score`, reel angles | `#gameCanvas` | `playCasino` | **Medium** |
| **Auto-Blackjack** | L8835–L8955 | `init` | `update`, `draw` | `score`, hand cards | `#gameCanvas` | `playCasino` | **Medium** |
| **Rigged Baccarat** | L8956–L9082 | `init` | `update`, `draw` | `score`, hand cards | `#gameCanvas` | `playCasino` | **Medium** |
| **Derby Racing** | L9083–L9221 | `init` | `update`, `draw` | `score`, horse vectors | `#gameCanvas` | `playCasino` | **Medium** |
| **Sector Defense** | L9222–L10539 | `init` | `_step`, `draw` | `score`, path, towers | `#gameCanvas` | None | **High** |
| **Flappy Bot** | L10540–L10642 | `init` | `update`, `draw` | `score`, pipe array | `#gameCanvas` | None | **Low** |
| **Cosmic Merge** | L10643–L11118 | `init` | `update`, `draw` | `score`, planet physics | `#gameCanvas` | None | **Low** |
| **Retro Snake** | L11119–L11294 | `init` | `update`, `draw` | `score`, snake body array | `#gameCanvas` | `saveAchievement` | **Low** |
| **Sudoku** | L11295–L11389 | `init` | `update`, `draw` | `score`, sudoku matrix | `#gameCanvas` | `saveAchievement` | **Low** |

### 6.2 Retired / Inactive Game Code Inventory

| Game Name | Line Range | Why Inactive / Retired | References Remaining | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Retro Snake** | L11119–L11294 | Removed from primary category arrays (`ARCADE`, `BRAIN`). | Registered in `GAMES['Retro Snake']` object dictionary. | **Preserve Temporarily** — Keep in object registry until module extraction phase. |
| **Sudoku** | L11295–L11389 | Removed from primary category arrays (`ARCADE`, `BRAIN`). | Registered in `GAMES['Sudoku']` object dictionary. | **Preserve Temporarily** — Keep in object registry until module extraction phase. |

---

## 7. UI Dependency Map

| UI Component | Line Range | Primary Responsibilities | Dependencies | Server RPC Calls | Risk |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Header Stat Badges** | L12660–L12753 | Renders XP bar, Points, Tickets, CSAT. | DOM IDs (`#uiTickets`, `#uiXP`, etc.) | `getSessionInfo` | **Medium** |
| **Navigation Tabs** | L12500–L12580 | Roving tabindex tab swapper with level gating. | `enforceLevelGates`, ARIA roles | None | **Medium** |
| **Bento Game Cards** | L11539–L11666 | Store front game grid card generator. | `GAMES`, `renderRow`, `renderFeatured` | `getAllPersonalBests` | **Low** |
| **Banner Carousel** | L19–L274 | Top dynamic highlight carousel. | `_buildCarouselSlides`, DOM | `getGlobalRankings` | **Low** |
| **Modal Launcher** | L11390–L11450 | Game overlay modal container & canvas lifecycle. | `#appSheetModal`, `requestAnimationFrame` | `startGame` | **High** |
| **Toast Notifications**| L11410–L11422 | Animated toast alert messages. | DOM `#toastContainer` | None | **Low** |
| **GTS Market UI** | L4411–L4745 | Pokemon trading cards, bidding dialogs. | `renderHub`, DOM | GTS Bids / Buyouts | **High** |
| **Casino UI Overlay** | L8716–L9221 | Betting controls, chip chips, jackpot display. | `google.script.run.playCasino` | `playCasino` | **Medium** |

---

## 8. Apps Script Boundary (RPC Gateway Map)

| Frontend Calling Function | Apps Script Target Function | Purpose | Return Data Payload | Dependent Systems |
| :--- | :--- | :--- | :--- | :--- |
| `DOMContentLoaded` init | `getSessionInfo()` | Loads user LDAP, initial tickets, XP, level, and admin flag. | `{ldap, tickets, points, xp, level, isAdmin}` | Header stats, Level Gating, Admin button |
| `openGameModal()` | `startGame(gameTitle, diff)` | Validates game start and returns security token. | `{success, token, message}` | Game lifecycle, `activeSecurityToken` |
| `submitScore()` | `saveScore(score, game, token)` | Saves game score, updates XP/wallet, checks PBs. | `{success, isPB, prevPB, newLevel, levelUp}` | Game over screen, Header stats, Leaderboards |
| `claimReward()` | `purchaseItem(itemId)` | Redeems tickets for store rewards. | `{success, message, newBalance}` | Store front UI, Header ticket badge |
| `claimBountyReward()` | `claimBountyReward(id)` | Claims daily bounty tickets/XP. | `{success, tickets, xp}` | Daily Bounty UI |
| Casino Spin | `playCasino(gameType, bet)` | Server-validated casino hand/spin. | `{success, payout, message, newBalance}` | High-Roller Slots, Blackjack, Baccarat, Derby |
| `renderHub()` | `getGTSListings()` | Fetches active Pokemon GTS market listings. | `[ {listingId, seller, pokemon, price} ]` | GTS Market UI |
| `placeGTSBid()` | `placeGTSBid(id, bid)` | Submits bid for Pokemon auction. | `{success, message}` | GTS Market UI |
| `saveFeedback()` | `saveFeedback(text, type)` | Appends user feedback to Google Sheet. | `{success, message}` | Settings drawer |
| `executeAdminAction()` | `executeAdminAction(act, data)`| Executes administrative commands. | `{success, message}` | Admin panel |

---

## 9. Event Listener Inventory

| Event Type | Target Element | Line Range | Handler Function / Purpose | State Modified | Risk Flag |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `DOMContentLoaded` | `window` | L12496 | App bootstrap sequence, fetches session data, sets theme. | Core global state, UI render | **High** (Bootstrapper) |
| `keydown` | `window` | L483 | Roving tabindex navigation, Enter/Space activation, Konami/Babi cheat code buffer, '/' search shortcut. | Focus, active tab, cheat buffers | **High** (Global Listener) |
| `keyup` | `window` | L511 | Game key release events passed to active game engine's `handleKey`. | Active game engine input state | **Medium** |
| `resize` | `window` | L11392 | Recalculates particle canvas boundaries and confetti dimensions. | Canvas width/height properties | **Low** |
| `visibilitychange` | `document` | L554 | Auto-pauses active game loop and BGM audio when browser tab is hidden. | `currentBGM.pause()`, game pause state | **Medium** |
| `mousedown` / `mousemove` / `mouseup` | Game Canvas | Games | Drag/aiming listeners for 8-Ball Pool, Darts, Sector Defense, Connect Four. | Physics aiming lines, drag positions | **Low** (Scoped to Canvas) |
| `touchstart` / `touchmove` / `touchend` | Game Canvas | Games | Touch interface touch drag and tap handlers for mobile compatibility. | Physics aiming lines, drag positions | **Low** (Scoped to Canvas) |
| `click` | `#searchInput` | L11667 | Real-time search filter input handler. | Visible app cards filter state | **Low** |

---

## 10. Initialization Order

The current runtime initialization sequence follows a strict order that must be preserved:

```text
1. Browser parses Index.html script tags (javascript.html & PokemonData.js.html).
2. Global variables declared (score, currentPlayerLevel, GAMES, etc.).
3. DOMContentLoaded event fires.
4. Local persistent settings loaded from localStorage (theme, volume, particles).
5. Theme CSS classes applied to document root.
6. google.script.run.getSessionInfo() invoked asynchronously.
7. RPC returns user LDAP, XP, tickets, level, and admin status.
8. updateHeaderStats() called to populate sticky header.
9. enforceLevelGates(playerLevel) locks/unlocks navigation tabs.
10. Default tab ('storeFront') activated via showTab().
11. renderFeatured() and renderRow() render Bento game grid cards.
12. google.script.run.getGlobalRankings() populates carousel slides.
13. Audio system initialized (initBGM) on first user interaction click/keydown.
```

---

## 11. Duplicate & Conflicting Definitions Analysis

| Identified Item | File & Line Range | Runtime Resolution | Why It Matters | Handling Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `getLeaderboard` | `Code.gs` (L392 & L1577) | L1577 definition overrides L392 at script compilation time. | L1577 takes no parameters and breaks RPC filtering calls. | **Preserve in Step 2.** Remove dead L1577 definition in future backend refactor step. |
| `openSettings` | `javascript.html` (L12048 & L12949) | L12949 definition overrides L12048 at script evaluation time. | Duplicate function definitions create dead code. | **Preserve in Step 2.** Mark for removal during UI module extraction step. |
| `saveSettings` | `javascript.html` (L12061 & L12963) | L12963 definition overrides L12061 at script evaluation time. | Duplicate function definitions create dead code. | **Preserve in Step 2.** Mark for removal during UI module extraction step. |
| Battleship Engines | `javascript.html` (L7512) vs `bsc_logic.js` (L1) | `javascript.html`'s Canvas Battleship runs in app. `bsc_logic.js` is unreferenced. | `bsc_logic.js` is unintegrated standalone code. | **Preserve in Step 2.** Evaluate `bsc_logic.js` for integration or deletion in future step. |

---

## 12. Proposed Target Architecture

The recommended modular architecture tailored specifically for Google Apps Script HTML inclusions:

```text
src/
├── Index.html                       # HTML Shell
├── stylesheet.html                  # Next-Gen Glass Design System
├── core/
│   ├── AppState.js.html             # Global reactive state store
│   ├── App.js.html                  # Bootstrapper & DOMContentLoaded
│   └── RPCGateway.js.html           # Promisified wrapper for google.script.run
├── ui/
│   ├── Navigation.js.html           # Tab routing & level gating
│   ├── Header.js.html               # Header stat badges & progress bar
│   ├── Catalog.js.html              # Bento grid app cards & search
│   ├── Carousel.js.html             # Top banner carousel
│   ├── Modal.js.html                # Game overlay modal manager
│   ├── Toast.js.html                # Toast notification manager
│   └── Particles.js.html            # Theme particle background canvas
├── audio/
│   ├── AudioController.js.html      # BGM playlist manager
│   └── SFXSynth.js.html             # Web Audio synthesizer
├── services/
│   ├── WalletService.js.html        # XP, tickets, rewards store
│   ├── BountyService.js.html        # Daily bounty progress tracker
│   └── LeaderboardService.js.html   # Leaderboard queries & renders
├── modules/
│   ├── pokemon/                     # Pokemon Play RPG & GTS Market
│   │   ├── PokemonPlay.js.html
│   │   └── GTSMarket.js.html
│   └── casino/                      # Casino games suite
│       └── CasinoSuite.js.html
└── games/                           # Extracted individual games
    ├── ArcadeGames.js.html
    └── PuzzleGames.js.html
```

---

## 13. Safe Refactoring Sequence

Extraction must follow a strict, low-risk sequence where each step is independently verifiable:

```text
Step 1: Extract Audio Subsystem (Low Risk)
  └── Move initBGM, playBGM, playSound, playBeep into AudioController.js.html.
  └── Verify: Sound effects and BGM continue playing across all tabs.

Step 2: Extract Toast & Notification Subsystem (Low Risk)
  └── Move showToast into Toast.js.html.
  └── Verify: Toast alerts appear correctly on user actions.

Step 3: Extract Standalone Canvas Games (Low Risk)
  └── Move independent games (e.g., Flappy Bot, 2048, Minesweeper) into games/ ArcadeGames.js.html.
  └── Verify: Games open in modal, run smoothly, and submit scores.

Step 4: Extract Leaderboards & Hall of Fame (Medium Risk)
  └── Move renderTeamLeaderboards and renderPvPLeaderboards into LeaderboardService.js.html.
  └── Verify: Leaderboard tabs render rankings without console errors.

Step 5: Extract Wallet & Bounty Engine (Medium Risk)
  └── Move bounty tracker and ticket store logic into WalletService.js.html.
  └── Verify: Daily bounty completion and ticket purchases update header balances.

Step 6: Extract Casino Suite (Medium Risk)
  └── Move High-Roller Slots, Blackjack, Baccarat, and Derby Racing into CasinoSuite.js.html.
  └── Verify: Casino games execute server-validated bets and update wallet.

Step 7: Extract UI Catalog & Search (Medium Risk)
  └── Move renderRow, renderFeatured, and search listener into Catalog.js.html.
  └── Verify: Store Front tab renders app cards and filters search queries.

Step 8: Extract Pokemon Play & GTS Engine (High Risk)
  └── Move Pokemon combat, safari, binder, and GTS market into PokemonPlay.js.html.
  └── Verify: Pokemon battles, move selections, and GTS bids function correctly.

Step 9: Extract Core App Lifecycle & State Gateway (High Risk)
  └── Extract DOMContentLoaded bootstrapper, RPCGateway, and level gating into core/.
  └── Verify: End-to-end user session loading, navigation gating, and score submission.
```

---

## 14. "DO NOT TOUCH YET" Areas

The following critical areas must remain intact in `javascript.html` until late extraction phases:

1. **`saveScore()` & `activeSecurityToken` Security Pipeline:**
   - *Reason:* Handles anti-cheat token handshakes between client and server. Modifying this prematurely risks breaking score recording and XP progression across all 27 games.

2. **`enforceLevelGates()` & `showTab()` Navigation System:**
   - *Reason:* Enforces level gating for Puzzle, Store, Casino, and Admin tabs. Premature extraction could accidentally grant low-level users access to locked features or create blank tab screens.

3. **`Pokemon Play` & GTS Marketplace Engine (L2074–L4745):**
   - *Reason:* 2,672 lines of deeply coupled RPG combat, inventory management, safari calculations, and server RPC bids. Must remain unified until core RPC gateways are established.

4. **`Sector Defense` Game Engine (L9222–L10539):**
   - *Reason:* 1,318 lines of complex tower defense state, pointer drag handlers, and wave tick loops.

---

# Refactoring Contract

Every future refactoring step in this repository MUST adhere strictly to the following 10 rules:

1. **Existing Functionality Preserved:** All existing application behavior, game logic, user flows, and RPG progression must remain identical before and after each extraction step.
2. **Backend Compatibility:** Existing Google Apps Script backend APIs (`Code.gs`) and `google.script.run` signatures must remain 100% compatible.
3. **Gameplay Integrity:** No game physics, collision rules, AI solvers, or win/loss conditions may be altered during refactoring.
4. **Scoring & Rewards Security:** Anti-cheat duration checks, security token handshakes, XP formulas, and ticket conversion rates must remain unchanged.
5. **Authentication & Session Safety:** User LDAP detection, admin privileges, and level gating logic must remain strictly enforced.
6. **No Visual Redesign:** Visual layout, CSS glassmorphism styles, color palettes, and DOM structures must not be altered as part of structural refactoring.
7. **Zero Feature Additions:** No new features, games, or UI elements may be added during structural refactoring steps.
8. **Independent Verifiability:** Each extracted module must be independently testable using the `bundle.py` Playwright test suite.
9. **Incremental & Reversible:** Structural changes must be performed in small, isolated steps that can easily be rolled back if regressions occur.
10. **Pre & Post Verification:** Existing behavior must be verified before starting an extraction step and confirmed immediately after completion.
