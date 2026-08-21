import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      toEmail,
      keyword = "Sản phẩm POD Tiềm Năng",
      score = 85,
      recommendation = "RECOMMEND",
      demand = "14,500/tháng",
      competition = "105 listings",
      growth = "+45% YoY",
      margin = "68% - 75%",
      priceRange = "$19.99 - $29.99",
      productType = "Mica Trong Suốt (Acrylic)",
      material = "Mica Đài Loan 3mm & Gỗ Sồi",
      tags = [
        "custom acrylic plaque",
        "personalized night light",
        "kids bedroom decor",
        "custom keepsake gift",
        "acrylic led lamp",
      ],
    } = body;

    if (!toEmail || !toEmail.includes("@")) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp địa chỉ email hợp lệ." },
        { status: 400 }
      );
    }

    const apiKey = (process.env.RESEND_API_KEY || "").trim();
    const fromEmail = (process.env.RESEND_FROM_EMAIL || "Printway Nexus <onboarding@resend.dev>").trim();

    const recColor =
      recommendation.includes("RECOMMEND") && !recommendation.includes("NOT")
        ? "#00FF88"
        : recommendation.includes("CAUTION")
        ? "#F59E0B"
        : "#EF4444";

    const tagsHtml = tags
      .slice(0, 13)
      .map(
        (t: string) =>
          `<span style="display:inline-block;background:#0E1538;border:1px solid rgba(0,255,136,0.3);color:#00FF88;padding:4px 10px;margin:3px;border-radius:6px;font-size:12px;font-family:monospace;">${t}</span>`
      )
      .join("");

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo Cáo R&D Printway Nexus - ${keyword}</title>
</head>
<body style="margin:0;padding:0;background-color:#080B21;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#080B21;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#0B1033;border:1px solid rgba(0,255,136,0.25);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.6);">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#0E1538 0%,#121A45 100%);border-bottom:1px solid rgba(0,255,136,0.2);">
              <table width="100%">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:900;letter-spacing:1px;color:#00FF88;">PRINTWAY<span style="color:#00D2FF;">.IO</span></span>
                    <div style="font-size:11px;color:#94A3B8;margin-top:2px;font-family:monospace;">NEXUS AI R&D STRATEGIST</div>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:rgba(0,255,136,0.15);border:1px solid ${recColor};color:${recColor};font-weight:800;font-size:11px;padding:5px 12px;border-radius:20px;text-transform:uppercase;">
                      ${recommendation}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 16px 32px;">
              <div style="font-size:12px;font-weight:700;color:#00D2FF;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">BÁO CÁO CƠ HỘI SẢN PHẨM MỚI</div>
              <h1 style="margin:0 0 20px 0;font-size:22px;font-weight:800;color:#FFFFFF;line-height:1.3;">${keyword}</h1>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td width="48%" style="padding:14px;background:#080B21;border:1px solid rgba(0,255,136,0.2);border-radius:10px;vertical-align:top;">
                    <div style="font-size:11px;color:#94A3B8;font-weight:600;">OPPORTUNITY SCORE</div>
                    <div style="font-size:28px;font-weight:900;color:#00FF88;margin:4px 0;">${score}<span style="font-size:14px;color:#64748B;">/100</span></div>
                    <div style="font-size:10px;color:#94A3B8;">Xếp hạng tiềm năng R&D</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="padding:14px;background:#080B21;border:1px solid rgba(0,210,255,0.2);border-radius:10px;vertical-align:top;">
                    <div style="font-size:11px;color:#94A3B8;font-weight:600;">NHU CẦU TÌM KIẾM</div>
                    <div style="font-size:20px;font-weight:800;color:#00D2FF;margin:4px 0;">${demand}</div>
                    <div style="font-size:10px;color:#94A3B8;">Tăng trưởng: <b style="color:#00FF88;">${growth}</b></div>
                  </td>
                </tr>
                <tr><td height="12"></td></tr>
                <tr>
                  <td width="48%" style="padding:14px;background:#080B21;border:1px solid rgba(139,92,246,0.2);border-radius:10px;vertical-align:top;">
                    <div style="font-size:11px;color:#94A3B8;font-weight:600;">MỨC ĐỘ CẠNH TRANH</div>
                    <div style="font-size:18px;font-weight:800;color:#A78BFA;margin:4px 0;">${competition}</div>
                    <div style="font-size:10px;color:#94A3B8;">Mật độ listing active</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="padding:14px;background:#080B21;border:1px solid rgba(16,185,129,0.2);border-radius:10px;vertical-align:top;">
                    <div style="font-size:11px;color:#94A3B8;font-weight:600;">BIÊN LỢI NHUẬN XƯỞNG</div>
                    <div style="font-size:20px;font-weight:800;color:#34D399;margin:4px 0;">${margin}</div>
                    <div style="font-size:10px;color:#94A3B8;">Giá bán đề xuất: ${priceRange}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px 32px;">
              <div style="padding:18px;background:#0E1538;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                <div style="font-size:13px;font-weight:700;color:#FFFFFF;margin-bottom:12px;">🏭 THÔNG SỐ XƯỞNG PRINTWAY VIỆT NAM</div>
                <table width="100%" style="font-size:12px;color:#CBD5E1;">
                  <tr>
                    <td style="padding:4px 0;color:#94A3B8;width:35%;">Phân loại phôi:</td>
                    <td style="padding:4px 0;font-weight:600;color:#F8FAFC;">${productType} (${material})</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#94A3B8;">Thời gian sản xuất:</td>
                    <td style="padding:4px 0;font-weight:600;color:#00FF88;">1 – 3 ngày làm việc (Chuẩn Printway)</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#94A3B8;">Vận chuyển US:</td>
                    <td style="padding:4px 0;font-weight:600;color:#00D2FF;">5 – 9 ngày qua USPS First Class / DHL</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 28px 32px;">
              <div style="font-size:13px;font-weight:700;color:#FFFFFF;margin-bottom:10px;">🏷️ BỘ 13 TỪ KHÓA SEO ETSY / AMAZON</div>
              <div>${tagsHtml}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 36px 32px;text-align:center;">
              <a href="https://printway-nexus.vercel.app" style="display:inline-block;background:#00FF88;color:#080B21;font-weight:800;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 0 20px rgba(0,255,136,0.4);">
                🚀 MỞ PHIÊN NGHIÊN CỨU TRÊN PRINTWAY NEXUS
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `🎯 [Printway Nexus] Báo Cáo R&D: ${keyword} (Score: ${score}/100)`,
        html: htmlContent,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Không thể gửi email qua Resend." },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      emailId: data.id,
      recipient: toEmail,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi máy chủ nội bộ." },
      { status: 500 }
    );
  }
}
