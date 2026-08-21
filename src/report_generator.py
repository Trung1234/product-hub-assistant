import os
import json
import base64
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from xhtml2pdf import pisa

class PDFReportGenerator:
    """
    Generates a beautifully formatted HTML report with embedded visual charts 
    and converts it into a PDF file using xhtml2pdf / HTML rendering.
    """
    def __init__(self, output_dir: str = "data/reports"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def _generate_score_chart_base64(self, breakdown: dict) -> str:
        """Generates a horizontal bar chart of the 5D opportunity scores as Base64 image."""
        dimensions = ["Demand", "Competition", "Growth", "Seasonality", "Personalization", "Printway Fit"]
        scores = [
            breakdown.get("demand", {}).get("score", 70),
            breakdown.get("competition", {}).get("score", 75),
            breakdown.get("growth", {}).get("score", 85),
            breakdown.get("seasonality", {}).get("score", 80),
            breakdown.get("personalization", {}).get("score", 90),
            breakdown.get("production_fit", {}).get("score", 88)
        ]
        colors = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

        fig, ax = plt.subplots(figsize=(6.5, 2.8), dpi=150)
        bars = ax.barh(dimensions, scores, color=colors, height=0.55)
        
        ax.set_xlim(0, 100)
        ax.set_xlabel('Score (0 - 100)', fontsize=9, fontweight='bold', color='#334155')
        ax.set_title('5-Dimensional Opportunity Breakdown', fontsize=11, fontweight='bold', pad=10, color='#1E293B')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#CBD5E1')
        ax.spines['bottom'].set_color('#CBD5E1')
        ax.tick_params(axis='both', which='major', labelsize=8)

        # Add bar score labels
        for bar in bars:
            width = bar.get_width()
            ax.text(width + 1.5, bar.get_y() + bar.get_height()/2, f'{width:.1f}', 
                    va='center', ha='left', fontsize=8, fontweight='bold', color='#1E293B')

        plt.tight_layout()
        
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', bbox_inches='tight', transparent=False)
        plt.close(fig)
        buffer.seek(0)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')

    def generate_html_report(self, evaluation: dict) -> str:
        """Generates rich executive HTML report string with responsive CSS & embedded charts."""
        breakdown = evaluation.get("breakdown", {})
        chart_base64 = self._generate_score_chart_base64(breakdown)

        score = evaluation.get("opportunity_score", 85)
        rec = evaluation.get("recommendation", "RECOMMEND")
        badge_color = "#059669" if rec == "RECOMMEND" else "#D97706" if "CAUTION" in rec else "#DC2626"

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Product Research Report</title>
    <style>
        @page {{
            size: a4 portrait;
            margin: 1.5cm;
        }}
        body {{
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1E293B;
            line-height: 1.5;
            background-color: #FFFFFF;
            font-size: 12px;
        }}
        .header {{
            border-bottom: 3px solid #4F46E5;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }}
        .title {{
            font-size: 22px;
            font-weight: bold;
            color: #1E293B;
            margin: 0;
        }}
        .subtitle {{
            font-size: 12px;
            color: #64748B;
            margin-top: 4px;
        }}
        .score-card {{
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }}
        .badge {{
            display: inline-block;
            background-color: {badge_color};
            color: #FFFFFF;
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 11px;
        }}
        .metric-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 20px;
        }}
        .metric-table th, .metric-table td {{
            border: 1px solid #E2E8F0;
            padding: 8px 12px;
            text-align: left;
        }}
        .metric-table th {{
            background-color: #F1F5F9;
            font-weight: bold;
            color: #334155;
        }}
        .chart-container {{
            text-align: center;
            margin-top: 15px;
            margin-bottom: 20px;
        }}
        .chart-img {{
            width: 95%;
            max-width: 600px;
        }}
        .section-title {{
            font-size: 14px;
            font-weight: bold;
            color: #4F46E5;
            border-left: 4px solid #4F46E5;
            padding-left: 8px;
            margin-top: 20px;
            margin-bottom: 10px;
        }}
        .reason-box {{
            background-color: #EFF6FF;
            border-left: 4px solid #3B82F6;
            padding: 10px 14px;
            margin-top: 10px;
            border-radius: 0 6px 6px 0;
            color: #1E3A8A;
        }}
        .footer {{
            margin-top: 30px;
            border-top: 1px solid #E2E8F0;
            padding-top: 10px;
            font-size: 10px;
            color: #94A3B8;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="title">📊 Product Opportunity Research Report</div>
        <div class="subtitle">Generated by DeepAgents Orchestrator • Printway POD R&D Decision Engine</div>
    </div>

    <div class="score-card">
        <table width="100%">
            <tr>
                <td>
                    <div style="font-size: 14px; font-weight: bold;">{evaluation.get('evaluated_listing', 'Custom POD Listing')}</div>
                    <div style="margin-top: 6px;">
                        <span class="badge">{rec}</span>
                        <span style="font-weight: bold; color: #4F46E5; margin-left: 10px;">Opportunity Score: {score}/100</span>
                    </div>
                </td>
            </tr>
        </table>
        <div class="reason-box">
            <strong>Strategic Summary:</strong> {evaluation.get('summary_reason', 'High market demand combined with favorable manufacturing fit.')}
        </div>
    </div>

    <div class="section-title">1. 5-Dimensional Opportunity Visual Breakdown</div>
    <div class="chart-container">
        <img class="chart-img" src="data:image/png;base64,{chart_base64}" />
    </div>

    <div class="section-title">2. Detailed Dimensional Metrics</div>
    <table class="metric-table">
        <tr>
            <th>Dimension</th>
            <th>Score</th>
            <th>Weight</th>
            <th>Explanation & Key Metrics</th>
        </tr>
        <tr>
            <td><strong>Demand Strength</strong></td>
            <td>{breakdown.get('demand', {}).get('score', 0)}/100</td>
            <td>25%</td>
            <td>{breakdown.get('demand', {}).get('reason', 'N/A')}</td>
        </tr>
        <tr>
            <td><strong>Competition Density</strong></td>
            <td>{breakdown.get('competition', {}).get('score', 0)}/100</td>
            <td>20%</td>
            <td>{breakdown.get('competition', {}).get('reason', 'N/A')}</td>
        </tr>
        <tr>
            <td><strong>Growth Momentum</strong></td>
            <td>{breakdown.get('growth', {}).get('score', 0)}/100</td>
            <td>20%</td>
            <td>{breakdown.get('growth', {}).get('reason', 'N/A')}</td>
        </tr>
        <tr>
            <td><strong>Seasonality Window</strong></td>
            <td>{breakdown.get('seasonality', {}).get('score', 0)}/100</td>
            <td>15%</td>
            <td>{breakdown.get('seasonality', {}).get('reason', 'N/A')}</td>
        </tr>
        <tr>
            <td><strong>Personalization Potential</strong></td>
            <td>{breakdown.get('personalization', {}).get('score', 0)}/100</td>
            <td>10%</td>
            <td>{breakdown.get('personalization', {}).get('reason', 'N/A')}</td>
        </tr>
        <tr>
            <td><strong>Printway Manufacturing Fit</strong></td>
            <td>{breakdown.get('production_fit', {}).get('score', 0)}/100</td>
            <td>10%</td>
            <td>{breakdown.get('production_fit', {}).get('reason', 'N/A')}</td>
        </tr>
    </table>

    <div class="section-title">3. Actionable Launch Checklist</div>
    <ul>
        <li><strong>Week 1 (Design Setup)</strong>: Create 5-10 vector artwork templates based on top quotes.</li>
        <li><strong>Week 2 (SEO Listing)</strong>: Publish listings using normalized Printway tags.</li>
        <li><strong>Week 3 (Catalog Connection)</strong>: Link SKUs to Printway catalog fulfillment SLA.</li>
    </ul>

    <div class="footer">
        Confidential Document • Printway Fulfillment R&D Department • Generated with DeepAgents & Vilao AI
    </div>
</body>
</html>
"""
        return html_content

    def generate_pdf_report(self, evaluation: dict, filename: str = "product_opportunity_report.pdf") -> str:
        """Renders HTML and converts it to PDF saved on disk."""
        html_str = self.generate_html_report(evaluation)
        pdf_path = os.path.join(self.output_dir, filename)

        with open(pdf_path, "wb") as pdf_file:
            pisa_status = pisa.CreatePDF(html_str, dest=pdf_file)

        if pisa_status.err:
            raise Exception("PDF generation failed via xhtml2pdf")

        return pdf_path

if __name__ == "__main__":
    generator = PDFReportGenerator()
    test_eval = {
        "opportunity_score": 88.5,
        "recommendation": "RECOMMEND",
        "evaluated_listing": "Personalized Grandpa Gift Custom Shape Acrylic Ornament",
        "summary_reason": "High demand, low competitor density, and strong profit margins.",
        "breakdown": {
            "demand": {"score": 85.0, "reason": "Monthly searches: 18,500"},
            "competition": {"score": 75.0, "reason": "Active competitors: 140"},
            "growth": {"score": 88.0, "reason": "Google Trends: +45.2%"},
            "seasonality": {"score": 90.0, "reason": "Q2 & Q4 Peak"},
            "personalization": {"score": 95.0, "reason": "Custom names & photo upload"},
            "production_fit": {"score": 89.0, "reason": "Printway Acrylic Ornament"}
        }
    }
    pdf_out = generator.generate_pdf_report(test_eval)
    print("Generated PDF at:", pdf_out)
