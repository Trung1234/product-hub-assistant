"""
SCRIPT FOR SEEDING DEMO USERS IN SUPABASE AUTH & PROFILES TABLE
Creates verified demo users with roles: Lead R&D, Senior Designer, and VIP Seller.
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "").strip()

DEMO_ACCOUNTS = [
    {
        "email": "admin@printway.io",
        "password": "Printway@2026",
        "full_name": "Phương Nguyễn (Lead R&D)",
        "role": "lead_rd",
        "org_id": "printway_internal"
    },
    {
        "email": "designer@printway.io",
        "password": "Printway@2026",
        "full_name": "Alex Designer (Printway Studio)",
        "role": "designer",
        "org_id": "printway_internal"
    },
    {
        "email": "seller@crossborder.com",
        "password": "Printway@2026",
        "full_name": "VIP Seller USA (Top Merchant)",
        "role": "seller",
        "org_id": "org_vip_sellers"
    }
]

def create_supabase_demo_accounts():
    print("=" * 80)
    print("🚀 BẮT ĐẦU TẠO TÀI KHOẢN DEMO TRÊN SUPABASE CLOUD AUTH")
    print("=" * 80)

    if not SUPABASE_URL or not SECRET_KEY:
        print("❌ Lỗi: Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong file .env!")
        return

    client = create_client(SUPABASE_URL, SECRET_KEY)
    print(f"🌐 Đang kết nối tới Supabase: {SUPABASE_URL}")

    for acc in DEMO_ACCOUNTS:
        email = acc["email"]
        pwd = acc["password"]
        name = acc["full_name"]
        role = acc["role"]
        org = acc["org_id"]

        print(f"\n👤 Đang khởi tạo tài khoản: {email} ({name})...")
        try:
            # Create user via Supabase Auth Admin API (automatically confirmed)
            user_res = client.auth.admin.create_user({
                "email": email,
                "password": pwd,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": name,
                    "role": role,
                    "org_id": org
                }
            })
            uid = user_res.user.id
            print(f"   ✅ Đã tạo trong Supabase Auth: User ID = {uid}")

            # Ensure profile exists in public.profiles table
            profile_payload = {
                "id": uid,
                "email": email,
                "full_name": name,
                "role": role,
                "org_id": org
            }
            client.table("profiles").upsert(profile_payload).execute()
            print(f"   ✅ Đã đồng bộ bảng public.profiles!")

        except Exception as e:
            err_str = str(e)
            if "already registered" in err_str or "already exists" in err_str or "duplicate" in err_str:
                print(f"   ℹ️ Tài khoản '{email}' đã tồn tại sẵn trên Supabase!")
            else:
                print(f"   ⚠️ Thông báo: {e}")

    print("\n" + "=" * 80)
    print("🎉 HOÀN TẤT KHỞI TẠO TẤT CẢ TÀI KHOẢN DEMO TRÊN SUPABASE CLOUD!")
    print("=" * 80)

if __name__ == "__main__":
    create_supabase_demo_accounts()
