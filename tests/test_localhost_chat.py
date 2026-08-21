"""
TEST PROMPT ON LOCALHOST:3000 WITH HEADED BROWSER
Opens Chrome window on macOS desktop, submits prompt, streams full response, and displays UI.
"""

import os
import asyncio
import subprocess
from playwright.async_api import async_playwright

ARTIFACTS_DIR = "/Users/png/.gemini/antigravity/brain/bbd4a793-c103-43cd-8cb8-dc1c87f1efb9"

async def test_live_localhost_chat():
    print("=" * 80)
    print("🚀 ĐANG MỞ CỬA SỔ CHROME TRỰC TIẾP TRÊN LOCALHOST:3000 ĐỂ GỬI PROMPT...")
    print("=" * 80)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=[
                "--start-maximized",
                "--no-sandbox",
                "--window-size=1400,900",
                "--window-position=50,50"
            ]
        )
        context = await browser.new_context(viewport={"width": 1400, "height": 850})
        page = await context.new_page()
        
        # Bring to front on macOS
        await page.bring_to_front()
        try:
            subprocess.run(["osascript", "-e", 'tell application "Chromium" to activate'], check=False)
        except Exception:
            pass

        print("🌐 [1/5] Đang mở giao diện Printway Product Opportunity Hub tại http://localhost:3000...")
        await page.goto("http://localhost:3000", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Handle config modal if present
        save_cfg_btn = await page.query_selector("button:has-text('Lưu cấu hình')")
        if save_cfg_btn:
            print("⚙️ [2/5] Đang tự động nạp cấu hình LangGraph Server...")
            inputs = await page.query_selector_all("input")
            if len(inputs) >= 2:
                await inputs[0].fill("http://127.0.0.1:2024")
                await inputs[1].fill("product_opportunity_hub")
            await save_cfg_btn.click()
            await page.wait_for_timeout(2000)

        # Focus textarea
        ta = await page.wait_for_selector("textarea", timeout=10000)
        prompt_text = "Nghiên cứu xu hướng và phân tích top sản phẩm custom tumbler 40oz trên Amazon và Etsy"
        print(f"✍️ [3/5] Đang nhập prompt vào ô chat: \"{prompt_text}\"...")
        
        await ta.click()
        await ta.fill(prompt_text)
        await page.wait_for_timeout(1000)

        # Click Gửi button
        send_btn = await page.query_selector("button:has-text('Gửi')")
        if send_btn:
            print("🚀 [4/5] Đã nhấn nút 'Gửi' — AI Agent đang bắt đầu cào và phân tích...")
            await send_btn.click()
        else:
            await page.keyboard.press("Enter")

        print("⏳ [5/5] Đang theo dõi AI Agent stream dữ liệu, biểu đồ 5D và ma trận sản phẩm...")
        
        # Wait and scroll to follow stream
        for sec in range(1, 35):
            await page.wait_for_timeout(1000)
            if sec % 5 == 0:
                print(f"   ⏱️ Đang stream dữ liệu từ LangGraph... ({sec}s)")
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight);")

        # Capture final screenshot
        ss_path = os.path.join(ARTIFACTS_DIR, "localhost_prompt_result.png")
        await page.screenshot(path=ss_path, full_page=False)
        print(f"\n📸 Đã lưu ảnh chụp kết quả phân tích: {ss_path}")

        print("⏳ Giữ cửa sổ mở thêm 15 giây để bạn xem trực tiếp giao diện trên màn hình...")
        await page.wait_for_timeout(15000)

        await browser.close()
        print("✨ Phiên kiểm thử trên localhost:3000 hoàn tất thành công!")

if __name__ == "__main__":
    asyncio.run(test_live_localhost_chat())
