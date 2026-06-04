  'Battleship Command': {
    cat: 'Puzzle', engine: 'dom', icon: '🚢', dev: 'Naval Labs', rating: 4.8, installs: '500K',
    gridSize: 12,
    shipTypes: [
      { name: 'Carrier', size: 5, icon: '🛳️' },
      { name: 'Battleship', size: 4, icon: '🚢' },
      { name: 'Stealth Frigate', size: 3, icon: '🛥️' },
      { name: 'Submarine', size: 3, icon: '🚤' },
      { name: 'Destroyer', size: 3, icon: '⛴️' },
      { name: 'Patrol Boat', size: 2, icon: '🛶' }
    ],
    init: function() {
      rawScore = 0;
      this.state = 'deploying'; // 'deploying', 'playing', 'over'
      this.turn = 'player';
      this.playerGrid = Array(12 * 12).fill(0); // 0: empty, 1: ship, 2: miss, 3: hit
      this.aiGrid = Array(12 * 12).fill(0);
      this.playerShips = [];
      this.aiShips = [];
      this.energy = 0;
      this.selectedAbility = null;
      this.abilities = [
        { id: 'radar', name: 'Radar Scan', cost: 30, desc: 'Reveals 3x3 area', icon: '📡' },
        { id: 'sonar', name: 'Sonar Ping', cost: 20, desc: 'Pings 5x5 for ships', icon: '🔊' },
        { id: 'barrage', name: 'Barrage', cost: 50, desc: '5 random shots', icon: '🚀' }
      ];
      this.aiMemory = { hunt: [], mode: 'random' };
      this.setupBoard();
    },
    setupBoard: function() {
      var self = this;
      domEngine.innerHTML = `
        <div id="bs-container" style="display:flex; flex-direction:column; align-items:center; gap:20px; width:100%; max-width:1000px; color:#fff; font-family:Google Sans;">
          <div id="bs-status" style="padding:15px 30px; background:rgba(255,255,255,0.05); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); border-radius:15px; font-size:18px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#00E5FF; box-shadow:0 0 20px rgba(0,229,255,0.2);">
            Deploy your Fleet
          </div>

          <div style="display:flex; gap:40px; flex-wrap:wrap; justify-content:center; width:100%;">
            <div style="text-align:center;">
              <div style="margin-bottom:10px; font-size:12px; font-weight:bold; opacity:0.7;">YOUR WATERS</div>
              <div id="player-grid" style="display:grid; grid-template-columns:repeat(12, 30px); grid-template-rows:repeat(12, 30px); gap:2px; background:rgba(0,229,255,0.1); padding:5px; border-radius:8px; border:2px solid rgba(0,229,255,0.3);"></div>
            </div>
            <div style="text-align:center;">
              <div style="margin-bottom:10px; font-size:12px; font-weight:bold; opacity:0.7;">ENEMY WATERS</div>
              <div id="ai-grid" style="display:grid; grid-template-columns:repeat(12, 30px); grid-template-rows:repeat(12, 30px); gap:2px; background:rgba(255,59,48,0.1); padding:5px; border-radius:8px; border:2px solid rgba(255,59,48,0.3);"></div>
            </div>
          </div>

          <div id="bs-controls" style="display:flex; gap:15px; flex-wrap:wrap; justify-content:center;">
            <button id="btn-auto-deploy" class="vip-btn" style="width:auto; padding:10px 25px;">Auto Deploy</button>
            <button id="btn-start-battle" class="vip-btn" style="width:auto; padding:10px 25px; display:none; background:linear-gradient(90deg, #34C759, #30D158);">Start Battle</button>
          </div>

          <div id="bs-abilities" style="display:none; gap:15px; justify-content:center; width:100%;">
            <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); padding:10px 20px; border-radius:12px; border:1px solid rgba(255,215,0,0.3); margin-right:10px;">
              <span style="font-size:20px; margin-right:10px;">⚡</span>
              <span id="bs-energy" style="font-size:20px; font-weight:bold; color:#FFD700;">0</span>
            </div>
            ${this.abilities.map(a => `
              <button id="ability-${a.id}" class="app-card" style="width:100px; padding:10px; align-items:center; opacity:0.5; cursor:not-allowed;" title="${a.desc}">
                <div style="font-size:24px;">${a.icon}</div>
                <div style="font-size:10px; font-weight:bold; margin-top:5px;">${a.name}</div>
                <div style="font-size:9px; color:#FFD700;">${a.cost} NRG</div>
              </button>
            `).join('')}
          </div>

          <div id="bs-log" style="width:100%; max-width:600px; height:80px; overflow-y:auto; background:rgba(0,0,0,0.4); border-radius:10px; padding:10px; font-size:13px; border:1px solid rgba(255,255,255,0.05); color:#A0AAB2; line-height:1.4;">
            <div>Welcome, Commander. Deploy your fleet to begin.</div>
          </div>
        </div>
      `;

      this.renderGrids();

      document.getElementById('btn-auto-deploy').onclick = () => {
        self.autoDeploy('player');
        self.renderGrids();
        document.getElementById('btn-start-battle').style.display = 'block';
        playSound('coin');
      };

      document.getElementById('btn-start-battle').onclick = () => {
        self.state = 'playing';
        self.autoDeploy('ai');
        document.getElementById('bs-status').textContent = 'Battle Stations!';
        document.getElementById('bs-controls').style.display = 'none';
        document.getElementById('bs-abilities').style.display = 'flex';
        document.getElementById('ai-grid').style.cursor = 'crosshair';
        self.log('Battle engaged! Fleet is ready.');
        playSound('win');
      };

      this.abilities.forEach(a => {
        document.getElementById(`ability-${a.id}`).onclick = () => {
          if (self.energy >= a.cost && self.state === 'playing' && self.turn === 'player') {
            self.selectedAbility = a.id;
            self.log(`Tactical ${a.name} selected. Targeted strike required.`);
            document.querySelectorAll('#bs-abilities .app-card').forEach(btn => btn.style.borderColor = 'var(--glass-border)');
            document.getElementById(`ability-${a.id}`).style.borderColor = '#FFD700';
            playSound('jump');
          }
        };
      });
    },
    renderGrids: function() {
      var self = this;
      var pGrid = document.getElementById('player-grid');
      var aGrid = document.getElementById('ai-grid');
      if (!pGrid || !aGrid) return;

      pGrid.innerHTML = '';
      aGrid.innerHTML = '';

      for (var i = 0; i < 144; i++) {
        var pCell = document.createElement('div');
        pCell.style.cssText = 'width:30px; height:30px; background:rgba(0,229,255,0.03); border:1px solid rgba(0,229,255,0.1); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:14px; box-shadow:inset 0 0 5px rgba(0,229,255,0.05); transition:all 0.3s;';
        if (this.playerGrid[i] === 1) {
          pCell.style.background = 'rgba(0,229,255,0.2)';
          pCell.style.borderColor = 'rgba(0,229,255,0.5)';
          pCell.style.boxShadow = 'inset 0 0 10px rgba(0,229,255,0.2)';
          var ship = this.playerShips.find(s => s.indices.includes(i));
          if (ship) {
             var type = this.shipTypes.find(t => t.name === ship.name);
             pCell.innerHTML = `<span style="opacity:0.5; font-size:12px;">${type.icon}</span>`;
          }
        }
        else if (this.playerGrid[i] === 2) pCell.innerHTML = '<span style="filter:drop-shadow(0 0 5px #00E5FF);">💧</span>';
        else if (this.playerGrid[i] === 3) {
          pCell.style.background = 'rgba(255,59,48,0.3)';
          pCell.innerHTML = '💥';
          pCell.style.boxShadow = '0 0 15px #FF3B30, inset 0 0 10px rgba(255,59,48,0.5)';
          pCell.style.borderColor = '#FF3B30';
        }
        pGrid.appendChild(pCell);

        var aCell = document.createElement('div');
        aCell.style.cssText = 'width:30px; height:30px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:14px; transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor:crosshair;';
        aCell.dataset.index = i;

        if (this.aiGrid[i] === 2) {
          aCell.innerHTML = '<span style="opacity:0.6;">💧</span>';
          aCell.style.background = 'rgba(0,0,0,0.1)';
        }
        else if (this.aiGrid[i] === 3) {
          aCell.style.background = 'rgba(255,59,48,0.3)';
          aCell.innerHTML = '💥';
          aCell.style.boxShadow = '0 0 15px #FF3B30, inset 0 0 10px rgba(255,59,48,0.5)';
          aCell.style.borderColor = '#FF3B30';
        }
        else if (this.aiGrid[i] === 4) {
          aCell.style.background = 'rgba(255,215,0,0.15)';
          aCell.innerHTML = '📡';
          aCell.style.boxShadow = 'inset 0 0 8px rgba(255,215,0,0.2)';
          aCell.style.borderColor = 'rgba(255,215,0,0.3)';
        }

        if (this.state === 'playing' && this.turn === 'player' && this.aiGrid[i] < 2) {
          aCell.onmouseenter = function() { this.style.background = 'rgba(255,255,255,0.1)'; this.style.transform = 'scale(1.1)'; this.style.zIndex = '10'; };
          aCell.onmouseleave = function() { this.style.background = 'rgba(255,255,255,0.02)'; this.style.transform = 'scale(1)'; this.style.zIndex = '1'; };
        }

        aCell.onclick = function() {
          var idx = parseInt(this.dataset.index);
          self.playerAction(idx);
        };
        aGrid.appendChild(aCell);
      }
      this.updateAbilityUI();
    },
    updateAbilityUI: function() {
      var self = this;
      var energyEl = document.getElementById('bs-energy');
      if (energyEl) energyEl.textContent = Math.floor(this.energy);

      this.abilities.forEach(a => {
        var btn = document.getElementById(`ability-${a.id}`);
        if (btn) {
          if (this.energy >= a.cost && this.turn === 'player') {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.filter = 'none';
            btn.style.boxShadow = '0 4px 15px rgba(255,215,0,0.1)';
          } else {
            btn.style.opacity = '0.4';
            btn.style.cursor = 'not-allowed';
            btn.style.filter = 'grayscale(1)';
            btn.style.boxShadow = 'none';
          }
        }
      });
    },
    autoDeploy: function(side) {
      var grid = side === 'player' ? this.playerGrid : this.aiGrid;
      var ships = [];
      grid.fill(0);

      this.shipTypes.forEach(type => {
        var placed = false;
        while (!placed) {
          var isVert = Math.random() > 0.5;
          var r = Math.floor(Math.random() * 12);
          var c = Math.floor(Math.random() * 12);

          if (this.canPlace(grid, r, c, type.size, isVert)) {
            var shipIndices = [];
            for (var i = 0; i < type.size; i++) {
              var idx = isVert ? (r + i) * 12 + c : r * 12 + (c + i);
              grid[idx] = 1;
              shipIndices.push(idx);
            }
            ships.push({ name: type.name, indices: shipIndices, hits: 0, sunk: false });
            placed = true;
          }
        }
      });

      if (side === 'player') this.playerShips = ships;
      else this.aiShips = ships;
    },
    canPlace: function(grid, r, c, size, isVert) {
      for (var i = 0; i < size; i++) {
        var currR = isVert ? r + i : r;
        var currC = isVert ? c : c + i;
        if (currR >= 12 || currC >= 12 || grid[currR * 12 + currC] !== 0) return false;
      }
      return true;
    },
    playerAction: function(idx) {
      if (this.state !== 'playing' || this.turn !== 'player') return;
      if (this.aiGrid[idx] === 2 || this.aiGrid[idx] === 3) return;

      if (this.selectedAbility) {
        this.useAbility(this.selectedAbility, idx);
        this.selectedAbility = null;
        document.querySelectorAll('#bs-abilities .app-card').forEach(btn => btn.style.borderColor = 'var(--glass-border)');
        return;
      }

      this.fire(idx, 'player');
    },
    fire: function(idx, side) {
      var targetGrid = side === 'player' ? this.aiGrid : this.playerGrid;
      var targetShips = side === 'player' ? this.aiShips : this.playerShips;
      var name = side === 'player' ? 'You' : 'Enemy';

      if (targetGrid[idx] === 1) {
        targetGrid[idx] = 3; // Hit
        var ship = targetShips.find(s => s.indices.includes(idx));
        ship.hits++;
        this.log(`${name} hit ${side === 'player' ? "enemy's" : "your"} ${ship.name}!`, side === 'player' ? '#FFD700' : '#FF3B30');
        playSound('crash');
        if (side === 'player') { this.energy += 15; rawScore += 100; }

        if (ship.hits === ship.indices.length) {
          ship.sunk = true;
          this.log(`Critical strike! ${name} sunk ${side === 'player' ? "enemy's" : "your"} ${ship.name}!`, '#00E5FF');
          playSound('win');
          if (side === 'player') { this.energy += 25; rawScore += 500; }
          if (targetShips.every(s => s.sunk)) {
            this.endGame(side === 'player');
            return;
          }
        }

        if (side === 'ai') {
          this.aiMemory.mode = 'target';
          this.aiMemory.hunt.push(...this.getNeighbors(idx));
        }
      } else {
        targetGrid[idx] = 2; // Miss
        this.log(`${name} fired: Miss.`, '#A0AAB2');
        playSound('jump');
      }

      this.renderGrids();
      if (side === 'player') {
        this.turn = 'ai';
        setTimeout(() => this.aiAction(), 800);
      } else {
        this.turn = 'player';
      }
    },
    useAbility: function(id, idx) {
      var ability = this.abilities.find(a => a.id === id);
      this.energy -= ability.cost;

      if (id === 'radar') {
        this.log(`Tactical Scan initiated at sector ${idx}.`);
        var r = Math.floor(idx / 12), c = idx % 12;
        for (var i = -1; i <= 1; i++) {
          for (var j = -1; j <= 1; j++) {
            var nr = r + i, nc = c + j;
            if (nr >= 0 && nr < 12 && nc >= 0 && nc < 12) {
              var nidx = nr * 12 + nc;
              if (this.aiGrid[nidx] === 1) { this.aiGrid[nidx] = 4; this.log('Enemy signature detected!', '#FFD700'); }
              else if (this.aiGrid[nidx] === 0) this.aiGrid[nidx] = 4;
            }
          }
        }
        playSound('coin');
      } else if (id === 'sonar') {
        var r = Math.floor(idx / 12), c = idx % 12;
        var found = false;
        for (var i = -2; i <= 2; i++) {
          for (var j = -2; j <= 2; j++) {
            var nr = r + i, nc = c + j;
            if (nr >= 0 && nr < 12 && nc >= 0 && nc < 12) {
              if (this.aiGrid[nr * 12 + nc] === 1) found = true;
            }
          }
        }
        this.log(`Sonar ${found ? 'ping returned positive signal!' : 'returned nothing but silence.'}`, found ? '#34C759' : '#A0AAB2');
        playSound('pb');
      } else if (id === 'barrage') {
        this.log('Commencing Artillery Barrage!');
        for (var i = 0; i < 5; i++) {
          setTimeout(() => {
            var target = Math.floor(Math.random() * 144);
            while (this.aiGrid[target] > 1) target = Math.floor(Math.random() * 144);
            this.fire(target, 'player');
          }, i * 200);
        }
      }
      this.renderGrids();
      this.turn = 'ai';
      setTimeout(() => this.aiAction(), 1500);
    },
    aiAction: function() {
      if (this.state !== 'playing') return;
      var idx;

      // HARD difficulty probability mapping logic (simple version: favor un-fired spots near ships)
      if (activeDiff === 'Hard' && Math.random() > 0.3 && this.aiMemory.mode === 'random') {
         // Cheat a bit: 30% chance to target a real ship location on Hard
         var hiddenShips = this.playerShips.find(s => !s.sunk);
         if (hiddenShips) {
           var potential = hiddenShips.indices.filter(i => this.playerGrid[i] === 1);
           if (potential.length > 0) idx = potential[Math.floor(Math.random() * potential.length)];
         }
      }

      if (this.aiMemory.mode === 'target' && this.aiMemory.hunt.length > 0) {
        idx = this.aiMemory.hunt.pop();
        if (this.playerGrid[idx] > 1) return this.aiAction();
      } else {
        this.aiMemory.mode = 'random';
        idx = Math.floor(Math.random() * 144);
        while (this.playerGrid[idx] > 1) idx = Math.floor(Math.random() * 144);
      }

      this.fire(idx, 'ai');
    },
    getNeighbors: function(idx) {
      var r = Math.floor(idx / 12), c = idx % 12;
      var n = [];
      if (r > 0) n.push((r - 1) * 12 + c);
      if (r < 11) n.push((r + 1) * 12 + c);
      if (c > 0) n.push(r * 12 + (c - 1));
      if (c < 11) n.push(r * 12 + (c + 1));
      return n.sort(() => Math.random() - 0.5);
    },
    log: function(msg, color) {
      var log = document.getElementById('bs-log');
      if (!log) return;
      var entry = document.createElement('div');
      if (color) entry.style.color = color;
      entry.innerHTML = `<span style="opacity:0.5; font-size:10px;">[${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span> ${msg}`;
      log.prepend(entry);
    },
    endGame: function(win) {
      this.state = 'over';
      var bonus = win ? 2000 : 0;
      rawScore += bonus;
      setTimeout(() => {
        triggerGameOver(win ? 'VICTORY! Enemy Fleet Decimated.' : 'DEFEAT. Your fleet has been sunk.');
      }, 1000);
    }
  },
  'Block Blast': {
