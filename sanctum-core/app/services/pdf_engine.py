from fpdf import FPDF
from datetime import datetime

class SanctumPDF(FPDF):
    def header(self):
        # Dark Background for Header
        self.set_fill_color(15, 23, 42) # Slate 900
        self.rect(0, 0, 210, 40, 'F')
        
        # Logo Text (Simulated Logo)
        self.set_font('Helvetica', 'B', 20)
        self.set_text_color(251, 191, 36) # Sanctum Gold
        self.cell(0, 15, 'DIGITAL SANCTUM', 0, 1, 'L')
        
        # Subtitle
        self.set_font('Helvetica', '', 10)
        self.set_text_color(255, 255, 255)
        self.cell(0, 5, 'Sovereign Technology Audit', 0, 1, 'L')
        self.ln(20)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def generate_audit_pdf(audit_data, filename="report.pdf"):
    pdf = SanctumPDF()
    pdf.add_page()
    
    # 1. SCORES SECTION
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 10, f"Audit Report for: {audit_data.get('client_name', 'Client')}", 0, 1)
    
    pdf.ln(10)
    
    # Draw Score Boxes
    pdf.set_fill_color(241, 245, 249) # Slate 100
    pdf.rect(10, 60, 90, 40, 'F')
    pdf.rect(110, 60, 90, 40, 'F')
    
    # Security Score
    pdf.set_xy(10, 65)
    pdf.set_font('Helvetica', '', 12)
    pdf.cell(90, 10, 'Security Risk Score', 0, 1, 'C')
    pdf.set_font('Helvetica', 'B', 24)
    # Color logic
    sec_score = audit_data.get('security_score', 0)
    if sec_score < 50: pdf.set_text_color(220, 38, 38) # Red
    elif sec_score < 80: pdf.set_text_color(217, 119, 6) # Amber
    else: pdf.set_text_color(22, 163, 74) # Green
    
    pdf.cell(90, 20, f"{sec_score}/100", 0, 1, 'C')
    
    # Infrastructure Score
    pdf.set_xy(110, 65)
    pdf.set_text_color(15, 23, 42) # Reset
    pdf.set_font('Helvetica', '', 12)
    pdf.cell(90, 10, 'Infrastructure Health', 0, 1, 'C')
    pdf.set_font('Helvetica', 'B', 24)
    pdf.cell(90, 20, f"{audit_data.get('infrastructure_score', 0)}/100", 0, 1, 'C')
    
    pdf.ln(30)
    
    # 2. FINDINGS TABLE
    pdf.set_text_color(15, 23, 42)
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 10, 'Strategic Findings', 0, 1)
    pdf.ln(5)
    
    # Table Header
    pdf.set_fill_color(51, 65, 85) # Slate 700
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(40, 10, 'Category', 1, 0, 'C', True)
    pdf.cell(60, 10, 'Item', 1, 0, 'C', True)
    pdf.cell(30, 10, 'Status', 1, 0, 'C', True)
    pdf.cell(60, 10, 'Analysis', 1, 1, 'C', True)
    
    # Rows
    pdf.set_text_color(15, 23, 42)
    pdf.set_font('Helvetica', '', 9)
    
    items = audit_data.get('content', {}).get('items', [])
    
    for item in items:
        # Status Color Logic
        status = item.get('status', 'green').lower()
        if status == 'red':
            pdf.set_text_color(220, 38, 38)
        elif status == 'amber':
            pdf.set_text_color(217, 119, 6)
        else:
            pdf.set_text_color(22, 163, 74)
            
        pdf.cell(40, 10, item.get('category', ''), 1)
        pdf.cell(60, 10, item.get('item', ''), 1)
        pdf.cell(30, 10, status.upper(), 1, 0, 'C')
        
        pdf.set_text_color(15, 23, 42) # Reset for comment
        pdf.cell(60, 10, item.get('comment', ''), 1, 1)

    return pdf