from playwright.sync_api import sync_playwright
import time

def test_homepage():
    with sync_playwright() as p:
        # Launching headless chromium
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("Navigating to homepage...")
        try:
            # Increase timeout for slow dev servers
            page.goto('http://localhost:3000', timeout=60000)
            page.wait_for_load_state('networkidle')
            
            # 1. Check title
            title = page.title()
            print(f"Page Title: {title}")
            
            # 2. Check for StreamEngine logo/text
            logo = page.locator('text=StreamEngine')
            if logo.is_visible():
                print("SUCCESS: StreamEngine branding found.")
            else:
                print("FAILURE: StreamEngine branding not found.")
                # Take screenshot for debugging if failed
                page.screenshot(path='c:/Users/karth/Desktop/Stream-engine/homepage_error.png')
            
            # 3. Check for "Live Now" badge (might be 0 if no rooms, but the element should exist)
            live_badge = page.locator('text=Live Now')
            print(f"Live badge visible: {live_badge.is_visible()}")
            
            # 4. Check for Start Streaming button
            start_btn = page.locator('text=Explore Streams')
            print(f"Explore Streams button visible: {start_btn.is_visible()}")

        except Exception as e:
            print(f"An error occurred: {e}")
            page.screenshot(path='c:/Users/karth/Desktop/Stream-engine/nav_error.png')
        finally:
            browser.close()

if __name__ == "__main__":
    test_homepage()
