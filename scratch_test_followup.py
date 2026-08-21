import re
import json

def extract_follow_up_questions(content: str):
    if not content:
        return []
    
    # 1. XML tag
    m = re.search(r'<follow_up_questions>([\s\S]*?)</follow_up_questions>', content, re.I)
    if m:
        lines = [re.sub(r'^[-*•\d.↳"\[\]\s]+', '', l).strip('" ,]') for l in m.group(1).split('\n') if len(l.strip()) > 6]
        if lines:
            return lines[:4]
            
    # 2. Code block
    m = re.search(r'```(?:suggestions|suggestion|followup|follow_up_questions|questions)\s*([\s\S]*?)\s*```', content, re.I)
    if m:
        try:
            parsed = json.loads(m.group(1).strip())
            if isinstance(parsed, list) and len(parsed) > 0:
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            lines = [re.sub(r'^[-*•\d.↳"\[\]\s]+', '', l).strip('" ,]') for l in m.group(1).split('\n') if len(l.strip()) > 6]
            if lines:
                return lines[:4]

    # 3. Dynamic synthesis fallback
    product = "sản phẩm này"
    kw_m = re.search(r'(?:keyword|sản phẩm|ngách|cơ hội)[=:"\'\s]+([^"\n\',.]+)', content, re.I)
    if kw_m:
        product = kw_m.group(1).strip()
        
    return [
        f"Phân tích sâu Top 3 đối thủ cạnh tranh trực tiếp trên Etsy và Amazon cho {product}",
        f"Gợi ý 5 biến thể thiết kế độc đáo và bảng màu thịnh hành trên Pinterest cho {product}",
        f"Dự báo chi tiết đà tăng trưởng tìm kiếm Google Trends trong 60 ngày tới",
        f"Đánh giá chi tiết chi phí xưởng Printway và dải giá bán lẻ tối ưu lợi nhuận"
    ]

# Test with sample content
sample_1 = "Báo cáo cơ hội sản phẩm: Baby First Christmas Ornament 2026 Custom Acrylic"
print("Sample 1 result:", extract_follow_up_questions(sample_1))

sample_2 = """
Báo cáo R&D
<follow_up_questions>
- ↳ Top 3 đối thủ Amazon bán chạy nhất là ai?
- ↳ Pinterest có những bảng màu nào hot?
- ↳ Dự báo mùa vụ đạt đỉnh tháng mấy?
- ↳ Giá xưởng Printway có ưu đãi gì không?
</follow_up_questions>
"""
print("Sample 2 result:", extract_follow_up_questions(sample_2))
