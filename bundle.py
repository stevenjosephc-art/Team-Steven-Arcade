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

with open('bundled.html', 'w') as f:
    f.write(bundled_content)
