import { ImageResponse } from "next/og";

export const alt = "Printway Nexus - AI R&D Copilot for Print On Demand";
export const size = {
  width: 1200,
  height: 600,
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
          padding: "50px 60px",
          backgroundColor: "#080B21",
          color: "#FFFFFF",
          position: "relative",
        }}
      >
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
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                backgroundColor: "#00FF88",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: "900",
                color: "#080B21",
                marginRight: "14px",
              }}
            >
              ⚡
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "26px", fontWeight: "900", display: "flex", flexDirection: "row" }}>
                <span style={{ color: "#FFFFFF" }}>PRINTWAY</span>
                <span style={{ color: "#00FF88", marginLeft: "4px" }}>.IO</span>
              </div>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#00D4FF" }}>
                NEXUS AI R&D COPILOT
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "rgba(0, 255, 136, 0.15)",
              border: "1px solid rgba(0, 255, 136, 0.4)",
              borderRadius: "20px",
              padding: "8px 18px",
              fontSize: "13px",
              fontWeight: "700",
              color: "#00FF88",
              display: "flex",
            }}
          >
            POD MARKET INTELLIGENCE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "950px" }}>
          <div style={{ fontSize: "46px", fontWeight: "900", lineHeight: 1.15, color: "#FFFFFF", display: "flex", marginBottom: "12px" }}>
            Cơ Hội Sản Phẩm POD Xuyên Biên Giới Realtime
          </div>
          <div style={{ fontSize: "19px", color: "#94A3B8", lineHeight: 1.4, display: "flex" }}>
            Quét xu hướng Etsy, Amazon, Pinterest • 5D Opportunity Scoring • Tự động gửi email Resend
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-around",
            backgroundColor: "#0E1538",
            border: "1px solid rgba(0, 255, 136, 0.2)",
            borderRadius: "14px",
            padding: "16px 24px",
          }}
        >
          <div style={{ fontSize: "15px", color: "#00FF88", fontWeight: "700", display: "flex" }}>
            ✓ Etsy & Amazon Realtime Crawler
          </div>
          <div style={{ fontSize: "15px", color: "#00D4FF", fontWeight: "700", display: "flex" }}>
            ✓ Printway VN Catalog Fit
          </div>
          <div style={{ fontSize: "15px", color: "#A78BFA", fontWeight: "700", display: "flex" }}>
            ✓ Automated Resend Reports
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
