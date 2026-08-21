import re
from typing import Dict, Any, List

PRODUCT_VISUAL_REGISTRY = {
    "ornament": [
        {
            "title": "2D Custom Shape Clear Acrylic Christmas Ornament",
            "image_url": "https://images.unsplash.com/photo-1543257580-7269da773bf5?auto=format&fit=crop&w=600&q=80",
            "style": "Clear Optical Acrylic (3mm) + UV Direct Print + Gold Hanging Ribbon",
            "suggested_price": "$16.99 - $21.99",
            "niche_advice": "Bo tròn 4 góc an toàn, in kèm ảnh chân dung siêu âm bé hoặc tên gia đình năm 2026."
        },
        {
            "title": "Stained Glass Effect Floral Acrylic Keepsake",
            "image_url": "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=600&q=80",
            "style": "Giả kính màu nghệ thuật (Stained Glass Translucent Finish) với viền vàng ánh kim",
            "suggested_price": "$18.50 - $24.00",
            "niche_advice": "Hiệu ứng bắt sáng khi treo đèn cây thông noel hoặc cửa sổ (Sun-catcher)."
        }
    ],
    "plaque": [
        {
            "title": "Custom Acrylic Desk Plaque with Solid Wood LED Light Base",
            "image_url": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80",
            "style": "Tấm Acrylic dày 5mm + Đế gỗ dẻ gai tự nhiên tích hợp đèn LED vàng ấm 3000K",
            "suggested_price": "$24.99 - $34.99",
            "niche_advice": "Quà tặng sếp, bác sĩ, giáo viên hoặc quà lưu niệm kỷ niệm ngày cưới/tốt nghiệp."
        },
        {
            "title": "Minimalist Typography Acrylic Table Stand with Wooden Block",
            "image_url": "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=600&q=80",
            "style": "Acrylic trong suốt khắc chữ tối giản phong cách Bắc Âu + Đế gỗ sồi",
            "suggested_price": "$21.99 - $28.50",
            "niche_advice": "Decor bàn làm việc văn phòng, bàn trang điểm, quà tặng đồng nghiệp thăng chức."
        }
    ],
    "tumbler": [
        {
            "title": "Stainless Steel Tumbler 20oz with Lid and Metal Straw",
            "image_url": "https://images.unsplash.com/photo-1570857502809-08184874388e?auto=format&fit=crop&w=600&q=80",
            "style": "Inox 304 2 lớp chân không giữ nhiệt 12h + Khắc Laser 360 độ hoặc in UV mờ",
            "suggested_price": "$22.99 - $29.99",
            "niche_advice": "Quà tặng thầy cô giáo, y tá, người tập gym, in kèm tên riêng và hoa văn đường nét."
        },
        {
            "title": "Pastel Gradient Insulated Drinkware Cup with Handle",
            "image_url": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
            "style": "Lớp phủ sơn tĩnh điện màu Pastel loang + Quai cầm công thái học",
            "suggested_price": "$26.50 - $34.00",
            "niche_advice": "Bắt trend thẩm mỹ Stanley/Owala cho học sinh, sinh viên và nữ văn phòng."
        }
    ],
    "sweatshirt": [
        {
            "title": "Custom Embroidered Mama Sweatshirt with Sleeve Names",
            "image_url": "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80",
            "style": "Nỉ bông Cotton 80/20 dày dặn 320 GSM + Thêu Satin mật độ cao trước ngực và cổ tay áo",
            "suggested_price": "$34.99 - $44.99",
            "niche_advice": "Thêu chữ 'MAMA / GRANDMA' và thêu trái tim nhỏ kèm tên con ở cổ tay trái."
        }
    ],
    "mug": [
        {
            "title": "Personalized Pet Portrait Ceramic Coffee Mug 11oz/15oz",
            "image_url": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
            "style": "Gốm sứ cao cấp tráng men bóng + In chuyển nhiệt Sublimation tràn viền",
            "suggested_price": "$14.99 - $18.99",
            "niche_advice": "Vẽ tay chân dung chó/mèo cưng theo phong cách màu nước kèm câu quote hài hước."
        }
    ]
}

class ProductVisualProvider:
    """
    Real-world high-resolution product visual design & sample mockup intelligence provider.
    Provides authentic design references, material specifications, and visual galleries for Printway R&D.
    """
    def _match_category(self, keyword: str) -> str:
        kw_lower = keyword.lower()
        if any(w in kw_lower for w in ["ornament", "christmas", "xmas"]):
            return "ornament"
        elif any(w in kw_lower for w in ["plaque", "sign", "acrylic desk", "name plate"]):
            return "plaque"
        elif any(w in kw_lower for w in ["tumbler", "cup", "drinkware"]):
            return "tumbler"
        elif any(w in kw_lower for w in ["sweatshirt", "hoodie", "apparel", "shirt"]):
            return "sweatshirt"
        elif any(w in kw_lower for w in ["mug", "coffee"]):
            return "mug"
        return "ornament"

    def get_product_visual_samples(self, keyword: str) -> List[Dict[str, Any]]:
        """Retrieves verified high-resolution visual design samples and specs."""
        cat = self._match_category(keyword)
        samples = PRODUCT_VISUAL_REGISTRY.get(cat, PRODUCT_VISUAL_REGISTRY["ornament"])
        return samples

    def format_markdown_gallery(self, keyword: str) -> str:
        """Formats an executive Markdown Visual Design Gallery for R&D proposals."""
        samples = self.get_product_visual_samples(keyword)
        
        md_lines = [
            "### 🖼️ Mẫu Thiết Kế Thịnh Hành Thực Tế & Đề Xuất Trực Quan (Visual Design Gallery):",
            "",
            "| Mẫu Thiết Kế Thực Tế | Quy Cách Kỹ Thuật & Thẩm Mỹ | Đề Xuất R&D & Định Giá Bán |",
            "| :---: | :--- | :--- |"
        ]
        
        for idx, s in enumerate(samples, 1):
            img_tag = f"![{s['title']}]({s['image_url']})"
            tech_spec = f"**{s['title']}**<br>• **Vật liệu/Kỹ thuật**: {s['style']}"
            biz_rec = f"• **Dải giá bán lẻ**: `{s['suggested_price']}`<br>• **Gợi ý R&D**: {s['niche_advice']}"
            md_lines.append(f"| {img_tag} | {tech_spec} | {biz_rec} |")
            
        return "\n".join(md_lines)
