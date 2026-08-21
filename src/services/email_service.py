"""
PRINTWAY NEXUS RESEND EMAIL DELIVERY SERVICE
Renders responsive executive HTML reports and delivers them via Resend API.
"""

import os
import logging
import requests
from typing import Dict, Any, Optional
from src.config import resend_config, RESEND_API_KEY, RESEND_FROM_EMAIL

logger = logging.getLogger("EmailService")


def generate_opportunity_email_html(opportunity_data: Dict[str, Any]) -> str:
    """
    Renders high-converting, responsive HTML email template for POD Opportunity Reports.
    """
    keyword = opportunity_data.get("keyword", "Sản phẩm POD Tiềm Năng")
    score = opportunity_data.get("opportunity_score", 85)
    rec = opportunity_data.get("recommendation", "RECOMMEND")
    rec_color = "#00FF88" if "RECOMMEND" in rec and "NOT" not in rec else "#F59E0B" if "CAUTION" in rec else "#EF4444"
    
    demand = opportunity_data.get("demand", "14,500/tháng")
    competition = opportunity_data.get("competition", "105 listings")
    growth = opportunity_data.get("growth", "+45% YoY")
    margin = opportunity_data.get("margin", "68% - 75%")
    price_range = opportunity_data.get("price_range", "$19.99 - $29.99")
    product_type = opportunity_data.get("product_type", "Mica Trong Suốt (Acrylic)")
    material = opportunity_data.get("material", "Mica Đài Loan 3mm & Gỗ Sồi")
    
    tags = opportunity_data.get("tags", [
        "custom acrylic plaque", "personalized night light", "kids bedroom decor",
        "custom keepsake gift", "baby nursery light", "engraved wood base",
        "personalized gift for kids", "acrylic led lamp", "custom birthday gift",
        "room night light", "led desk light", "custom name light", "printway pod gift"
    ])
    
    tags_html = "".join([f'<span style="display:inline-block;background:#0E1538;border:1px solid rgba(0,255,136,0.3);color:#00FF88;padding:4px 10px;margin:3px;border-radius:6px;font-size:12px;font-family:monospace;">{t}</span>' for t in tags[:13]])

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo Cáo Nghiên Cứu Cơ Hội POD - {keyword}</title>
</head>
<body style="margin:0;padding:0;background-color:#080B21;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#080B21;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#0B1033;border:1px solid rgba(0,255,136,0.25);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#0E1538 0%,#121A45 100%);border-bottom:1px solid rgba(0,255,136,0.2);text-align:left;">
              <table width="100%">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:900;letter-spacing:1px;color:#00FF88;">PRINTWAY<span style="color:#00D2FF;">.IO</span></span>
                    <div style="font-size:11px;color:#94A3B8;margin-top:2px;font-family:monospace;">NEXUS AI R&D STRATEGIST</div>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:rgba(0,255,136,0.15);border:1px solid {rec_color};color:{rec_color};font-weight:800;font-size:11px;padding:5px 12px;border-radius:20px;text-transform:uppercase;">
                      {rec}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Product Title & Scorecard -->
          <tr>
            <td style="padding:28px 32px 16px 32px;">
              <div style="font-size:12px;font-weight:700;color:#00D2FF;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">BÁO CÁO CƠ HỘI SẢN PHẨM MỚI</div>
              <h1 style="margin:0 0 20px 0;font-size:22px;font-weight:800;color:#FFFFFF;line-height:1.3;">{keyword}</h1>
              
              <!-- 4-KPI Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td width="48%" style="padding:14px;background:#080B21;border:1px solid rgba(0,255,136,0.2);border-radius:10px;vertical-align:top;">
                    <div style="font-size:11px;color:#94A3B8;font-weight:600;">OPPORTUNITY SCORE</div>
                    <div style="font-size:28px;font-weight:900;color:#00FF88;margin:4px 0;">{score}<span style="font-size:14px;color:#64748B;">/100</span></div>
                    <div style="font-size:10px;color:#94A3B8;">Xếp hạng tiềm năng R&D</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="padding:14px;background:#080B21;border:1px solid rgba(0,210,255,0.2);border-radius:10px;vertical-align:top;">
                    <div style="font-size:11px;color:#94A3B8;font-weight:600;">NHU CẦU TÌM KIẾM</div>
                    <div style="font-size:20px;font-weight:800;color:#00D2FF;margin:4px 0;">{demand}</div>
                    <div style="font-size:10px;color:#94A3B8;">Tăng trưởng: <b style="color:#00FF88;">{growth}</b></div>
                  </td>
                </tr>
                <tr><td height="12"></td></tr>
                <tr>
                  <td width="48%" style="padding:14px;background:#080B21;border:1px solid rgba(139,92,246,0.2);border-radius:10px;vertical-align:top;">
                    <div style="font-size:11px;color:#94A3B8;font-weight:600;">MỨC ĐỘ CẠNH TRANH</div>
                    <div style="font-size:18px;font-weight:800;color:#A78BFA;margin:4px 0;">{competition}</div>
                    <div style="font-size:10px;color:#94A3B8;">Mật độ listing trên Etsy/Amazon</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="padding:14px;background:#080B21;border:1px solid rgba(16,185,129,0.2);border-radius:10px;vertical-align:top;">
                    <div style="font-size:11px;color:#94A3B8;font-weight:600;">BIÊN LỢI NHUẬN XƯỞNG</div>
                    <div style="font-size:20px;font-weight:800;color:#34D399;margin:4px 0;">{margin}</div>
                    <div style="font-size:10px;color:#94A3B8;">Giá bán đề xuất: {price_range}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Factory Specs Section -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <div style="padding:18px;background:#0E1538;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                <div style="font-size:13px;font-weight:700;color:#FFFFFF;margin-bottom:12px;">🏭 NĂNG LỰC GIA CÔNG XƯỞNG PRINTWAY VIỆT NAM</div>
                <table width="100%" style="font-size:12px;color:#CBD5E1;">
                  <tr>
                    <td style="padding:4px 0;color:#94A3B8;width:35%;">Phân loại phôi:</td>
                    <td style="padding:4px 0;font-weight:600;color:#F8FAFC;">{product_type} ({material})</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#94A3B8;">Thời gian sản xuất:</td>
                    <td style="padding:4px 0;font-weight:600;color:#00FF88;">1 – 3 ngày làm việc (Chuẩn Printway)</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#94A3B8;">Vận chuyển tới Mỹ:</td>
                    <td style="padding:4px 0;font-weight:600;color:#00D2FF;">5 – 9 ngày qua USPS First Class / DHL</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#94A3B8;">Số lượng tối thiểu (MOQ):</td>
                    <td style="padding:4px 0;font-weight:600;color:#FFFFFF;">1 sản phẩm (Không giới hạn)</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- 13 SEO Tags -->
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <div style="font-size:13px;font-weight:700;color:#FFFFFF;margin-bottom:10px;">🏷️ BỘ 13 TỪ KHÓA SEO ETSY / AMAZON</div>
              <div>{tags_html}</div>
            </td>
          </tr>

          <!-- Call to Action -->
          <tr>
            <td style="padding:0 32px 36px 32px;text-align:center;">
              <a href="https://printway-nexus.vercel.app" style="display:inline-block;background:#00FF88;color:#080B21;font-weight:800;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 0 20px rgba(0,255,136,0.4);">
                🚀 MỞ PHIÊN NGHIÊN CỨU TRÊN PRINTWAY NEXUS
              </a>
              <div style="margin-top:12px;font-size:11px;color:#64748B;">
                Báo cáo được tạo tự động bởi Printway Nexus AI Copilot & Resend Engine.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#06081A;border-top:1px solid rgba(255,255,255,0.06);text-align:center;font-size:11px;color:#64748B;">
              © 2026 Printway Global POD Fulfillment. All rights reserved.<br>
              Hà Nội • TP. Hồ Chí Minh • San Jose, CA, USA
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return html_content


def send_opportunity_report_email(
    to_email: str,
    opportunity_data: Dict[str, Any],
    subject: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends opportunity report email to the recipient using Resend API.
    """
    api_key = RESEND_API_KEY.strip() or os.getenv("RESEND_API_KEY", "").strip()
    from_email = RESEND_FROM_EMAIL.strip() or "Printway Nexus <onboarding@resend.dev>"
    keyword = opportunity_data.get("keyword", "Sản phẩm POD Tiềm Năng")
    
    if not subject:
        score = opportunity_data.get("opportunity_score", 85)
        subject = f"🎯 [Printway Nexus] Báo Cáo R&D: {keyword} (Score: {score}/100)"

    html_content = generate_opportunity_email_html(opportunity_data)

    # 1. Real Delivery via Resend REST API
    if api_key:
        try:
            logger.info(f"📧 Sending Resend email to {to_email} with subject: '{subject}'")
            res = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": from_email,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content
                },
                timeout=12
            )
            data = res.json()
            if res.status_code in (200, 201):
                logger.info(f"✅ Resend email sent successfully! ID: {data.get('id')}")
                return {
                    "status": "success",
                    "delivery": "RESEND_API",
                    "email_id": data.get("id"),
                    "recipient": to_email,
                    "subject": subject
                }
            else:
                logger.warning(f"⚠️ Resend API returned error: {data}")
                return {
                    "status": "error",
                    "error": data.get("message", str(data)),
                    "recipient": to_email
                }
        except Exception as e:
            logger.error(f"❌ Failed to send email via Resend: {e}")
            return {
                "status": "error",
                "error": str(e),
                "recipient": to_email
            }

    # 2. Local Preview Fallback if no API Key
    logger.info(f"ℹ️ RESEND_API_KEY is not configured. Email preview generated for {to_email}.")
    return {
        "status": "simulated",
        "delivery": "LOCAL_PREVIEW",
        "recipient": to_email,
        "subject": subject,
        "message": "Email generated successfully in preview mode."
    }
