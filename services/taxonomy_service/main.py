import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Printway Product Opportunity Hub Report & Dataset Service",
    description="Microservice for serving generated PDF reports and CSV opportunity datasets",
    version="2.0.0"
)

# Enable CORS for Next.js frontend (deep-agents-ui at port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REPORTS_DIR = os.getenv("REPORTS_DIR", "data/reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

@app.get("/health")
def health_check():
    return {"status": "HEALTHY", "service": "Printway Report & Dataset Download Service", "version": "2.0.0"}

@app.get("/reports/{filename}")
@app.head("/reports/{filename}")
def download_report(filename: str):
    file_path = os.path.join(REPORTS_DIR, filename)
    if not os.path.exists(file_path):
        # Check root data/ directory as fallback
        alt_path = os.path.join("data", filename)
        if os.path.exists(alt_path):
            file_path = alt_path
        else:
            raise HTTPException(status_code=404, detail=f"File '{filename}' not found")
            
    if filename.endswith(".pdf"):
        media_type = "application/pdf"
    elif filename.endswith(".csv"):
        media_type = "text/csv"
    else:
        media_type = "text/html"
        
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
