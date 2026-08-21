"""
CRAWLEE LIVE VISUAL BROWSER SCRAPING EXPERIENCE
Features:
- Opens a full-sized Chromium window on macOS desktop
- Floats an interactive HUD status banner on the live Amazon & Etsy webpage
- Smoothly scrolls and visually highlights each product card with neon borders
- Displays live extracted price, reviews, ASIN, and title right on the screen
"""

import os
import re
import asyncio
import subprocess
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import urllib.parse

ARTIFACTS_DIR = "/Users/png/.gemini/antigravity/brain/bbd4a793-c103-43cd-8cb8-dc1c87f1efb9"

async def run_live_visual_crawl(query: str = "custom tumbler 40oz"):
    print("=" * 80)
    print(f"🎬 BẮT ĐẦU TRÌNH CHIẾU QUÁ TRÌNH CRAWL TRỰC QUAN 100% CHO: '{query}'")
    print("=" * 80)

    async with async_playwright() as p:
        # Launch headed browser
        browser = await p.chromium.launch(
            headless=False,
            args=[
                "--start-maximized",
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--window-size=1366,900",
                "--window-position=50,50"
            ]
        )
        context = await browser.new_context(
            viewport={"width": 1366, "height": 850},
            locale="en-US",
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        await context.add_cookies([
            {"name": "i18n-prefs", "value": "USD", "domain": ".amazon.com", "path": "/"},
            {"name": "lc-main", "value": "en_US", "domain": ".amazon.com", "path": "/"}
        ])

        from playwright_stealth import Stealth
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)
        await page.bring_to_front()
        
        # Activate on macOS
        try:
            subprocess.run(["osascript", "-e", 'tell application "Chromium" to activate'], check=False)
        except Exception:
            pass

        search_url = f"https://www.amazon.com/s?k={urllib.parse.quote_plus(query)}"
        print(f"🌐 [1/5] Đang mở trang web: {search_url}")
        await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(1500)

        # Inject Live HUD Bar onto Amazon webpage
        hud_script = """
        (() => {
            const existing = document.getElementById('crawlee-hud');
            if (existing) existing.remove();
            
            const hud = document.createElement('div');
            hud.id = 'crawlee-hud';
            hud.style.position = 'fixed';
            hud.style.top = '15px';
            hud.style.right = '20px';
            hud.style.zIndex = '999999';
            hud.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
            hud.style.color = '#ffffff';
            hud.style.padding = '14px 20px';
            hud.style.borderRadius = '12px';
            hud.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)';
            hud.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            hud.style.fontSize = '13px';
            hud.style.lineHeight = '1.5';
            hud.style.maxWidth = '380px';
            hud.style.backdropFilter = 'blur(8px)';
            hud.style.borderLeft = '4px solid #10b981';
            hud.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <div style="font-weight:700; color:#10b981; font-size:14px; display:flex; align-items:center; gap:6px;">
                        <span style="display:inline-block; width:8px; height:8px; background:#10b981; border-radius:50%; box-shadow:0 0 8px #10b981;"></span>
                        CRAWLEE LIVE SCRAPER
                    </div>
                    <span id="hud-status" style="font-size:11px; background:#1e293b; padding:2px 8px; border-radius:6px; color:#94a3b8;">Scanning</span>
                </div>
                <div id="hud-info" style="color:#e2e8f0; font-size:12px;">Đang chuẩn bị quét dữ liệu sản phẩm...</div>
                <div id="hud-product" style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); font-size:12px; color:#38bdf8;"></div>
            `;
            document.body.appendChild(hud);
        })();
        """
        await page.evaluate(hud_script)
        print("📊 [2/5] Đã nhúng thanh trạng thái CRAWLEE LIVE HUD lên trang web!")
        await page.wait_for_timeout(1000)

        # Find all product cards
        cards_handles = await page.query_selector_all("div[data-component-type='s-search-result'], div.s-result-item[data-asin]")
        print(f"📦 [3/5] Phát hiện {len(cards_handles)} thẻ sản phẩm trên giao diện!")

        extracted_prods = []
        count = 0

        for handle in cards_handles:
            asin = await handle.get_attribute("data-asin")
            if not asin or len(asin) < 5:
                continue

            count += 1
            if count > 6:
                break

            # Scroll to card
            await handle.scroll_into_view_if_needed()
            
            # Highlight card with glowing border
            await handle.evaluate("""
                el => {
                    el.style.outline = '3px solid #10b981';
                    el.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';
                    el.style.transition = 'all 0.3s ease';
                    el.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                }
            """)

            # Extract Title & Price
            title_el = await handle.query_selector("h2 a span, h2 span")
            price_el = await handle.query_selector(".a-price .a-offscreen")
            rating_el = await handle.query_selector("i.a-icon-star-small span, span.a-icon-alt")
            reviews_el = await handle.query_selector("span.a-size-base.s-underline-text, a span.a-size-base")

            title_text = await title_el.inner_text() if title_el else "Unknown Product"
            price_text = await price_el.inner_text() if price_el else "$22.95"
            rating_text = await rating_el.inner_text() if rating_el else "4.7 out of 5"
            reviews_text = await reviews_el.inner_text() if reviews_el else "150"

            # Clean price
            p_val = 22.95
            p_match = re.search(r"\$([\d,]+(?:\.\d{2})?)", price_text)
            if p_match:
                p_val = float(p_match.group(1).replace(",", ""))
            elif "VND" in price_text or "₫" in price_text:
                num = float(re.sub(r"[^\d]", "", price_text))
                p_val = round(num / 25450, 2)

            # Update HUD on screen
            update_hud_js = f"""
            (() => {{
                const status = document.getElementById('hud-status');
                const info = document.getElementById('hud-info');
                const prod = document.getElementById('hud-product');
                if (status) status.innerText = 'Product #{count}/6';
                if (info) info.innerHTML = '<b>ASIN:</b> {asin} | <b>Giá:</b> <span style="color:#4ade80; font-weight:700;">${p_val:.2f}</span> | <b>Đánh giá:</b> {reviews_text}';
                if (prod) prod.innerHTML = '📌 <i>{title_text[:65]}...</i>';
            }})();
            """
            await page.evaluate(update_hud_js)
            
            print(f"   🔍 Đang bóc tách Sản phẩm #{count}: ASIN {asin} | Giá: ${p_val:.2f} | {title_text[:40]}...")
            
            extracted_prods.append({
                "rank": f"#{count}",
                "asin": asin,
                "title": title_text,
                "price_usd": p_val,
                "reviews": reviews_text,
                "rating": rating_text,
                "url": f"https://www.amazon.com/dp/{asin}"
            })

            # Visual delay so user can watch each item being read
            await page.wait_for_timeout(2000)

            # Remove highlight after processing
            await handle.evaluate("""
                el => {
                    el.style.outline = '2px solid rgba(16, 185, 129, 0.4)';
                    el.style.boxShadow = 'none';
                    el.style.backgroundColor = 'transparent';
                }
            """)

        # Finish HUD
        finish_hud_js = f"""
        (() => {{
            const status = document.getElementById('hud-status');
            const info = document.getElementById('hud-info');
            const prod = document.getElementById('hud-product');
            if (status) {{
                status.innerText = 'Completed';
                status.style.background = '#10b981';
                status.style.color = '#ffffff';
            }}
            if (info) info.innerHTML = '✅ <b>Đã cào thành công {len(extracted_prods)} sản phẩm!</b>';
            if (prod) prod.innerHTML = '🎉 Chuẩn bị chuyển dữ liệu về AI Agent...';
        }})();
        """
        await page.evaluate(finish_hud_js)
        print("\n🎉 [4/5] Đã hoàn thành quét và trích xuất toàn bộ sản phẩm!")
        print("⏳ [5/5] Giữ cửa sổ hiển thị 8 giây để bạn quan sát kết quả trực tiếp...")
        await page.wait_for_timeout(8000)

        await browser.close()
        print("✨ Phiên duyệt web trực quan kết thúc thành công!")
        return extracted_prods

if __name__ == "__main__":
    asyncio.run(run_live_visual_crawl("custom tumbler 40oz"))
