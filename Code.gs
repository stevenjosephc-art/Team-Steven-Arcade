const APP_VERSION = "v2.0.14"; // CHANGE THIS NUMBER EVERY TIME YOU DEPLOY AN UPDATE!
const SPREADSHEET_ID = '15CCGEz8Btj4iSWb7k46XO4Bg_j-e61eNNL7uviaEO_4'; // Replace with actual ID or use getActiveSpreadsheet() if bound
const EXCHANGE_RATE = 500000; // 500,000 points = 1 Ticket

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet(); 
}

function doGet(e) {
  // We changed createHtmlOutputFromFile to createTemplateFromFile and added .evaluate()
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Google Play Arcade')
    .setFaviconUrl('https://cdn-icons-png.flaticon.com/512/808/808439.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Add this brand new helper function right below doGet!
// This is the magic engine that will stitch your files together.
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function _checkRateLimit(key, maxCalls, windowSec) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'rl_' + key;
  var raw = cache.get(cacheKey);
  var count = raw ? parseInt(raw) : 0;
  if (count >= maxCalls) return false;
  cache.put(cacheKey, String(count + 1), windowSec);
  return true;
}

function _log(level, fn, msg, extra) {
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName('ArcadeLog');
    if (!sheet) {
      sheet = ss.insertSheet('ArcadeLog');
      sheet.getRange('A1:F1').setValues([['Timestamp','Level','Function','Actor','Message','Extra']])
        .setBackground('#202124').setFontColor('#ffffff').setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, 6, 160);
    }
    var actor = '';
    try { actor = Session.getActiveUser().getEmail(); } catch(e) {}
    sheet.appendRow([
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      level, fn, actor, msg,
      extra ? JSON.stringify(extra) : ''
    ]);
  } catch(e) { Logger.log('LOG_FAIL: ' + e.message); }
}

function getSessionInfo() {
  var email = Session.getActiveUser().getEmail() || 'guest@example.com';
  var ldap = email.split('@')[0];
  return { email: email, ldap: ldap };
}

function startGame(gameName, diff) {
  const user = getSessionInfo().ldap;
  const token = Utilities.getUuid();
  const cache = CacheService.getUserCache();
  
  cache.put('game_token_' + user, token, 3600);
  cache.put('game_start_' + user, Date.now().toString(), 3600);
  cache.put('active_game_' + user, gameName + '_' + diff, 3600);
  
  return { success: true, token: token };
}

function shadowban(user, reason, score) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName('Shadowbans');
  if (!sheet) {
    sheet = ss.insertSheet('Shadowbans');
    sheet.appendRow(['Timestamp', 'User', 'Reason', 'Attempted Score']);
  }
  sheet.appendRow([new Date(), user, reason, score]);
  _log('WARN', 'shadowban', 'Anti-cheat triggered', { user: user, reason: reason, score: score });
  return { success: false, error: 'Anti-cheat triggered' };
}

function updateWallet(user, pointsToAdd) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName('Wallets');
  
  const data = sheet.getRange(1, 1, sheet.getLastRow() || 1, 5).getValues();
  let rowIndex = -1;
  let firstEmptyRow = -1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user) { 
      rowIndex = i + 1; 
      break; 
    }
    if (data[i][0] === "" && firstEmptyRow === -1) { 
      firstEmptyRow = i + 1; 
    }
  }
  
  if (rowIndex === -1) {
    // New User Claiming Bounty
    let targetRow = (firstEmptyRow !== -1) ? firstEmptyRow : data.length + 1;
    // Writes to A through E (Bounties give 0 XP, just Points)
    sheet.getRange(targetRow, 1, 1, 5).setValues([[user, 0, pointsToAdd, pointsToAdd, 0]]);
    return { tickets: 0, unspent: pointsToAdd };
  } else {
    // Existing User Claiming Bounty
    let currentTickets = Number(data[rowIndex-1][1]);
    let unspent = Number(data[rowIndex-1][2]) + pointsToAdd;
    let lifetime = Number(data[rowIndex-1][3]) + pointsToAdd;
    
    // Safely update only columns B, C, and D
    sheet.getRange(rowIndex, 2, 1, 3).setValues([[currentTickets, unspent, lifetime]]);
    return { tickets: currentTickets, unspent: unspent };
  }
}

function purchaseItem(itemName, ticketCost) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = getSessionInfo().ldap;
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName('Wallets');

    if (!sheet) return { success: false, message: 'Wallet database missing.' };

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === user) { rowIndex = i + 1; break; }
    }

    if (rowIndex === -1) return { success: false, message: 'Wallet not found.' };

    // --- SERVER-SIDE LEVEL CHECK ---
    let xp = Number(data[rowIndex-1][4]) || 0;
    let playerLvl = Math.floor(Math.sqrt(xp / 1500)) + 1;
    if (playerLvl < 999) {
      return shadowban(user, 'Console Hack Attempt: Store purchase under Lv. 999', ticketCost);
    }
    // -------------------------------

    // Concurrency check: re-read live cell value before writing
    let liveTickets = Number(sheet.getRange(rowIndex, 2).getValue());
    if (liveTickets < ticketCost) {
      return { success: false, message: 'Insufficient tickets.' };
    }
    if (liveTickets !== Number(data[rowIndex-1][1])) {
      return { success: false, message: 'Balance changed — please try again.' };
    }

    sheet.getRange(rowIndex, 2).setValue(liveTickets - ticketCost);

    let logSheet = ss.getSheetByName('StoreLogs');
    if (!logSheet) {
      logSheet = ss.insertSheet('StoreLogs');
      logSheet.appendRow(['Timestamp', 'User', 'Item', 'Cost', 'Status']);
    }
    logSheet.appendRow([new Date(), user, itemName, ticketCost, 'Pending']);

    try {
      MailApp.sendEmail(
        Session.getActiveUser().getEmail(), 
        "Google Play Arcade: Purchase Receipt", 
        "Boss! You successfully purchased: " + itemName + " for " + ticketCost + " Tickets.\n\nFulfillment is pending and will be processed shortly."
      );
    } catch(e) {}

    return { success: true, newBalance: liveTickets - ticketCost };
  } catch(e) {
    return { success: false, message: 'Transaction error.' };
  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════
//  4. SCORING & DAILY BOUNTIES (PATCHED)
// ════════════════════════════════════════════════════════════
function claimBountyReward(bountyId, points) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = getSessionInfo().ldap;
    const ss = getSpreadsheet_();
    if (!_checkRateLimit('bounty_' + user, 5, 300)) {
      return { success: false, message: 'Too many requests.' };
    }
    
    // Anti-cheat 1: Ensure exact bounty amounts to prevent payload injection
    const BOUNTY_REWARDS = { 1: 10000, 2: 25000, 3: 500000 };
    const expectedReward = BOUNTY_REWARDS[bountyId];
    if (!expectedReward || points !== expectedReward) {
      return shadowban(user, 'Bounty reward tampered: ID ' + bountyId, points);
    }
    
    let histSheet = ss.getSheetByName('GameHistory');
    if (!histSheet) {
       histSheet = ss.insertSheet('GameHistory');
       histSheet.appendRow(['Timestamp', 'User', 'Game', 'Difficulty', 'Score']);
    }
    
    // Anti-cheat 2: Server-Side Daily Claim Limit
    const data = histSheet.getDataRange().getValues();
    const todayStr = new Date().toDateString();
    const bountyStr = 'Claimed Bounty ' + bountyId;
    
    let alreadyClaimed = false;
    
    // Scan backwards for extreme efficiency
    for (let i = data.length - 1; i >= 1; i--) {
      // FIX: Skip manual blank rows to prevent loop breakage
      if (!data[i][0]) continue; 
      
      let rowDate = new Date(data[i][0]);
      if (isNaN(rowDate.getTime())) continue; // Skip invalid dates
      
      // Stop looking once we hit yesterday's data
      if (rowDate.toDateString() !== todayStr) break; 
      
      if (data[i][1] === user && data[i][2] === bountyStr) {
        alreadyClaimed = true;
        break;
      }
    }
    
    // FIX: Soft reject if they cleared their cache to double-dip (No shadowban)
    if (alreadyClaimed) {
      return { success: false, message: "Bounty already claimed today." };
    }
    
    // Safe to award points
    const walletUpdate = updateWallet(user, points);
    histSheet.appendRow([new Date(), user, bountyStr, 'N/A', points]);
    
    return { success: true, tickets: walletUpdate.tickets, unspent: walletUpdate.unspent };
  } catch (e) {
    return { success: false };
  } finally {
    lock.releaseLock();
  }
}

function saveScore(game, diff, score, token) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = getSessionInfo().ldap;
    const cache = CacheService.getUserCache();
    
    // Column map guard — if sheet structure shifts, fail safe instead of corrupting data
    const ss = getSpreadsheet_();
    {
      const pbSheetCheck = ss.getSheetByName('PersonalBests');
      if (pbSheetCheck) {
        const headers = pbSheetCheck.getRange(1, 1, 1, pbSheetCheck.getLastColumn()).getValues()[0];
        const expected = ['User', 'Game', 'Difficulty', 'BestScore'];
        for (let h = 0; h < expected.length; h++) {
          if (headers[h] !== expected[h]) {
            Logger.log('PersonalBests column mismatch at index ' + h + ': expected ' + expected[h] + ', got ' + headers[h]);
            return { success: false, error: 'Sheet structure mismatch. Contact admin.' };
          }
        }
      }
    }

    if (!_checkRateLimit('saveScore_' + user, 10, 60)) {
      return { success: false, error: 'Too many score submissions.' };
    }
    const savedToken = cache.get('game_token_' + user);
    const savedGame = cache.get('active_game_' + user);
    
    // FIX: Soft reject for Multi-Tab users instead of an instant Shadowban
    if (!token || token !== savedToken) {
      return { success: false, error: 'Session mismatch. Please refresh your browser.' };
    }
    
    // Clear token so it can't be reused
    cache.remove('game_token_' + user);

    const MIN_DURATION_MS = {
      'Sudoku': 30000, 'Solitaire': 45000, 'Playdle': 15000,
      'Minesweeper': 20000, 'Tetris': 30000, '2048': 20000,
      'Candy Run': 3000, 'Flappy Bot': 3000, // Allow quick deaths!
      '8 Ball Pool': 10000
    };
    
    const startTime = parseInt(cache.get('game_start_' + user) || '0');
    const elapsed = Date.now() - startTime;
    const minRequired = MIN_DURATION_MS[game] || 8000;
    
    let finalScore = score;
    
    // ANTI-CHEAT FIX: Only ban if they played too fast AND got a suspiciously high score
    if (elapsed < minRequired) {
      if (finalScore > 2000) {
        return shadowban(user, 'Too fast with High Score: ' + game + ' in ' + elapsed + 'ms', finalScore);
      }
    }

    const MAX_SCORES = {
      'Retro Snake': 1500000, 'PacMan': 2500000, 'Tetris': 15000000,
      'Minesweeper': 150000, 'Sudoku': 4500, 'Solitaire': 6000,
      'Playdle': 600000, '2048': 9000000, 'Memory Flip': 15000,
      'Flappy Bot': 3000000, 'Piano Tiles': 4500000, 'Spam Defender': 6000000,
      'Cyber Jump': 6000000, 'Candy Crush': 2500000, '4 Emojis 1 Word': 900000,
      'Severity 1: Core Breach': 25000000, 'Cosmic Merge': 1500000,
      'Sector 4: Containment': 450000, 'Angry Agents': 750000,
      'Candy Run': 5000000, // ADDED CANDY RUN CAP
      '8 Ball Pool': 250000
    };
    
    if (MAX_SCORES[game] && finalScore > MAX_SCORES[game]) {
      return shadowban(user, 'Score ceiling exceeded: ' + game, finalScore);
    }

    // ss already declared above in the column map guard
    // 1. Log to History
    let histSheet = ss.getSheetByName('GameHistory');
    if (!histSheet) {
      histSheet = ss.insertSheet('GameHistory');
      histSheet.appendRow(['Timestamp', 'User', 'Game', 'Difficulty', 'Score']);
    }
    histSheet.appendRow([new Date(), user, game, diff, finalScore]);
    
    // 2. Update Personal Bests
    let pbSheet = ss.getSheetByName('PersonalBests');
    if (!pbSheet) {
      pbSheet = ss.insertSheet('PersonalBests');
      pbSheet.appendRow(['User', 'Game', 'Difficulty', 'BestScore']);
    }
    
    const data = pbSheet.getDataRange().getValues();
    let pbRow = -1;
    let currentPB = 0;
    let isNewPB = true;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === user && data[i][1] === game && data[i][2] === diff) {
        pbRow = i + 1;
        currentPB = Number(data[i][3]);
        break;
      }
    }
    
    if (pbRow !== -1) {
      if (finalScore > currentPB) {
        pbSheet.getRange(pbRow, 4).setValue(finalScore);
      } else {
        isNewPB = false;
      }
    } else {
      pbSheet.appendRow([user, game, diff, finalScore]);
    }
    
    // 3. Process Economy & RPG Leveling
    const rewardUpdate = processGameRewards(user, finalScore, game);
    _log('INFO', 'saveScore', 'Score saved', { user: user, game: game, diff: diff, score: finalScore, isPB: isNewPB, mult: rewardUpdate.mult });
    return { 
      success: true, 
      isPB: isNewPB, 
      prevPB: currentPB,
      tickets: rewardUpdate.tickets,
      unspent: rewardUpdate.unspent,
      earnedXP: rewardUpdate.earnedXP,
      earnedPoints: rewardUpdate.earnedPoints,
      perfMult: rewardUpdate.perf,
      fatigueMult: rewardUpdate.fatigue
    };

  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getLeaderboard(game, filter) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('PersonalBests');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const currentUser = getSessionInfo().ldap;
  let scores = [];

  // Clean the inputs to guarantee a perfect match
  let safeGame = String(game).trim();
  let safeFilter = String(filter || 'all').toLowerCase().trim();

  for (let i = 1; i < data.length; i++) {
    let rowGame = String(data[i][1]).trim();
    let rowDiff = String(data[i][2]).trim();
    
    if (rowGame === safeGame) {
      // Cross-translate the UI buttons to match the Spreadsheet difficulty
      if (safeFilter !== 'all' && safeFilter !== 'all time' && safeFilter !== 'week') {
        let diffCheck = rowDiff.toLowerCase();
        if (diffCheck !== safeFilter && 
            !(safeFilter === 'standard' && diffCheck === 'medium') && 
            !(safeFilter === 'hardcore' && diffCheck === 'hard')) {
          continue; 
        }
      }

      scores.push({
        ldap: data[i][0],
        diff: rowDiff,
        score: Number(data[i][3]) // FIX 1: Read Column D (Index 3) for the real score!
      });
    }
  }

  // Sort highest to lowest
  scores.sort((a, b) => b.score - a.score);

  let ranked = [];
  for (let i = 0; i < Math.min(scores.length, 50); i++) {
    ranked.push({
      rank: i + 1,
      ldap: scores[i].ldap,
      diff: scores[i].diff,
      score: scores[i].score, // FIX 2: Use lowercase 's' to retrieve the score correctly!
      isYou: scores[i].ldap === currentUser
    });
  }
  
  return ranked;
}

function getGlobalRankings(sortType) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Wallets');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  let scores = [];
  
  // Default to 'xp' if no sortType is provided
  let useWealth = (sortType === 'wealth');

  for (let i = 1; i < data.length; i++) {
    // Col C (Index 2) is Unspent Points. Col E (Index 4) is XP.
    let val = useWealth ? (Number(data[i][2]) || 0) : (Number(data[i][4]) || 0);
    
    scores.push({
      ldap: data[i][0],
      char: data[i][0].charAt(0).toUpperCase(),
      score: val,
      total: Number(data[i][3]) || 0,
      xp: Number(data[i][4]) || 0,
      tag: String(data[i][9] || '').trim() // <--- ADDED PLAYER TAG (Column J)
    });
  }
  
  // Sort highest to lowest
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 50); // Return top 50
}

function getAllPersonalBests() {
  const user = getSessionInfo().ldap;
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('PersonalBests');
  if (!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  let bests = {};
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user) {
      const game = data[i][1];
      const score = Number(data[i][3]);
      if (!bests[game] || score > bests[game]) {
        bests[game] = score;
      }
    }
  }
  return bests;
}

const ACHIEVEMENT_DEFS = {
  'no_miss': { label: '🎯 No Miss', desc: 'Clear Whack-a-Bug without missing a single tap.' },
  'pac_master': { label: '🍒 Pac-Master', desc: 'Reach Stage 3 in PacMan.' },
  'serpent_king': { label: '🐍 Serpent King', desc: 'Reach length 50 in Retro Snake.' },
  'snake_diet': { label: '🍇 Diet Plan', desc: 'Eat a diet grape in Retro Snake.' },
  'block_star': { label: '🧱 Block Star', desc: 'Clear 4 lines at once in Tetris.' },
  'tetris_tspin': { label: '🌀 Spin Doctor', desc: 'Perform a T-Spin in Tetris.' },
  'speedrunner': { label: '⚡ Speedrunner', desc: 'Beat Minesweeper on Medium or Hard.' },
  'sudoku_perfect': { label: '🔢 Perfectionist', desc: 'Solve Sudoku without a single error.' },
  'solitaire_win': { label: '🃏 Card Shark', desc: 'Win a game of Solitaire.' },
  'wordsmith': { label: '📝 Wordsmith', desc: 'Solve Playdle in 3 guesses or fewer.' },
  'math_genius': { label: '🧠 2048 Master', desc: 'Reach the 2048 tile.' },
  'combo_king': { label: '🔥 Combo King', desc: 'Get a 5x chain combo in 2048.' },
  'piano_apprentice': { label: '🎵 Apprentice', desc: 'Reach a 50x combo in Piano Tiles.' },
  'piano_maestro': { label: '🎹 Maestro', desc: 'Reach a 100x combo in Piano Tiles.' },
  'blind_musician': { label: '🦇 Blind Musician', desc: 'Score 500+ points on Hard in Piano Tiles.' },
  'spam_boss': { label: '👹 Inbox Zero', desc: 'Defeat the Boss in Spam Defender.' }
};

function saveAchievement(achId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const user = getSessionInfo().ldap;
    const ss = getSpreadsheet_();
    let sheet = ss.getSheetByName('Achievements');
    if (!sheet) {
      sheet = ss.insertSheet('Achievements');
      sheet.appendRow(['Timestamp', 'User', 'AchievementID']);
    }
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === user && data[i][2] === achId) {
        return { isNew: false };
      }
    }
    
    sheet.appendRow([new Date(), user, achId]);
    return { isNew: true, label: ACHIEVEMENT_DEFS[achId].label };
    
  } catch (e) {
    return { isNew: false };
  } finally {
    lock.releaseLock();
  }
}

function getProfileStats() {
  const user = getSessionInfo().ldap;
  const ss = getSpreadsheet_();
  
  let stats = {
    ldap: user,
    email: getSessionInfo().email,
    totalScore: 0,
    gamesPlayed: 0,
    bests: getAllPersonalBests(),
    achievements: [],
    achievementDefs: ACHIEVEMENT_DEFS,
    favoriteGame: null,
    gameCounts: {},
    wallet: { tickets: 0, unspent: 0 }
  };

  // Get Wallet
  const wSheet = ss.getSheetByName('Wallets');
  if (wSheet) {
    const wData = wSheet.getDataRange().getValues();
    for (let i = 1; i < wData.length; i++) {
      if (wData[i][0] === user) {
        stats.wallet.tickets = Number(wData[i][1]); // Col B
        stats.wallet.unspent = Number(wData[i][2]); // Col C
        stats.totalScore = Number(wData[i][3]);     // Col D
        stats.xp = Number(wData[i][4]) || 0;        // Col E (XP)
        stats.csat = wData[i][5] || '';             // Col F (CSAT)
        stats.attendance = wData[i][6] || '';
        stats.team = wData[i][8] || ''; // Col I
        stats.tag = wData[i][9] || '';  // Col J
        
        break;
      }
    }
  }
  
  const hSheet = ss.getSheetByName('GameHistory');
  if (hSheet) {
    const hData = hSheet.getDataRange().getValues();
    for (let i = 1; i < hData.length; i++) {
      if (hData[i][1] === user) {
        let game = hData[i][2];
        if (!game.toString().startsWith('Claimed Bounty')) {
          stats.gamesPlayed++;
          stats.gameCounts[game] = (stats.gameCounts[game] || 0) + 1;
        }
      }
    }
    let maxPlayed = 0;
    for (let g in stats.gameCounts) {
      if (stats.gameCounts[g] > maxPlayed) {
        maxPlayed = stats.gameCounts[g];
        stats.favoriteGame = g;
      }
    }
  }
  
  const aSheet = ss.getSheetByName('Achievements');
  if (aSheet) {
    const aData = aSheet.getDataRange().getValues();
    for (let i = 1; i < aData.length; i++) {
      if (aData[i][1] === user) {
        stats.achievements.push({ id: aData[i][2] });
      }
    }
  }

  return stats;
}

function saveFeedback(type, text) {
  try {
    const user = getSessionInfo().ldap;
    const ss = getSpreadsheet_();
    let sheet = ss.getSheetByName('Feedback');
    if (!sheet) {
      sheet = ss.insertSheet('Feedback');
      sheet.appendRow(['Timestamp', 'User', 'Type', 'Feedback']);
    }
    sheet.appendRow([new Date(), user, type, text]);
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

// ════════════════════════════════════════════════════════════
//  5. THE VEGAS CASINO ENGINE (RIGGED)
// ════════════════════════════════════════════════════════════

function getWalletBalance() {
  const user = getSessionInfo().ldap;
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Wallets');
  
  if (!sheet) return { tickets: 0, unspent: 0, xp: 0, perfMult: 1.0 };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user) {
      // Safely grab CSAT and Attendance, defaulting to empty strings if blank
      let csat = data[i][5] || '';
      let att = data[i][6] || '';
      
      // Call the performance multiplier
      let perf = getPerformanceMultiplier(csat, att);
      
      return {
        tickets: Number(data[i][1]) || 0,
        unspent: Number(data[i][2]) || 0,
        xp: Number(data[i][4]) || 0,
        perfMult: perf
      };
    }
  }
  return { tickets: 0, unspent: 0, xp: 0, perfMult: 1.0 };
}

function playCasino(gameType, wager, betDetails) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = getSessionInfo().ldap;
    if (!_checkRateLimit('casino_' + user, 60, 60)) {
      return { success: false, message: 'Too many requests. Please slow down.' };
    }
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName('Wallets');
    
    if (!sheet) return { success: false, message: 'Casino is currently closed.' };

    wager = Math.floor(Number(wager));
    if (wager <= 0) return { success: false, message: 'Invalid wager.' };
    if (wager > 500000) return { success: false, message: 'Maximum wager is 500,000 points.' };

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === user) { rowIndex = i + 1; break; }
    }

    if (rowIndex === -1) return { success: false, message: 'Wallet not found. Play a game first!' };

    let currentTickets = Number(data[rowIndex-1][1]);
    let unspent = Number(data[rowIndex-1][2]);
    let lifetime = Number(data[rowIndex-1][3]);
    let xp = Number(data[rowIndex-1][4]) || 0;

    // --- SERVER-SIDE LEVEL CHECK ---
    let playerLvl = Math.floor(Math.sqrt(xp / 1500)) + 1;
    if (playerLvl < 20) { // Changed from 100 to 20
      return shadowban(user, 'Console Hack Attempt: Casino access under Lv. 20', wager);
    }
    // -------------------------------

    if (unspent < wager) return { success: false, message: 'Insufficient points for this wager.' };

    // 1. Deduct wager immediately
    unspent -= wager;

    // ----------------------------------------------------
    // THE JACKPOT VAULT CONNECTION
    // ----------------------------------------------------
    const props = PropertiesService.getScriptProperties();
    let currentPool = parseInt(props.getProperty('CASINO_JACKPOT') || '500000', 10);
    let jackpotWon = false;
    let jackpotAmount = 0;

    // 2. Roll the rigged RNG
    let payout = 0;
    let resultMessage = "";
    const roll = Math.floor(Math.random() * 100) + 1; // 1 to 100

    if (gameType === 'slots') {
      // 85% loss rate.
      if (roll <= 85) { resultMessage = "🍒 🍋 🔔 ... No match. You lose."; }
      else if (roll <= 95) { payout = wager * 1.5; resultMessage = "🍒 🍒 🍒! Minor win!"; }
      else if (roll <= 99) { payout = wager * 3; resultMessage = "🔔 🔔 🔔! Big win!"; }
      else { 
        // PROGRESSIVE JACKPOT TRIGGERED!
        jackpotWon = true;
        jackpotAmount = currentPool;
        payout = (wager * 10) + jackpotAmount; 
        resultMessage = `💎 💎 💎! MASSIVE JACKPOT! You won the pool of ${jackpotAmount.toLocaleString()} points!`; 
      }
    } 
    else if (gameType === 'blackjack') {
      // Auto-resolve blackjack: 65% house wins, 5% push, 30% player wins
      if (roll <= 65) { resultMessage = `Dealer draws 21. You lose.`; }
      else if (roll <= 70) { payout = wager; resultMessage = "Push. Dealer ties your hand. Wager returned."; }
      else { payout = wager * 2; resultMessage = "Blackjack! You beat the dealer!"; }
    }
    else if (gameType === 'baccarat') {
      // Extremely rigged: Engine looks at your bet and favors the opposite
      const playerBet = betDetails; // 'player' or 'banker'
      const houseWinsRig = Math.random() < 0.70; // 70% chance to force a loss
      
      if (houseWinsRig) {
        resultMessage = playerBet === 'player' ? "Banker wins with a natural 9." : "Player wins with an 8.";
      } else {
        payout = playerBet === 'banker' ? Math.floor((wager * 2) * 0.95) : wager * 2; // 5% commission on Banker
        resultMessage = playerBet === 'banker' ? "Banker wins! (5% commission taken)" : "Player wins!";
      }
    }
    else if (gameType === 'horses') {
      // Pick a horse 1-4. 85% chance you lose.
      if (roll <= 85) {
        const winningHorse = (Number(betDetails) % 4) + 1; // Always a horse you didn't pick
        resultMessage = `Horse #${winningHorse} crosses the finish line! Your horse tripped.`;
      } else {
        payout = wager * 4;
        resultMessage = `Photo finish! Horse #${betDetails} wins the derby!`;
      }
    }

    // ----------------------------------------------------
    // PROCESS JACKPOT LOGIC
    // ----------------------------------------------------
    if (jackpotWon) {
      // If they cracked the vault, reset the pool to 500k to maintain hype
      props.setProperty('CASINO_JACKPOT', '500000');
    } else if (payout === 0) {
      // If it was a pure loss, feed the wager into the global pool!
      props.setProperty('CASINO_JACKPOT', (currentPool + wager).toString());
    }

    // 3. Add payout back to unspent
    unspent += payout;

    // Re-calculate tickets in case they won big
    let newTicketsToAdd = Math.floor(unspent / EXCHANGE_RATE);
    let finalUnspent = unspent % EXCHANGE_RATE;
    let finalTickets = currentTickets + newTicketsToAdd;

    // 4. Save to DB
    sheet.getRange(rowIndex, 2, 1, 3).setValues([[
      finalTickets, 
      finalUnspent, 
      lifetime
    ]]);

    // --- PIT BOSS LEDGER: LOG TO CASINO SHEET ---
    try {
      let logSheet = ss.getSheetByName('CasinoLogs');
      if (logSheet) {
        logSheet.appendRow([new Date(), user, gameType, wager, payout]);
      }
    } catch(logErr) { }
    // --------------------------------------------

    _log('INFO', 'playCasino', 'Casino result', { user: user, game: gameType, wager: wager, payout: payout, jackpot: jackpotWon });

    return { 
      success: true, 
      payout: payout, 
      message: resultMessage, 
      tickets: finalTickets, 
      unspent: finalUnspent 
    };

  } catch(e) {
    return { success: false, message: 'Casino engine error.' };
  } finally {
    lock.releaseLock();
  }
}
// ==========================================
// PROGRESSIVE JACKPOT VAULT
// ==========================================
function getLiveJackpotWithVersion() {
  var props = PropertiesService.getScriptProperties();
  var currentPool = props.getProperty('CASINO_JACKPOT');
  
  if (!currentPool) {
    currentPool = '500000';
    props.setProperty('CASINO_JACKPOT', currentPool);
  }
  
  return { 
    amount: parseInt(currentPool, 10), 
    version: APP_VERSION 
  };
}
function clientConvertTicket(itemName, ticketCost) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const user = getSessionInfo().ldap;
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName('Wallets');
    
    if (!sheet) return { success: false, message: 'Wallet database missing.' };

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === user) { rowIndex = i + 1; break; }
    }
    
    if (rowIndex === -1) return { success: false, message: 'Wallet not found.' };

    // --- SERVER-SIDE LEVEL CHECK ---
    let xp = Number(data[rowIndex-1][4]) || 0;
    let playerLvl = Math.floor(Math.sqrt(xp / 1500)) + 1;
    if (playerLvl < 999) {
      return shadowban(user, 'Console Hack Attempt: Ticket minting under Lv. 999', ticketCost);
    }
    
    let currentTickets = Number(data[rowIndex-1][1]);
    let unspent = Number(data[rowIndex-1][2]);
    let lifetime = Number(data[rowIndex-1][3]);

    // Concurrency check: re-read live cell before deducting
    let liveUnspent = Number(sheet.getRange(rowIndex, 3).getValue());
    if (liveUnspent < 500000) {
      return { success: false, message: 'Insufficient points.' };
    }
    if (liveUnspent !== unspent) {
      return { success: false, message: 'Balance changed — please try again.' };
    }
    unspent = liveUnspent; // Use the verified live value going forward
    
    // Ticket redemption cap: max 2 tickets per 3 days
    let logSheet = ss.getSheetByName('StoreLogs');
    if (!logSheet) {
      logSheet = ss.insertSheet('StoreLogs');
      logSheet.appendRow(['Timestamp', 'User', 'Item', 'Cost', 'Status']);
    }
    const logData = logSheet.getDataRange().getValues();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    let recentConversions = 0;
    for (let i = 1; i < logData.length; i++) {
      if (logData[i][1] === user && logData[i][2] === 'Ticket Conversion' && new Date(logData[i][0]) > threeDaysAgo) {
        recentConversions++;
      }
    }
    if (recentConversions >= 2) {
      return { success: false, message: 'Ticket limit reached. You can mint 2 tickets every 3 days.' };
    }
    
    // Do the manual math
    let newUnspent = unspent - 500000;
    let newTickets = currentTickets + 1;
    
    // Save to sheet
    sheet.getRange(rowIndex, 2, 1, 3).setValues([[newTickets, newUnspent, lifetime]]);
    logSheet.appendRow([new Date(), user, 'Ticket Conversion', 500000, 'Completed']);

    return { success: true, newPoints: newUnspent, newTickets: newTickets };
  } catch (e) {
    return { success: false, message: 'Transaction error.' };
  } finally {
    lock.releaseLock();
  }
}

function processGameRewards(user, rawScore, gameTitle) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName('Wallets');
  
  // --- NEW: CAFE TYCOON ECONOMY SAFEGUARD ---
  let ecoScore = rawScore;
  if (gameTitle === 'Cafe Tycoon') {
      // Use square root scaling for the payout (1M score = 1,000 pts)
      ecoScore = Math.floor(Math.sqrt(rawScore));
      
      // Hard ceiling: They can never earn more than 25,000 points in one match
      if (ecoScore > 25000) ecoScore = 25000;
  }
  // ------------------------------------------

  // Only grab the data block that actually exists
  const data = sheet.getRange(1, 1, sheet.getLastRow() || 1, 8).getValues();
  let rowIndex = -1;
  let firstEmptyRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user) { 
      rowIndex = i + 1; 
      break; 
    }
    // Track the first row where Column A (LDAP) is blank
    if (data[i][0] === "" && firstEmptyRow === -1) { 
      firstEmptyRow = i + 1; 
    }
  }
  
  if (rowIndex === -1) {
    // NEW USER: Place them in the first blank LDAP row, ignoring formulas
    let targetRow = (firstEmptyRow !== -1) ? firstEmptyRow : data.length + 1;
    let fatigueRes = calculateFatigue(gameTitle, "");
    
    // Write LDAP, Tickets, Unspent, Total, and XP to Columns A through E
    sheet.getRange(targetRow, 1, 1, 5).setValues([[user, 0, ecoScore, ecoScore, ecoScore]]);
    // Write DailyPlayData directly to Column H (Skips F and G to preserve formulas/integrity)
    sheet.getRange(targetRow, 8).setValue(fatigueRes.newData);

    return { tickets: 0, unspent: ecoScore, earnedXP: ecoScore, earnedPoints: ecoScore, mult: 1.0, perf: 1.0, fatigue: 1.0 }; // FIXED
  } else {
    // EXISTING USER
    let row = data[rowIndex-1];
    let currentTickets = Number(row[1]) || 0;
    let unspent = Number(row[2]) || 0;
    let lifetime = Number(row[3]) || 0;
    let xp = Number(row[4]) || 0;
    let csat = row[5] || '';
    let attendance = row[6] || '';
    let dailyData = row[7] || '';

    // Calculate Multipliers
    let perfMult = getPerformanceMultiplier(csat, attendance);
    let fatigueRes = calculateFatigue(gameTitle, dailyData);
    let finalMultiplier = perfMult * fatigueRes.fatigueMult;

    // Apply Math
    let earnedPoints = Math.floor(ecoScore * finalMultiplier);
    let earnedXP = Math.floor(ecoScore * finalMultiplier);

    unspent += earnedPoints;
    lifetime += earnedPoints;
    xp += earnedXP;

    // Batch update Columns B through H (Tickets, Unspent, Total, XP, CSAT, Attendance, DailyPlayData)
    sheet.getRange(rowIndex, 2, 1, 7).setValues([[currentTickets, unspent, lifetime, xp, csat, attendance, fatigueRes.newData]]);

    return { 
      tickets: currentTickets, unspent: unspent, earnedXP: earnedXP, earnedPoints: earnedPoints, 
      mult: finalMultiplier, perf: perfMult, fatigue: fatigueRes.fatigueMult 
    };
  }
}

// =========================================================================
// RPG & ECONOMY ENGINE HELPER FUNCTIONS
// =========================================================================

function getPerformanceMultiplier(csat, attendance) {
  let multiplier = 1.0; 
  let c = parseFloat(csat) || 0;
  let a = parseFloat(attendance) || 0;

  // Sheets formula fix: Convert decimals (0.96) into whole percentages (96)
  if (c > 0 && c <= 1.0) c = c * 100;
  if (a > 0 && a <= 1.0) a = a * 100;

  if (c >= 95) multiplier += 0.5;
  else if (c >= 90) multiplier += 0.25;

  if (a >= 100) multiplier += 0.5;
  else if (a >= 95) multiplier += 0.25;

  return multiplier;
}

function calculateFatigue(gameTitle, dailyDataString) {
  let today = new Date().toDateString();
  let data = {};

  try {
    if (dailyDataString) data = JSON.parse(dailyDataString);
  } catch (e) {
    data = {};
  }

  if (data.date !== today) {
    data = { date: today, counts: {}, totalPlays: 0 };
  }

  // Track per-game plays AND total daily plays
  let playCount = (data.counts[gameTitle] || 0) + 1;
  data.counts[gameTitle] = playCount;
  
  data.totalPlays = (data.totalPlays || 0) + 1;

  let fatigueMult = 1.0;

  // 1. GLOBAL CAP: If they play more than 100 games in a single day, tank ALL rewards to 5%
  if (data.totalPlays > 100) {
      fatigueMult = 0.05; 
  } 
  // 2. PER-GAME CAP: Prevent them from spamming the exact same game
  else if (playCount > 50) {
      fatigueMult = 0.25; // 51+ plays: 25% rewards
  } 
  else if (playCount > 25) {
      fatigueMult = 0.50; // 26-50 plays: 50% rewards
  } 
  else if (playCount > 15) {
      fatigueMult = 0.80; // 16-25 plays: 80% rewards
  }

  return { 
    fatigueMult: fatigueMult, 
    newData: JSON.stringify(data) 
  };
}
// ════════════════════════════════════════════════════════════
//  ADMIN GOD MODE (OPERATIONS)
// ════════════════════════════════════════════════════════════
const ADMIN_USERS = ['stevenjosephc']; // Add any other admin LDAPs here inside quotes!

function verifyAdmin() {
   return ADMIN_USERS.includes(getSessionInfo().ldap);
}

function executeAdminAction(targetLdap, action, amount) {
   if (!verifyAdmin()) return { success: false, message: 'Unauthorized access. Activity logged.' };
   const ss = getSpreadsheet_();

   // 1. Pardon Shadowbans
   if (action === 'unban') {
      const shadowSheet = ss.getSheetByName('Shadowbans');
      if (shadowSheet) {
         const data = shadowSheet.getDataRange().getValues();
         for (let i = data.length - 1; i > 0; i--) { 
            if (data[i][1] === targetLdap) {
               shadowSheet.deleteRow(i + 1);
               return { success: true, message: `Pardoned ${targetLdap} from Shadowban list.` };
            }
         }
      }
      return { success: false, message: `${targetLdap} not found on the ban list.` };
   }

   const walletSheet = ss.getSheetByName('Wallets');
   if (!walletSheet) return { success: false, message: 'Wallet sheet not found.' };

   const data = walletSheet.getDataRange().getValues();
   let rowIndex = -1;
   for (let i = 1; i < data.length; i++) {
     if (data[i][0] === targetLdap) { rowIndex = i + 1; break; }
   }

   if (rowIndex === -1) return { success: false, message: `${targetLdap} has no wallet. They must play a game first.` };

   // 2. Inject Points & XP
   if (action === 'give_pts') {
      let unspent = Number(data[rowIndex-1][2]) || 0;
      let lifetime = Number(data[rowIndex-1][3]) || 0;
      let xp = Number(data[rowIndex-1][4]) || 0;
      walletSheet.getRange(rowIndex, 3, 1, 3).setValues([[unspent + amount, lifetime + amount, xp + amount]]);
      return { success: true, message: `Injected ${amount.toLocaleString()} Pts/XP into ${targetLdap}'s wallet.` };
   }

   // 3. Grant Tickets
   if (action === 'give_tkt') {
      let tickets = Number(data[rowIndex-1][1]) || 0;
      walletSheet.getRange(rowIndex, 2).setValue(tickets + amount);
      return { success: true, message: `Granted ${amount} Tickets to ${targetLdap}.` };
   }

   return { success: false, message: 'Unknown action.' };
}

function getTeamRankings() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Wallets');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  let teams = {};

  for (let i = 1; i < data.length; i++) {
    // Read Column I (Index 8) for the Team Name
    let teamName = String(data[i][8] || 'Freelancers').trim(); 
    if (teamName === '') teamName = 'Freelancers';
    
    let xp = Number(data[i][4]) || 0; // Column E

    if(!teams[teamName]) teams[teamName] = { name: teamName, xp: 0, members: 0 };
    teams[teamName].xp += xp;
    teams[teamName].members += 1;
  }

  let scores = Object.values(teams);
  scores.sort((a, b) => b.xp - a.xp); // Sort highest XP to lowest
  return scores.slice(0, 20); // Return top 20 Squads
}

function updatePlayerProfile(teamName, playerTag) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const user = getSessionInfo().ldap;
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName('Wallets');
    if (!sheet) return { success: false, message: 'Database missing.' };

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === user) { rowIndex = i + 1; break; }
    }

    if (rowIndex === -1) return { success: false, message: 'Play a game first to create a profile!' };

    // Sanitize the inputs: Max 25 chars for Team, Max 4 uppercase chars for Tag
    let safeTeam = String(teamName || '').substring(0, 25).trim();
    let safeTag = String(playerTag || '').substring(0, 4).toUpperCase().trim();

    // Save to Column I (Index 9) for Team, and Column J (Index 10) for Tag
    sheet.getRange(rowIndex, 9, 1, 2).setValues([[safeTeam, safeTag]]);

    return { success: true, message: 'Profile updated!' };
  } catch(e) {
    return { success: false, message: 'Update failed.' };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// POKEMON PLAY: BACKEND DATABASE CONTROLLER
// ==========================================

function getPokemonData() {
  var sheet = getSpreadsheet_().getSheetByName("Wallets");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var email = Session.getActiveUser().getEmail();
  var ldap = email.split('@')[0];
  
  var ldapCol = headers.indexOf('LDAP') > -1 ? headers.indexOf('LDAP') : (headers.indexOf('ldap') > -1 ? headers.indexOf('ldap') : 0);
  var pokeCol = headers.indexOf('pokemonData');
  
  if (pokeCol === -1) return null; 
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][ldapCol] === ldap || data[i][ldapCol] === email) {
      return data[i][pokeCol] || null;
    }
  }
  return null;
}

// ADDED clientVersion as the 3rd parameter
function syncPokemonData(pointsSpent, pokemonDataJSON, clientVersion) {
  
  // NEW: Strict Version Lock! Reject ghost saves from old tabs.
  if (clientVersion !== APP_VERSION) {
    return { success: false, message: "⚠️ Game updated! Please refresh your browser." };
  }

  const ss = getSpreadsheet_();
  var sheet = ss.getSheetByName("Wallets");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  // ... (Leave the rest of the function exactly as it is!)

  var email = Session.getActiveUser().getEmail();
  var ldap = email.split('@')[0];

  var ldapCol = headers.indexOf('LDAP') > -1 ? headers.indexOf('LDAP') : headers.indexOf('ldap');
  
  // 1. FIXED: Now matches your exact spreadsheet column name!
  var unspentCol = headers.indexOf('Unspent_Points'); 
  var pokeCol = headers.indexOf('pokemonData');

  if (pokeCol === -1) {
    pokeCol = headers.length;
    sheet.getRange(1, pokeCol + 1).setValue('pokemonData');
  }

  for (var i = 1; i < data.length; i++) {
    if (data[i][ldapCol] === ldap || data[i][ldapCol] === email) {
      
      var currentUnspent = Number(data[i][unspentCol]) || 0;

      // Ensure they don't go into debt when buying packs
      if (pointsSpent > 0 && currentUnspent < pointsSpent) {
        return { success: false, message: "Insufficient Points for this transaction." };
      }

      // Calculate the new balance (works for both positive spends and negative rewards)
      var newUnspent = currentUnspent - pointsSpent;

      // 2. FIXED: Removed the 'if (pointsSpent > 0)' block so rewards can be saved!
      data[i][unspentCol] = newUnspent;
      data[i][pokeCol] = pokemonDataJSON;

      let startCol = Math.min(unspentCol, pokeCol);
      let endCol = Math.max(unspentCol, pokeCol);
      sheet.getRange(i + 1, startCol + 1, 1, endCol - startCol + 1).setValues([data[i].slice(startCol, endCol + 1)]);

      return { success: true, unspent: newUnspent };
    }
  }
  return { success: false, message: "Player record not found." };
}

// ==========================================
// POKEMON GTS & AUCTION LOGIC
// ==========================================
function getGTSListings() {
  const ss = getSpreadsheet_();
  var sheet = ss.getSheetByName("Marketplace");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var listings = [];
  var now = new Date().getTime();

  var walletSheet = ss.getSheetByName("Wallets");
  var wData = walletSheet.getDataRange().getValues();
  var wHeaders = wData[0];

  for (var i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('Status')] === 'Active') {
      var endTime = Number(data[i][headers.indexOf('ExpirationTime')]) || 0;
      
      // AUTO-RESOLVER: If the auction is expired, the server resolves it instantly!
      if (endTime > 0 && now >= endTime) {
          resolveExpiredAuction(i + 1, data, headers, wData, wHeaders);
          continue; // Skip adding this expired listing to the active board
      }

      listings.push({
        row: i + 1,
        id: data[i][headers.indexOf('ListingID')],
        seller: data[i][headers.indexOf('SellerLDAP')],
        pokeId: Number(data[i][headers.indexOf('PokemonID')]),
        lvl: Number(data[i][headers.indexOf('PokemonLvl')]),
        shiny: data[i][headers.indexOf('IsShiny')] === true || data[i][headers.indexOf('IsShiny')] === 'TRUE',
        bid: Number(data[i][headers.indexOf('CurrentBid')]),
        bidder: data[i][headers.indexOf('HighestBidderLDAP')],
        buyout: Number(data[i][headers.indexOf('BuyoutPrice')]) || 0,
        endTime: endTime,
        nature: data[i][headers.indexOf('Nature')] || 'Hardy'
      });
    }
  }
  return listings.reverse();
}

function placeGTSBid(rowIdx, bidAmount) {
  const ss = getSpreadsheet_();
  var sheet = ss.getSheetByName("Marketplace");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var email = Session.getActiveUser().getEmail();
  var ldap = email.split('@')[0];

  var currentBid = Number(data[rowIdx-1][headers.indexOf('CurrentBid')]);
  var highestBidder = data[rowIdx-1][headers.indexOf('HighestBidderLDAP')];

  if (bidAmount <= currentBid) return { success: false, message: "Bid must be higher than current bid!" };

  // Check new bidder's wallet
  var walletSheet = ss.getSheetByName("Wallets");
  var wData = walletSheet.getDataRange().getValues();
  var wHeaders = wData[0];
  var ldapCol = wHeaders.indexOf('LDAP') > -1 ? wHeaders.indexOf('LDAP') : wHeaders.indexOf('ldap');
  var unspentCol = wHeaders.indexOf('Unspent_Points');

  var bidderRow = -1;
  var bidderFunds = 0;
  for (var i = 1; i < wData.length; i++) {
    if (wData[i][ldapCol] === ldap || wData[i][ldapCol] === email) {
      bidderRow = i + 1;
      bidderFunds = Number(wData[i][unspentCol]) || 0;
      break;
    }
  }

  if (bidderRow === -1 || bidderFunds < bidAmount) {
    return { success: false, message: "Insufficient Points for this bid!" };
  }

  // Escrow Refund: Give points back to the person who just got outbid!
  if (highestBidder && highestBidder !== "" && highestBidder !== "None") {
    for (var j = 1; j < wData.length; j++) {
      if (wData[j][ldapCol] === highestBidder) {
        var oldFunds = Number(wData[j][unspentCol]) || 0;
        walletSheet.getRange(j + 1, unspentCol + 1).setValue(oldFunds + currentBid);
        break;
      }
    }
  }

  // Deduct from the new highest bidder
  walletSheet.getRange(bidderRow, unspentCol + 1).setValue(bidderFunds - bidAmount);

  // Update the Auction Sheet (Batch update CurrentBid and HighestBidderLDAP if contiguous)
  let cbIdx = headers.indexOf('CurrentBid');
  let hbIdx = headers.indexOf('HighestBidderLDAP');
  let row = data[rowIdx - 1];
  row[cbIdx] = bidAmount;
  row[hbIdx] = ldap;

  if (Math.abs(cbIdx - hbIdx) === 1) {
    let startIdx = Math.min(cbIdx, hbIdx);
    sheet.getRange(rowIdx, startIdx + 1, 1, 2).setValues([[row[startIdx], row[startIdx + 1]]]);
  } else {
    sheet.getRange(rowIdx, cbIdx + 1).setValue(bidAmount);
    sheet.getRange(rowIdx, hbIdx + 1).setValue(ldap);
  }

  return { success: true, message: "Bid placed successfully!" };
}

function createGTSListing(pokeId, lvl, shiny, startingBid, buyoutPrice, nature) {
  const ss = getSpreadsheet_();
  var sheet = ss.getSheetByName("Marketplace");
  if (!sheet) return { success: false, message: "Marketplace sheet not found!" };

  var email = Session.getActiveUser().getEmail();
  var ldap = email.split('@')[0];
  var newId = Utilities.getUuid().split('-')[0]; 
  
  // Set expiration for exactly 24 hours from right now!
  var endTime = new Date().getTime() + (24 * 60 * 60 * 1000);
  
  // FIXED: Changed "isShiny" to "shiny" to match the function parameter
  sheet.appendRow([
    newId, ldap, pokeId, lvl, shiny, startingBid, "None", "Active", buyoutPrice, endTime, nature
  ]);
  
  return { success: true, message: "Pokemon listed on the GTS!" };
}

function buyoutGTSListing(rowIdx) {
  const ss = getSpreadsheet_();
  var sheet = ss.getSheetByName("Marketplace");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var email = Session.getActiveUser().getEmail();
  var ldap = email.split('@')[0];

  var listing = data[rowIdx-1];
  var status = listing[headers.indexOf('Status')];
  var buyoutPrice = Number(listing[headers.indexOf('BuyoutPrice')]);
  var currentBid = Number(listing[headers.indexOf('CurrentBid')]);
  var highestBidder = listing[headers.indexOf('HighestBidderLDAP')];
  var seller = listing[headers.indexOf('SellerLDAP')];
  var pokeId = Number(listing[headers.indexOf('PokemonID')]);
  var lvl = Number(listing[headers.indexOf('PokemonLvl')]);
  var isShiny = listing[headers.indexOf('IsShiny')] === true || listing[headers.indexOf('IsShiny')] === 'TRUE';
  var nature = listing[headers.indexOf('Nature')] || 'Hardy'; // <--- NEW!

  if (status !== 'Active') return { success: false, message: "Listing is no longer active!" };
  if (buyoutPrice <= 0) return { success: false, message: "This listing does not have a buyout option." };
  if (seller === ldap) return { success: false, message: "You cannot buy your own listing!" };

  // 1. Check buyer funds
  var walletSheet = ss.getSheetByName("Wallets");
  var wData = walletSheet.getDataRange().getValues();
  var wHeaders = wData[0];
  var ldapCol = wHeaders.indexOf('LDAP') > -1 ? wHeaders.indexOf('LDAP') : wHeaders.indexOf('ldap');
  var unspentCol = wHeaders.indexOf('Unspent_Points');

  var buyerRow = -1; var buyerFunds = 0;
  var sellerRow = -1; var sellerFunds = 0;

  for (var i = 1; i < wData.length; i++) {
    if (wData[i][ldapCol] === ldap || wData[i][ldapCol] === email) { buyerRow = i + 1; buyerFunds = Number(wData[i][unspentCol]) || 0; }
    if (wData[i][ldapCol] === seller) { sellerRow = i + 1; sellerFunds = Number(wData[i][unspentCol]) || 0; }
  }

  if (buyerRow === -1 || buyerFunds < buyoutPrice) return { success: false, message: "Insufficient Points for buyout!" };

  // 2. Refund the current highest bidder (if someone was already bidding)
  if (highestBidder && highestBidder !== "None") {
    for (var j = 1; j < wData.length; j++) {
      if (wData[j][ldapCol] === highestBidder) {
        var oldFunds = Number(wData[j][unspentCol]) || 0;
        walletSheet.getRange(j + 1, unspentCol + 1).setValue(oldFunds + currentBid);
        break;
      }
    }
  }

  // 3. Process the transaction
  walletSheet.getRange(buyerRow, unspentCol + 1).setValue(buyerFunds - buyoutPrice);
  if (sellerRow !== -1) walletSheet.getRange(sellerRow, unspentCol + 1).setValue(sellerFunds + buyoutPrice);

  // 4. Close the listing (Batch update CurrentBid, HighestBidderLDAP, and Status if contiguous)
  let stIdx = headers.indexOf('Status');
  let hbIdx = headers.indexOf('HighestBidderLDAP');
  let cbIdx = headers.indexOf('CurrentBid');
  let row = data[rowIdx - 1];
  row[stIdx] = "Sold";
  row[hbIdx] = ldap;
  row[cbIdx] = buyoutPrice;

  let indices = [stIdx, hbIdx, cbIdx];
  let minIdx = Math.min(...indices);
  let maxIdx = Math.max(...indices);

  if (maxIdx - minIdx === 2) {
    sheet.getRange(rowIdx, minIdx + 1, 1, 3).setValues([row.slice(minIdx, maxIdx + 1)]);
  } else {
    sheet.getRange(rowIdx, stIdx + 1).setValue("Sold");
    sheet.getRange(rowIdx, hbIdx + 1).setValue(ldap);
    sheet.getRange(rowIdx, cbIdx + 1).setValue(buyoutPrice);
  }

  return { 
    success: true, 
    message: "Buyout successful! Card added to Binder.", 
    card: { id: pokeId, lvl: lvl, shiny: isShiny, nature: nature } // <--- Added nature to the payload!
  };
}

// ==========================================
// RANKED PVP & LEADERBOARD LOGIC
// ==========================================
function syncRankedDefense(squadJSON, gymLvl) {
  const lock = LockService.getScriptLock();
  try {
    // Traffic Cop: Make simultaneous saves wait in line for up to 5 seconds
    lock.waitLock(5000); 
    
    const ss = getSpreadsheet_();
    var sheet = ss.getSheetByName("Leaderboard");
    if (!sheet) return;
    
    // Force lowercase to ensure perfect matching
    var ldap = String(Session.getActiveUser().getEmail().split('@')[0]).toLowerCase(); 
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var ldapCol = headers.indexOf('LDAP');
    
    var rowIdx = -1;
    for(var i = 1; i < data.length; i++) {
       if(data[i][ldapCol] && String(data[i][ldapCol]).toLowerCase() === ldap) { 
         rowIdx = i + 1; 
         break; 
       }
    }
    
    var gymCol = headers.indexOf('GymLevel');
    if(rowIdx > -1) {
       // Update existing player
       let row = data[rowIdx - 1];
       let sqIdx = headers.indexOf('SquadJSON');
       row[sqIdx] = squadJSON;
       if(gymCol > -1) row[gymCol] = gymLvl;

       let startIdx = (gymCol > -1) ? Math.min(sqIdx, gymCol) : sqIdx;
       let endIdx = (gymCol > -1) ? Math.max(sqIdx, gymCol) : sqIdx;
       sheet.getRange(rowIdx, startIdx + 1, 1, endIdx - startIdx + 1).setValues([row.slice(startIdx, endIdx + 1)]);
    } else {
       // New player: LDAP, MMR, Squad, Wins, Losses, GymLevel
       sheet.appendRow([ldap, 1000, squadJSON, 0, 0, gymLvl]);
    }
  } catch (e) {
    Logger.log("Ranked Sync Error: " + e.toString());
  } finally {
    lock.releaseLock(); // Let the next save in line proceed
  }
}

function getRankedMatch() {
  const ss = getSpreadsheet_();
  var sheet = ss.getSheetByName("Leaderboard");
  var ldap = Session.getActiveUser().getEmail().split('@')[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var opponents = [];
  for(var i = 1; i < data.length; i++) {
     // Find everyone who isn't YOU, and actually has a squad saved
     if(data[i][headers.indexOf('LDAP')] !== ldap && data[i][headers.indexOf('SquadJSON')]) {
        opponents.push({
           ldap: data[i][headers.indexOf('LDAP')],
           mmr: Number(data[i][headers.indexOf('MMR')]),
           squad: JSON.parse(data[i][headers.indexOf('SquadJSON')])
        });
     }
  }
  
  if(opponents.length === 0) return { success: false, message: "No opponents found on the ladder!" };
  
  // Pick a random opponent from the ladder
  var op = opponents[Math.floor(Math.random() * opponents.length)];
  return { success: true, opponent: op };
}

function resolveRankedMatch(opponentLdap, isWin) {
  const ss = getSpreadsheet_();
  var sheet = ss.getSheetByName("Leaderboard");
  var ldap = Session.getActiveUser().getEmail().split('@')[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var myRow = -1; var opRow = -1;
  for(var i = 1; i < data.length; i++) {
     if(data[i][headers.indexOf('LDAP')] === ldap) myRow = i + 1;
     if(data[i][headers.indexOf('LDAP')] === opponentLdap) opRow = i + 1;
  }
  
  // Attacker ELO Change
  if (myRow > -1) {
     let row = data[myRow - 1];
     let mmrIdx = headers.indexOf('MMR');
     let winsIdx = headers.indexOf('Wins');
     let lossIdx = headers.indexOf('Losses');
     
     let myMmr = Number(row[mmrIdx]);
     let myWins = Number(row[winsIdx]);
     let myLosses = Number(row[lossIdx]);

     row[mmrIdx] = Math.max(0, myMmr + (isWin ? 25 : -15));
     if(isWin) row[winsIdx] = myWins + 1;
     else row[lossIdx] = myLosses + 1;

     // Batch update MMR through Losses
     let indices = [mmrIdx, winsIdx, lossIdx].filter(i => i > -1);
     let startIdx = Math.min(...indices);
     let endIdx = Math.max(...indices);
     sheet.getRange(myRow, startIdx + 1, 1, endIdx - startIdx + 1).setValues([row.slice(startIdx, endIdx + 1)]);
  }
  
  // Defender ELO Change (Smaller penalties so people don't lose all their rank while sleeping)
  if (opRow > -1) {
     let row = data[opRow - 1];
     let mmrIdx = headers.indexOf('MMR');
     let opMmr = Number(row[mmrIdx]);
     sheet.getRange(opRow, mmrIdx + 1).setValue(Math.max(0, opMmr + (isWin ? -5 : 10)));
  }
}

function getLeaderboard() {
  const ss = getSpreadsheet_();
  var sheet = ss.getSheetByName("Leaderboard");
  if(!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var lb = [];
  
  for(var i = 1; i < data.length; i++) {
     lb.push({
        ldap: data[i][headers.indexOf('LDAP')],
        mmr: Number(data[i][headers.indexOf('MMR')]),
        wins: Number(data[i][headers.indexOf('Wins')]),
        losses: Number(data[i][headers.indexOf('Losses')])
     });
  }
  lb.sort(function(a,b) { return b.mmr - a.mmr; }); // Sort by Highest MMR
  return lb.slice(0, 50); // Return Top 50
}

function resolveExpiredAuction(rowIdx, mData, mHeaders, wData, wHeaders) {
  const ss = getSpreadsheet_();
  var sheet = ss.getSheetByName("Marketplace");
  if (!mData) {
    mData = sheet.getDataRange().getValues();
    mHeaders = mData[0];
  }
  
  var listing = mData[rowIdx-1];
  var status = listing[mHeaders.indexOf('Status')];
  var endTime = Number(listing[mHeaders.indexOf('ExpirationTime')]);
  
  if (status !== 'Active') return { success: false, message: "Auction already resolved." };
  if (new Date().getTime() < endTime) return { success: false, message: "Auction has not ended yet!" };
  
  var seller = listing[mHeaders.indexOf('SellerLDAP')];
  var bidder = listing[mHeaders.indexOf('HighestBidderLDAP')];
  var currentBid = Number(listing[mHeaders.indexOf('CurrentBid')]);
  var pokeId = Number(listing[mHeaders.indexOf('PokemonID')]);
  var lvl = Number(listing[mHeaders.indexOf('PokemonLvl')]);
  var isShiny = listing[mHeaders.indexOf('IsShiny')] === true || listing[mHeaders.indexOf('IsShiny')] === 'TRUE';
  var nature = listing[mHeaders.indexOf('Nature')] || 'Hardy'; // <--- NEW!
  
  var walletSheet = ss.getSheetByName("Wallets");
  if (!wData) {
    wData = walletSheet.getDataRange().getValues();
    wHeaders = wData[0];
  }
  var ldapCol = wHeaders.indexOf('LDAP') > -1 ? wHeaders.indexOf('LDAP') : wHeaders.indexOf('ldap');
  var unspentCol = wHeaders.indexOf('Unspent_Points');
  var pokeCol = wHeaders.indexOf('pokemonData');
  
  if (bidder === "None" || !bidder) {
    // SCENARIO A: No one bid. Return the card safely to the seller.
    for (var i=1; i<wData.length; i++) {
      if (wData[i][ldapCol] === seller) {
        var sDataStr = wData[i][pokeCol];
        var sData = sDataStr ? JSON.parse(sDataStr) : { cards: {}, squad: [null,null,null], pity:0, gym:0 };
        if (!sData.cards[pokeId] || sData.cards[pokeId].lvl < lvl) sData.cards[pokeId] = { lvl: lvl, shiny: isShiny, nature: nature };
        else if (isShiny) sData.cards[pokeId].shiny = true;
        walletSheet.getRange(i+1, pokeCol+1).setValue(JSON.stringify(sData));
        break;
      }
    }
    sheet.getRange(rowIdx, mHeaders.indexOf('Status')+1).setValue('Expired-Returned');
    return { success: true, message: "Auction expired with no bids. Card returned to seller." };
    
  } else {
    // SCENARIO B: Someone won! Pay the seller, and give the card to the bidder.
    for (var j=1; j<wData.length; j++) {
      // 1. Pay Seller
      if (wData[j][ldapCol] === seller) {
        var oldFunds = Number(wData[j][unspentCol]) || 0;
        walletSheet.getRange(j+1, unspentCol+1).setValue(oldFunds + currentBid);
      }
      // 2. Inject Card into Bidder's Save File
      if (wData[j][ldapCol] === bidder) {
        var bDataStr = wData[j][pokeCol];
        var bData = bDataStr ? JSON.parse(bDataStr) : { cards: {}, squad: [null,null,null], pity:0, gym:0 };
        if (!bData.cards[pokeId] || bData.cards[pokeId].lvl < lvl) bData.cards[pokeId] = { lvl: lvl, shiny: isShiny, nature: nature };
        else if (isShiny) bData.cards[pokeId].shiny = true;
        walletSheet.getRange(j+1, pokeCol+1).setValue(JSON.stringify(bData));
      }
    }
    sheet.getRange(rowIdx, mHeaders.indexOf('Status')+1).setValue('Sold');
    return { success: true, message: "Auction resolved! Points & Pokemon transferred." };
  }
}

function getArcadeLeaderboard(game, filter) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('PersonalBests');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const currentUser = getSessionInfo().ldap;
  
  // NEW: Use an object to track the absolute highest score per player, per difficulty
  let bestScoresMap = {};
  
  // Clean the inputs to guarantee a perfect match
  let safeGame = String(game).trim();
  let safeFilter = String(filter || 'all').toLowerCase().trim();
  
  for (let i = 1; i < data.length; i++) {
    let rowLdap = data[i][0];
    let rowGame = String(data[i][1]).trim();
    let rowDiff = String(data[i][2]).trim();
    let rowScore = Number(data[i][3]) || 0;
    
    if (rowGame === safeGame) {
      // Cross-translate the UI buttons to match the Spreadsheet difficulty
      if (safeFilter !== 'all' && safeFilter !== 'all time' && safeFilter !== 'week') {
        let diffCheck = rowDiff.toLowerCase();
        if (diffCheck !== safeFilter && 
            !(safeFilter === 'standard' && diffCheck === 'medium') && 
            !(safeFilter === 'hardcore' && diffCheck === 'hard')) {
          continue;
        }
      }

      // Create a unique key for this player + difficulty combo
      let uniqueKey = rowLdap + '_' + rowDiff;
      
      // If we haven't seen this combo yet, or if this score is higher than the saved one, update it!
      if (!bestScoresMap[uniqueKey] || rowScore > bestScoresMap[uniqueKey].score) {
         bestScoresMap[uniqueKey] = {
            ldap: rowLdap,
            diff: rowDiff,
            score: rowScore
         };
      }
    }
  }

  // Convert our deduplicated map back into an array
  let scores = Object.values(bestScoresMap);

  // Sort highest to lowest
  scores.sort((a, b) => b.score - a.score);

  let ranked = [];
  for (let i = 0; i < Math.min(scores.length, 50); i++) {
    ranked.push({
      rank: i + 1,
      ldap: scores[i].ldap,
      diff: scores[i].diff,
      score: scores[i].score, 
      isYou: scores[i].ldap === currentUser
    });
  }
  
  return ranked;
}

function purgeExploiters() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = getSpreadsheet_();
    var sheet = ss.getSheetByName("Wallets"); // FIXED: Target Wallets
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    var exploitThreshold = 5000000; // Anyone over 5 million gets reset

    for (var i = 1; i < data.length; i++) { // Skip header row
      // Column C (Index 2) is Unspent Points, Column D (Index 3) is Lifetime Points
      var unspentPts = Number(data[i][2]) || 0;
      var lifetimePts = Number(data[i][3]) || 0;

      if (unspentPts > exploitThreshold || lifetimePts > exploitThreshold) {
        // Reset Unspent Points (Col C), Lifetime Points (Col D), and XP (Col E) to 0
        sheet.getRange(i + 1, 3, 1, 3).setValues([[0, 0, 0]]);
      }
    }
  } catch (e) {
    Logger.log("Purge Error: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}

function getPvPLeaderboard() {
  try {
    const ss = getSpreadsheet_();
    var sheet = ss.getSheetByName("Leaderboard");
    var walletSheet = ss.getSheetByName("Wallets");
    if (!sheet || !walletSheet) return [];
    
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return []; // No data yet
    
    // 1. Build a dictionary of LDAP -> Trainer Names by reading the save files
    var wData = walletSheet.getDataRange().getValues();
    var wHeaders = wData[0];
    var ldapCol = wHeaders.indexOf('LDAP') > -1 ? wHeaders.indexOf('LDAP') : wHeaders.indexOf('ldap');
    var pokeCol = wHeaders.indexOf('pokemonData');
    var trainerNames = {};
    
    if (pokeCol > -1) {
        for (var j = 1; j < wData.length; j++) {
            var wLdap = wData[j][ldapCol];
            var pDataStr = wData[j][pokeCol];
            if (wLdap && pDataStr) {
                try {
                    var pData = JSON.parse(pDataStr);
                    if (pData && pData.trainerName) {
                        trainerNames[wLdap] = pData.trainerName;
                    }
                } catch(e) {}
            }
        }
    }
    
    // 2. Build the Leaderboard using the custom names
    var headers = data[0];
    var lb = [];
    var gymCol = headers.indexOf('GymLevel');
    
    for (var i = 1; i < data.length; i++) {
       var rowLdap = data[i][headers.indexOf('LDAP')];
       if (!rowLdap) continue; // Skip blank rows
       
       lb.push({
          ldap: rowLdap,
          trainerName: trainerNames[rowLdap] || rowLdap, // Uses Trainer Name, fallbacks to LDAP if missing
          mmr: Number(data[i][headers.indexOf('MMR')]) || 0,
          wins: Number(data[i][headers.indexOf('Wins')]) || 0,
          losses: Number(data[i][headers.indexOf('Losses')]) || 0,
          gym: gymCol > -1 ? (Number(data[i][gymCol]) || 0) : 0 
       });
    }
    
    lb.sort(function(a,b) { return b.mmr - a.mmr; }); // Sort highest MMR
    return lb.slice(0, 50);
    
  } catch (e) {
    Logger.log("Leaderboard Error: " + e.toString());
    return []; // Failsafe return so it doesn't hang
  }
}

function adminWipePokemonData() {
  const ss = getSpreadsheet_();
  
  // 1. Wipe Pokemon Saves from Wallets (Keep Points/Tickets safe)
  const walletSheet = ss.getSheetByName("Wallets");
  if (walletSheet) {
    const headers = walletSheet.getRange(1, 1, 1, walletSheet.getLastColumn()).getValues()[0];
    const pokeCol = headers.indexOf('pokemonData') + 1;
    if (pokeCol > 0 && walletSheet.getLastRow() > 1) {
      walletSheet.getRange(2, pokeCol, walletSheet.getLastRow() - 1, 1).clearContent();
    }
  }
  
  // 2. HARD DELETE all rows in the PvP Leaderboard (except the Header row)
  const lbSheet = ss.getSheetByName("Leaderboard");
  if (lbSheet) {
    // Erase Row 2 but keep it alive so Google Sheets doesn't crash
    if (lbSheet.getMaxRows() >= 2) {
      lbSheet.getRange(2, 1, 1, lbSheet.getMaxColumns()).clearContent();
    }
    
    // Hard-delete absolutely everything from Row 3 to the bottom
    if (lbSheet.getMaxRows() > 2) {
      lbSheet.deleteRows(3, lbSheet.getMaxRows() - 2);
    }
  }
}

function adminNuclearWipeArcade() {
  const ss = getSpreadsheet_();

  // 1. WIPE WALLETS (Keep LDAPs and Tickets. Reset Points, XP, and Pokémon Saves)
  const walletSheet = ss.getSheetByName("Wallets");
  if (walletSheet && walletSheet.getLastRow() > 1) {
    const numRows = walletSheet.getLastRow() - 1;
    const headers = walletSheet.getRange(1, 1, 1, walletSheet.getLastColumn()).getValues()[0];

    // Reset Unspent (Col 3), Lifetime (Col 4), and XP (Col 5) to 0
    // We use batch arrays here so it processes instantly without timing out
    const zeroes = new Array(numRows).fill([0, 0, 0]);
    walletSheet.getRange(2, 3, numRows, 3).setValues(zeroes);

    // Clear DailyPlayData (Col 8)
    const blanks = new Array(numRows).fill([""]);
    walletSheet.getRange(2, 8, numRows, 1).setValues(blanks);

    // Clear Pokémon Saves safely
    const pokeCol = headers.indexOf('pokemonData') + 1;
    if (pokeCol > 0) {
      walletSheet.getRange(2, pokeCol, numRows, 1).clearContent();
    }
  }

  // 2. HARD DELETE ALL LOGS & LEADERBOARDS
  const sheetsToWipe = [
    "GameHistory", "PersonalBests", "Leaderboard", "Marketplace", 
    "CasinoLogs", "StoreLogs", "Achievements", "Shadowbans"
  ];

  sheetsToWipe.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      // 1. Erase Row 2 but keep it alive so Google Sheets doesn't crash
      if (sheet.getMaxRows() >= 2) {
        sheet.getRange(2, 1, 1, sheet.getMaxColumns()).clearContent();
      }
      
      // 2. Hard-delete absolutely everything from Row 3 to the bottom!
      if (sheet.getMaxRows() > 2) {
        sheet.deleteRows(3, sheet.getMaxRows() - 2);
      }
    }
  });

  // 3. RESET THE CASINO JACKPOT
  PropertiesService.getScriptProperties().setProperty('CASINO_JACKPOT', '500000');
}
