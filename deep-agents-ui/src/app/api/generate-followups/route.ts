import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { content, userPrompt } = await req.json();

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ questions: [] });
    }

    const apiKey = "sk-4253d9122c086e71-259q49-bbb82a3f";
    const apiBase = "https://9router.printway.io/v1";

    const systemPrompt = `Bạn là trợ lý AI. Dựa trên nội dung câu trả lời của AI vừa gửi cho người dùng, hãy sinh ra chính xác 4 câu hỏi gợi ý tiếp theo (follow-up questions) ngắn gọn, sắc bén, mang tính hành động cao và bám sát 100% ngữ cảnh câu trả lời của AI.
Nếu câu trả lời là về POD/E-commerce/R&D, hãy gợi ý các câu hỏi đào sâu về thị trường, đối thủ, thiết kế Pinterest, xu hướng Google Trends, giá và chi phí xưởng Printway.
Nếu câu trả lời là về lập trình, hãy gợi ý các bước kỹ thuật tiếp theo.
Nếu là câu chào hỏi, hãy gợi ý các tác vụ nổi bật mà AI có thể thực hiện.

Quy tắc bắt buộc:
Trả về DUY NHẤT định dạng JSON array chứa 4 chuỗi câu hỏi:
["Câu hỏi 1", "Câu hỏi 2", "Câu hỏi 3", "Câu hỏi 4"]`;

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
        temperature: 0.3,
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
