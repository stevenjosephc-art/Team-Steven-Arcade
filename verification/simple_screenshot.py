from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    path = os.path.abspath("bundled.html")
    page.goto(f"file://{path}")
    page.wait_for_timeout(5000)
    page.screenshot(path="verification/screenshots/initial_home.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        try:
            run_cuj(page)
        finally:
            browser.close()
