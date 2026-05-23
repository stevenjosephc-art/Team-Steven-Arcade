import re
import os

def final_cleanup():
    with open('javascript.html', 'r') as f:
        content = f.read()

    retired_games = [
        'Retro Snake', 'Solitaire', 'Hang Man', 'Sector 4: Containment',
        'Cyber Jump', 'Memory Flip', 'Burger Boss', 'Sudoku'
    ]

    # 1. Clean HOW_TO
    for game in retired_games:
        content = re.sub(rf"^\s*'{re.escape(game)}':\s*'.*?'(,\s*|\s*)$", "", content, flags=re.MULTILINE | re.DOTALL)
        # Try another one for single line
        content = re.sub(rf"^\s*'{re.escape(game)}':\s*'.*?'.*?\n", "", content, flags=re.MULTILINE)

    # 2. Clean Categories
    categories = ['ARCADE', 'BRAIN', 'CARD']
    for cat in categories:
        pattern = re.compile(rf"(var {cat}\s*=\s*\[)(.*?)(\];)")
        def sub_cat(m):
            prefix, items_str, suffix = m.groups()
            items = [i.strip().strip("'").strip('"') for i in items_str.split(',')]
            new_items = [i for i in items if i not in retired_games and i]
            if cat == 'BRAIN' and 'Block Blast' not in new_items:
                new_items.append('Block Blast')
            return f"{prefix}" + ", ".join([f"'{i}'" for i in new_items]) + f"{suffix}"
        content = pattern.sub(sub_cat, content)

    # 3. Clean CURRENT_SEASON.featured
    content = re.sub(r"(featured:\s*\[)(.*?)(\])",
                     lambda m: m.group(1) + ", ".join([i for i in m.group(2).split(',') if not any(g in i for g in retired_games)]) + m.group(3),
                     content)

    # 4. Clean Games object logic blocks
    # This is the most important part. We look for 'Game Name': { ... }
    # Since we know some are still there, let's use a very specific approach.
    for game in retired_games:
        # Match from the game name line until the next game name or a major section break
        # But games end with '  },' usually.
        # Let's look for the specific starting line and find the matching '  },'
        start_marker = f"  '{game}':"
        if start_marker in content:
            # We'll use a simple brace counter for better accuracy if needed,
            # but usually regex for '  },' works if we don't have nested ones at the same level.
            # Actually, let's just find the first '  },' after the start marker that is followed by a newline.
            pattern = re.compile(rf"\n\s*'{re.escape(game)}':\s*\{{.*? \n  \}},", re.DOTALL)
            content = pattern.sub('\n', content)
            # Variations
            content = re.sub(rf"\n\s*'{re.escape(game)}':\{{.*? \n  \}},", '\n', content, flags=re.DOTALL)

    # 5. Clean openAppSheet
    # Remove the 'else if (name === 'Hang Man') { ... }' block
    content = re.sub(r"else if \(name === 'Hang Man'\) \{.*?\}", "", content, flags=re.DOTALL)

    # 6. Clean badges and badgeClass
    for game in retired_games:
        content = content.replace(f"'{game}':'🔥 Hot', ", "")
        content = content.replace(f"'{game}':'hot', ", "")

    # 7. Clean GAME_BG
    content = content.replace("'Burger Boss': '#FF8A80'", "")

    # 8. Add Block Blast (if not already there)
    if "'Block Blast': {" not in content:
        block_blast_code = """
  'Block Blast': {
    cat: 'Puzzle', engine: 'canvas', icon: '🧱', dev: 'Logic Labs', rating: 4.9, installs: 'NEW',
    gridSize: 8, cellSize: 45, margin: 50,
    init: function() {
      canvas.width = 700; canvas.height = 480;
      rawScore = 0; this.grid = Array(8).fill().map(() => Array(8).fill(0));
      this.pieces = []; this.generatePieces();
      this.dragIdx = -1; this.mx = 0; this.my = 0;
      this.combo = 0; this.over = false;
      this.inputSetup();
    },
    inputSetup: function() {
        var self = this;
        this.mm = e => {
            var r = canvas.getBoundingClientRect();
            self.mx = (e.clientX - r.left) * (canvas.width/r.width);
            self.my = (e.clientY - r.top) * (canvas.height/r.height);
        };
        this.md = e => {
            if(self.over) return;
            for(var i=0; i<self.pieces.length; i++) {
                var p = self.pieces[i];
                if(!p) continue;
                var px = 180 + i*160, py = 410;
                if(self.mx > px-60 && self.mx < px+60 && self.my > py-60 && self.my < py+60) {
                    self.dragIdx = i; self.dragOffX = self.mx - px; self.dragOffY = self.my - py;
                    playSound('jump'); break;
                }
            }
        };
        this.mu = e => {
            if(self.dragIdx === -1) return;
            var p = self.pieces[self.dragIdx];
            var sw = p.shape[0].length * this.cellSize;
            var shh = p.shape.length * this.cellSize;
            var gx = Math.round((self.mx - self.dragOffX - sw/2 - self.margin) / self.cellSize);
            var gy = Math.round((self.my - self.dragOffY - shh/2 - self.margin) / self.cellSize);
            if(self.canPlace(p.shape, gx, gy)) {
                self.place(p.shape, gx, gy, p.color);
                self.pieces[self.dragIdx] = null;
                if(self.pieces.every(x => x === null)) self.generatePieces();
                self.checkLines();
                playSound('coin');
                if(self.isDead()) { self.over = true; setTimeout(() => triggerGameOver('No more moves! Final Score: ' + score), 800); }
            } else { playSound('crash'); }
            self.dragIdx = -1;
        };
        canvas.addEventListener('mousemove', this.mm);
        canvas.addEventListener('mousedown', this.md);
        window.addEventListener('mouseup', this.mu);
        this.monitor = setInterval(() => {
            if (activeGameTitle !== 'Block Blast') {
               canvas.removeEventListener('mousemove', self.mm);
               canvas.removeEventListener('mousedown', self.md);
               window.removeEventListener('mouseup', self.mu);
               clearInterval(self.monitor); self.monitor = null;
            }
        }, 500);
    },
    shapes: [
        [[1]], [[1,1]], [[1],[1]], [[1,1,1]], [[1],[1],[1]], [[1,1],[1,1]],
        [[1,1,1],[0,1,0]], [[1,1,1],[1,0,0]], [[1,1,1],[0,0,1]], [[1,1],[1,0]], [[1,1],[0,1]],
        [[1,1,1,1]], [[1],[1],[1],[1]], [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]]
    ],
    colors: ['#FF3B30', '#34C759', '#007AFF', '#FFD700', '#AF52DE', '#FF9500', '#5AC8FA'],
    generatePieces: function() {
        for(var i=0; i<3; i++) {
            var s = this.shapes[Math.floor(Math.random()*this.shapes.length)];
            var c = this.colors[Math.floor(Math.random()*this.colors.length)];
            this.pieces[i] = { shape: s, color: c };
        }
    },
    canPlace: function(sh, x, y) {
        for(var r=0; r<sh.length; r++) {
            for(var c=0; c<sh[r].length; c++) {
                if(sh[r][c]) {
                    var nx = x + c, ny = y + r;
                    if(nx < 0 || nx >= 8 || ny < 0 || ny >= 8 || this.grid[ny][nx]) return false;
                }
            }
        }
        return true;
    },
    place: function(sh, x, y, col) {
        for(var r=0; r<sh.length; r++) {
            for(var c=0; c<sh[r].length; c++) {
                if(sh[r][c]) { this.grid[y+r][x+c] = col; rawScore += 10; }
            }
        }
    },
    checkLines: function() {
        var rows = [], cols = [];
        for(var i=0; i<8; i++) {
            if(this.grid[i].every(x => x !== 0)) rows.push(i);
            var fullCol = true;
            for(var j=0; j<8; j++) if(this.grid[j][i] === 0) fullCol = false;
            if(fullCol) cols.push(i);
        }
        rows.forEach(r => this.grid[r] = Array(8).fill(0));
        cols.forEach(c => { for(var i=0; i<8; i++) this.grid[i][c] = 0; });
        var total = rows.length + cols.length;
        if(total > 0) {
            this.combo++;
            rawScore += total * 100 * this.combo;
            playSound('win');
            if(this.combo > 1) showToast('Combo x' + this.combo + '!');
        } else { this.combo = 0; }
    },
    isDead: function() {
        return this.pieces.every(p => {
            if(!p) return true;
            for(var y=0; y<8; y++) {
                for(var x=0; x<8; x++) {
                    if(this.canPlace(p.shape, x, y)) return false;
                }
            }
            return true;
        });
    },
    draw: function() {
        ctx.fillStyle = '#0a0e17'; ctx.fillRect(0,0,700,480);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(this.margin, this.margin, 8*this.cellSize, 8*this.cellSize);
        for(var y=0; y<8; y++) {
            for(var x=0; x<8; x++) {
                var bx = this.margin + x*this.cellSize, by = this.margin + y*this.cellSize;
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.strokeRect(bx, by, this.cellSize, this.cellSize);
                if(this.grid[y][x]) { this.drawBlock(bx, by, this.grid[y][x]); }
            }
        }
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 24px "Google Sans"'; ctx.textAlign = 'right';
        ctx.fillText('SCORE: ' + score, 660, 60);
        if(this.combo > 0) {
            ctx.fillStyle = '#00E5FF'; ctx.font = 'bold 18px "Google Sans"';
            ctx.fillText('COMBO x' + this.combo, 660, 90);
        }
        for(var i=0; i<3; i++) {
            if(this.dragIdx === i) continue;
            var p = this.pieces[i];
            if(!p) continue;
            this.drawPiece(180 + i*160, 410, p.shape, p.color, 0.6);
        }
        if(this.dragIdx !== -1) {
            var p = this.pieces[this.dragIdx];
            this.drawPiece(this.mx - this.dragOffX, this.my - this.dragOffY, p.shape, p.color, 1.0);
        }
    },
    drawBlock: function(x, y, col, scale=1) {
        var s = this.cellSize * scale;
        ctx.fillStyle = col;
        ctx.shadowBlur = 15; ctx.shadowColor = col;
        if(ctx.roundRect) {
            ctx.beginPath(); ctx.roundRect(x+2, y+2, s-4, s-4, 6); ctx.fill();
        } else {
            ctx.fillRect(x+2, y+2, s-4, s-4);
        }
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x+5, y+5, s/3, s/3);
    },
    drawPiece: function(cx, cy, sh, col, scale) {
        var sw = sh[0].length * this.cellSize * scale;
        var shh = sh.length * this.cellSize * scale;
        var startX = cx - sw/2, startY = cy - shh/2;
        for(var r=0; r<sh.length; r++) {
            for(var c=0; c<sh[r].length; c++) {
                if(sh[r][c]) {
                    this.drawBlock(startX + c*this.cellSize*scale, startY + r*this.cellSize*scale, col, scale);
                }
            }
        }
    }
  },
"""
        content = content.replace("var Games={", "var Games={" + block_blast_code)

    # 9. Add to HOW_TO (if not already there)
    if "'Block Blast':" not in content:
        content = content.replace("var HOW_TO={", "var HOW_TO={\n  'Block Blast': 'Drag and drop pieces onto the 8x8 grid.\\nComplete rows or columns to clear them and score!\\nClear multiple lines for COMBO multipliers!',")

    # 10. Final Cleanup of empty lines
    content = re.sub(r'\n\s*\n', '\n', content)

    with open('javascript.html', 'w') as f:
        f.write(content)

if __name__ == "__main__":
    final_cleanup()
