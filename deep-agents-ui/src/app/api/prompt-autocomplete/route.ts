import { NextResponse } from "next/server";

// In-memory server cache for ultra-fast completions
const cache = new Map<string, { completion: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ completion: "" });
    }

    const { prefix, context } = body;

    if (!prefix || typeof prefix !== "string" || prefix.trim().length < 2) {
      return NextResponse.json({ completion: "" });
    }

    const cleanPrefix = prefix.trim();
    const cacheKey = cleanPrefix.toLowerCase();

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ completion: cached.completion });
    }

    const apiKey = "sk-4253d9122c086e71-259q49-bbb82a3f";
    const apiBase = "https://9router.printway.io/v1";

    const systemPrompt = `Bạn là AI Autocomplete Engine cho nền tảng R&D Print-on-Demand (POD) Printway.
Nhiệm vụ: Dựa trên những chữ người dùng đang gõ (prefix), hãy tự động suy luận và HOÀN THÀNH TIẾP CÂU LỆNH (Prompt Autocomplete) một cách thông minh, sắc bén, chuẩn chuyên môn E-commerce R&D (Etsy, Amazon BSR, TikTok Shop, Google Trends, vật liệu Mica Đài Loan 3mm, Gỗ Plywood, Ly giữ nhiệt 40oz, Áo nỉ thêu, biên lợi nhuận xưởng Printway, 13 SEO Tags).

Quy tắc tối thượng:
1. Câu hoàn chỉnh BẮT BUỘC PHẢI BẮT ĐẦU CHÍNH XÁC bằng chuỗi prefix của người dùng (giữ nguyên từng chữ người dùng đã gõ).
2. Viết dưới góc nhìn người dùng yêu cầu AI thực hiện.
3. Không thêm lời chào, không giải thích.
4. Trả về DUY NHẤT một JSON object: {"completion": "câu hoàn chỉnh bắt đầu bằng prefix"}`;

    const userMessage = context
      ? `Ngữ cảnh phiên làm việc: ${context.slice(-800)}\n\nTiền tố người dùng đang gõ: "${cleanPrefix}"`
      : `Tiền tố người dùng đang gõ: "${cleanPrefix}"`;

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
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 80,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ completion: "" });
    }

    const data = await response.json();
    const rawOutput = data.choices?.[0]?.message?.content || "";

    let completion = "";
    try {
      const match = rawOutput.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.completion && typeof parsed.completion === "string") {
          completion = parsed.completion.trim();
        }
      }
    } catch {
      completion = rawOutput.replace(/["{}]/g, "").trim();
    }

    // Ensure completion starts with prefix (case-insensitive)
    if (completion && !completion.toLowerCase().startsWith(cleanPrefix.toLowerCase())) {
      completion = `${cleanPrefix} ${completion}`;
    }

    if (completion && completion.length > cleanPrefix.length) {
      cache.set(cacheKey, { completion, timestamp: Date.now() });
      return NextResponse.json({ completion });
    }

    return NextResponse.json({ completion: "" });
  } catch (error) {
    console.error("Autocomplete API error:", error);
    return NextResponse.json({ completion: "" });
  }
}
