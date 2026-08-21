import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { content, userPrompt } = await req.json();

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ questions: [] });
    }

    const apiKey = "sk-4253d9122c086e71-259q49-bbb82a3f";
    const apiBase = "https://9router.printway.io/v1";

    const systemPrompt = `Bạn là chuyên gia Print-on-Demand (POD) & E-commerce Market Strategist.
Dựa trên báo cáo vừa rồi của AI, hãy tạo ra ĐÚNG 4 CÂU PROMPT HÀNH ĐỘNG TIẾP THEO MÀ NGƯỜI DÙNG CÓ THỂ CLICK ĐỂ GỬI YÊU CẦU CHO AI.

QUY TẮC VAI TRÒ TUYỆT ĐỐI (CRITICAL ROLE ENFORCEMENT):
- Phải viết 100% dưới góc nhìn của NGƯỜI DÙNG (User Action Prompts) đang yêu cầu/hỏi AI tiếp tục phân tích.
- TUYỆT ĐỐI KHÔNG viết dưới góc nhìn của AI hỏi người dùng (KHÔNG dùng: "Bạn có muốn...", "Bạn chọn gì...", "Hãy cho tôi biết...", "Bạn có cần...").
- VÍ DỤ ĐÚNG (User Action Prompts):
  • "Phân tích chi tiết 5 shop bán chạy nhất ngách này trên Etsy"
  • "So sánh biên lợi nhuận giữa phôi Mica 3mm và Gỗ Plywood xưởng Printway"
  • "Lập kế hoạch chạy Ads TikTok Shop và thời điểm mở bán đón sóng Q4"
  • "Tạo thêm 3 mẫu prompt Midjourney phong cách Watercolor và Vintage"

Quy tắc định dạng:
Trả về DUY NHẤT một JSON array chứa đúng 4 chuỗi câu prompt:
["Prompt người dùng 1", "Prompt người dùng 2", "Prompt người dùng 3", "Prompt người dùng 4"]`;

    const userMessage = userPrompt
      ? `User Prompt: ${userPrompt}\n\nAI Response:\n${content.slice(0, 3000)}`
      : `AI Response:\n${content.slice(0, 3000)}`;

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "cx/gpt-5.5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error("LLM Follow-up API error:", response.statusText);
      return NextResponse.json({ questions: [] });
    }

    const data = await response.json();
    const rawOutput = data.choices?.[0]?.message?.content || "";

    // Parse JSON array from output
    try {
      const match = rawOutput.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanQuestions = parsed
            .map((q: any) => String(q).trim().replace(/^[-*•\d.↳"\[\]\s]+/, ""))
            .filter((q: string) => q.length > 5);
          return NextResponse.json({ questions: cleanQuestions.slice(0, 4) });
        }
      }
    } catch (e) {
      console.error("Error parsing LLM follow-up JSON:", e);
    }

    // Fallback line parsing
    const lines = rawOutput
      .split("\n")
      .map((l: string) => l.replace(/^[-*•\d.↳"\[\]\s]+/, "").replace(/[",\]]/g, "").trim())
      .filter((l: string) => l.length > 6);

    return NextResponse.json({ questions: lines.slice(0, 4) });
  } catch (error) {
    console.error("Generate follow-ups route error:", error);
    return NextResponse.json({ questions: [] });
  }
}
