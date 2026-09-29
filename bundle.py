import re
import os

def resolve_path(path):
    """Case-insensitive file path resolver supporting nested directories."""
    if os.path.exists(path) and os.path.isfile(path):
        return path
    parts = os.path.normpath(path).split(os.sep)
    current = '.'
    for part in parts:
        if not os.path.isdir(current):
            return None
        found = False
        try:
            for entry in os.listdir(current):
                if entry.lower() == part.lower():
                    current = os.path.join(current, entry)
                    found = True
                    break
        except Exception:
            return None
        if not found:
            return None
    if os.path.isfile(current):
        return current
    return None

def include_file(match):
    filename = match.group(1)
    # Common extensions to try for GAS includes
    for ext in ['', '.js.html', '.html', '.css.html']:
        candidate = filename + ext
        resolved = resolve_path(candidate)
        if resolved:
            with open(resolved, 'r', encoding='utf-8') as f:
                content = f.read()

            resolved_lower = resolved.lower()

            # Extension-based script wrapping for JavaScript files
            is_js = (
                resolved_lower.endswith('.js.html') or
                resolved_lower.endswith('.js') or
                resolved_lower.endswith('javascript.html')
            )

            # Style wrapping for CSS files
            is_css = (
                resolved_lower.endswith('stylesheet.html') or
                resolved_lower.endswith('.css.html') or
                resolved_lower.endswith('.css')
            )

            if is_js and not is_css and not content.strip().startswith('<script'):
                return f'<script>\n{content}\n</script>'
            elif is_css and not content.strip().startswith('<style'):
                return f'<style>\n{content}\n</style>'
            return content

    return f"<!-- File not found: {filename} -->"

with open('Index.html', 'r', encoding='utf-8') as f:
    index_content = f.read()

bundled_content = re.sub(r'<\?!= include\(\'(.+?)\'\); \?>', include_file, index_content)

# Mock google.script.run for local Playwright verification
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
              getLiveJackpotWithVersion: function() { callback({amount: 500000, version: 'v2.0.15'}); },
              getSessionInfo: function() { callback({ldap: 'jules', email: 'jules@example.com'}); },
              getAllPersonalBests: function() { callback({}); },
              getGlobalRankings: function() { callback([]); },
              startGame: function() { callback({success: true, token: 'mock-token'}); },
              getProfileStats: function() { callback({ldap: 'jules', xp: 50000, bests: {}, achievements: [], totalScore: 100000, gamesPlayed: 5, gameCounts: {}}); },
              saveScore: function() { callback({success: true}); }
            };
          },
          getWalletBalance: function() { callback({tickets: 10, unspent: 1000000, xp: 50000, perfMult: 1.0}); },
          getLiveJackpotWithVersion: function() { callback({amount: 500000, version: 'v2.0.15'}); },
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

with open('bundled.html', 'w', encoding='utf-8') as f:
    f.write(bundled_content)
