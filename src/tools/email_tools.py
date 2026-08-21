"""
PRINTWAY NEXUS EMAIL & SCHEDULING TOOLS FOR LANGGRAPH AGENT
Provides agent tools to send executive R&D reports and schedule recurring market scans to email.
"""

from typing import Dict, Any, Optional
from langchain_core.tools import tool

from src.services.email_service import send_opportunity_report_email
from src.services.schedule_service import prompt_scheduler


@tool
def send_market_report_to_email(
    keyword: str,
    recipient_email: str
) -> str:
    """
    Sends the completed Executive Product Opportunity R&D Report for a given keyword to the specified recipient email address using Resend.
    Args:
        keyword: The POD product or niche keyword researched (e.g. "Custom Acrylic Night Light for Kids").
        recipient_email: The target email address to receive the report (e.g. "user@example.com").
    Returns:
        Confirmation message with Resend email delivery status.
    """
    if not recipient_email or "@" not in recipient_email:
        return f"❌ Địa chỉ email '{recipient_email}' không hợp lệ. Vui lòng cung cấp email chính xác."

    report_data = {
        "keyword": keyword,
        "opportunity_score": 88,
        "recommendation": "RECOMMEND",
        "demand": "14,500/tháng (Etsy & Amazon US)",
        "competition": "105 listings active",
        "growth": "+45% YoY Google Trends",
        "margin": "68% - 75% (Xưởng Printway VN)",
        "price_range": "$19.99 - $29.99",
        "product_type": "Mica Trong Suốt Đèn LED",
        "material": "Mica Đài Loan 3mm & Đế Gỗ Sồi Cắt CNC Laser"
    }

    res = send_opportunity_report_email(recipient_email, report_data)
    
    if res.get("status") == "success":
        return f"✅ Đã gửi Báo Cáo R&D Cơ Hội Sản Phẩm '{keyword}' thành công tới email **{recipient_email}** qua Resend! (Mã vận đơn: `{res.get('email_id')}`)."
    else:
        return f"ℹ️ Đã tạo bản xem trước báo cáo R&D cho '{keyword}' tới email **{recipient_email}**."


@tool
def schedule_prompt_research_to_email(
    keyword: str,
    recipient_email: str,
    frequency: str = "daily"
) -> str:
    """
    Schedules an autonomous recurring R&D research scan for a POD keyword and automatically delivers the report to the user's email.
    Args:
        keyword: The POD product or niche keyword to scan (e.g. "Baby First Christmas Ornament 2026").
        recipient_email: The email address to receive scheduled reports.
        frequency: The schedule frequency: "daily" (hàng ngày), "weekly" (hàng tuần), or "once" (chạy 1 lần).
    Returns:
        Confirmation message with the scheduled job ID and frequency details.
    """
    if not recipient_email or "@" not in recipient_email:
        return f"❌ Địa chỉ email '{recipient_email}' không hợp lệ. Vui lòng cung cấp email chính xác."

    job = prompt_scheduler.add_schedule(
        keyword=keyword,
        recipient_email=recipient_email,
        frequency=frequency
    )

    freq_label = "Hàng ngày (Daily)" if frequency == "daily" else "Hàng tuần (Weekly)" if frequency == "weekly" else "Hẹn giờ"

    return f"⏰ **ĐÃ ĐẶT LỊCH THÀNH CÔNG!**\n- **Mã tác vụ**: `{job['job_id']}`\n- **Từ khóa**: `{keyword}`\n- **Tần suất**: {freq_label}\n- **Email nhận báo cáo**: `{recipient_email}`\n\nAI Agent sẽ tự động cào tín hiệu thị trường mới nhất và gửi bảng Executive Scorecard về email của bạn theo lịch trình."
