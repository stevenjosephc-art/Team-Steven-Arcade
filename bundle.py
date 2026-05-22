import re
import os

def include_file(match):
    filename = match.group(1)
    # Match filenames case-insensitively or with common extensions
    for ext in ['', '.html', '.js.html']:
        path = filename + ext
        if os.path.exists(path):
            with open(path, 'r') as f:
                content = f.read()
                if path.endswith('.js.html') or path.lower() == 'javascript.html':
                    if not content.strip().startswith('<script'):
                        return f'<script>\n{content}\n</script>'
                if path.lower() == 'stylesheet.html':
                     if not content.strip().startswith('<style'):
                        return f'<style>\n{content}\n</style>'
                return content

        # Try lowercase
        path = filename.lower() + ext
        if os.path.exists(path):
             with open(path, 'r') as f:
                content = f.read()
                if path.endswith('.js.html') or path.lower() == 'javascript.html':
                    if not content.strip().startswith('<script'):
                        return f'<script>\n{content}\n</script>'
                if path.lower() == 'stylesheet.html':
                     if not content.strip().startswith('<style'):
                        return f'<style>\n{content}\n</style>'
                return content

    return f"<!-- File not found: {filename} -->"

with open('Index.html', 'r') as f:
    index_content = f.read()

bundled_content = re.sub(r'<\?!= include\(\'(.+?)\'\); \?>', include_file, index_content)

# Mock google.script.run
mock_script = """
<script>
window.google = {
  script: {
    run: {
      withSuccessHandler: function(callback) {
        return {
          withFailureHandler: function() {
            return {
              getWalletBalance: function() { callback({tickets: 10, unspent: 1000000, xp: 50000, perfMult: 1.0}); },
              getLiveJackpotWithVersion: function() { callback({amount: 500000, version: 'v2.0.14'}); },
              getSessionInfo: function() { callback({ldap: 'jules', email: 'jules@example.com'}); },
              getAllPersonalBests: function() { callback({}); },
              getGlobalRankings: function() { callback([]); },
              startGame: function() { callback({success: true, token: 'mock-token'}); },
              getProfileStats: function() { callback({ldap: 'jules', xp: 50000, bests: {}, achievements: [], totalScore: 100000, gamesPlayed: 5, gameCounts: {}}); },
              saveScore: function() { callback({success: true}); }
            };
          },
          getWalletBalance: function() { callback({tickets: 10, unspent: 1000000, xp: 50000, perfMult: 1.0}); },
          getLiveJackpotWithVersion: function() { callback({amount: 500000, version: 'v2.0.14'}); },
          getSessionInfo: function() { callback({ldap: 'jules', email: 'jules@example.com'}); },
          getAllPersonalBests: function() { callback({}); },
          getGlobalRankings: function() { callback([]); },
          startGame: function() { callback({success: true, token: 'mock-token'}); },
          getProfileStats: function() { callback({ldap: 'jules', xp: 50000, bests: {}, achievements: [], totalScore: 100000, gamesPlayed: 5, gameCounts: {}}); },
          saveScore: function() { callback({success: true}); }
        };
      }
    }
  }
};
</script>
"""

bundled_content = bundled_content.replace('</head>', mock_script + '</head>')

with open('bundled.html', 'w') as f:
    f.write(bundled_content)
