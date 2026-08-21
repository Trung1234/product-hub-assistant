import { ImageResponse } from "next/og";

export const alt = "Printway Nexus - AI R&D Copilot for Print On Demand";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 70px",
          backgroundColor: "#080B21",
          color: "#FFFFFF",
          position: "relative",
        }}
      >
        {/* Top Header: Brand & Live Badge */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <div
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "14px",
                backgroundColor: "#00FF88",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
                fontWeight: "900",
                color: "#080B21",
                marginRight: "16px",
              }}
            >
              ⚡
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: "30px",
                  fontWeight: "900",
                  letterSpacing: "1px",
                  display: "flex",
                  flexDirection: "row",
                }}
              >
                <span style={{ color: "#FFFFFF" }}>PRINTWAY</span>
                <span style={{ color: "#00FF88", marginLeft: "4px" }}>.IO</span>
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  letterSpacing: "2px",
                  color: "#00D4FF",
                  textTransform: "uppercase",
                }}
              >
                NEXUS AI R&D HUB
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(0, 255, 136, 0.12)",
              border: "1px solid rgba(0, 255, 136, 0.4)",
              borderRadius: "30px",
              padding: "10px 22px",
              fontSize: "14px",
              fontWeight: "700",
              color: "#00FF88",
            }}
          >
            AI REALTIME MARKET SIGNALS
          </div>
        </div>

        {/* Center: Main Title & Hook */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "980px" }}>
          <div
            style={{
              fontSize: "52px",
              fontWeight: "900",
              lineHeight: 1.15,
              color: "#FFFFFF",
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <span>AI Copilot Phát Hiện Cơ Hội Sản Phẩm </span>
            <span style={{ color: "#00FF88", marginLeft: "10px" }}>Print-On-Demand</span>
          </div>

          <div
            style={{
              fontSize: "21px",
              color: "#94A3B8",
              lineHeight: 1.5,
              display: "flex",
            }}
          >
            Tự động cào tín hiệu thị trường Etsy, Amazon, Pinterest • Đánh giá Opportunity Score 5D • Báo cáo Resend Email
          </div>
        </div>

        {/* Bottom Metrics Bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#0E1538",
            border: "1px solid rgba(0, 255, 136, 0.25)",
            borderRadius: "18px",
            padding: "20px 32px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <div style={{ fontSize: "26px", marginRight: "12px", display: "flex" }}>🎯</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "12px", color: "#94A3B8", fontWeight: "700", display: "flex" }}>
                ĐỘ CHÍNH XÁC R&D
              </div>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#00FF88", display: "flex" }}>
                5D Scoring Matrix
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <div style={{ fontSize: "26px", marginRight: "12px", display: "flex" }}>⚡</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "12px", color: "#94A3B8", fontWeight: "700", display: "flex" }}>
                DỮ LIỆU THỜI GIAN THỰC
              </div>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#00D4FF", display: "flex" }}>
                Etsy + Amazon + Pinterest
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <div style={{ fontSize: "26px", marginRight: "12px", display: "flex" }}>📬</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "12px", color: "#94A3B8", fontWeight: "700", display: "flex" }}>
                CHUYỂN PHÁT BÁO CÁO
              </div>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#A78BFA", display: "flex" }}>
                Resend Email Automation
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
