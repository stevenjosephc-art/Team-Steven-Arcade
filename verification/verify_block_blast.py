from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    path = os.path.abspath("bundled.html")
    page.goto(f"file://{path}")
    page.wait_for_timeout(3000)

    # Search for Block Blast
    page.get_by_placeholder("Search games & apps").fill("Block Blast")
    page.wait_for_timeout(1000)

    # Click on Block Blast
    page.locator("button.app-card").get_by_text("Block Blast").first.click()
    page.wait_for_timeout(1000)

    # Click Casual to start
    page.get_by_role("button", name="🟢 Casual").click()
    page.wait_for_timeout(2000)

    # Take screenshot of the game
    page.screenshot(path="verification/screenshots/block_blast.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
