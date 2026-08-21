"""
SCRIPT TO DEPLOY PRINTWAY PRODUCT OPPORTUNITY HUB BACKEND ON RENDER CLOUD
Uses Render REST API v1 to create and deploy the Docker web service.
"""

import os
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv()

RENDER_API_KEY = os.getenv("RENDER_API_KEY", "").strip()
OWNER_ID = os.getenv("RENDER_OWNER_ID", "tea-cspserq3esus738f06eg").strip()

def deploy_to_render():
    print("=" * 80)
    print("🚀 BẮT ĐẦU KHỞI TẠO & DEPLOY BACKEND LÊN RENDER CLOUD")
    print("=" * 80)

    # 1. Prepare environment variables from local .env
    env_keys = [
        "PORT", "HOST", "SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SECRET_KEY",
        "BROWSERLESS_API_KEY", "BROWSERLESS_USE_RESIDENTIAL", "BROWSERLESS_WS_ENDPOINT",
        "OPENAI_API_KEY", "GOOGLE_API_KEY", "TAVILY_API_KEY", "LANGSMITH_API_KEY"
    ]
    
    env_vars = []
    for k in env_keys:
        v = os.getenv(k)
        if v:
            env_vars.append({"key": k, "value": v})

    payload = {
        "type": "web_service",
        "name": "printway-product-hub-backend",
        "ownerId": OWNER_ID,
        "repo": "https://github.com/Trung1234/product-hub-assistant",
        "branch": "main",
        "autoDeploy": "yes",
        "serviceDetails": {
            "env": "docker",
            "dockerfilePath": "Dockerfile",
            "plan": "free",
            "region": "oregon",
            "healthCheckPath": "/ok",
            "envVars": env_vars
        }
    }

    url = "https://api.render.com/v1/services"
    headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            srv = res_data.get("service", res_data)
            service_id = srv.get("id")
            service_url = srv.get("serviceDetails", {}).get("url")
            dashboard_url = srv.get("dashboardUrl")

            print(f"\n🎉 KHỞI TẠO THÀNH CÔNG DỊCH VỤ TRÊN RENDER CLOUD!")
            print(f"   • Service ID    : {service_id}")
            print(f"   • Live URL      : {service_url}")
            print(f"   • Dashboard URL : {dashboard_url}")

            with open("data/render_service_info.json", "w") as f:
                json.dump(res_data, f, indent=2)

            return service_url

    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"⚠️ HTTP Error {e.code}: {err_body}")
    except Exception as e:
        print(f"❌ Error: {e}")

    return None

if __name__ == "__main__":
    deploy_to_render()
