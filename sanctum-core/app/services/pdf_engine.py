from fpdf import FPDF
import os
from datetime import datetime

class PDFService:
    def __init__(self):
        self.font_primary = 'Helvetica'
        self.color_primary = (10, 25, 47)  # Sanctum Dark Blue
        self.color_accent = (212, 175, 55) # Sanctum Gold

    def ensure_directory(self):
        path = "app/static/reports"
        if not os.path.exists(path):
            os.makedirs(path)
        return path

    def _header(self, pdf, title, client_name):
        # Professional Colored Header
        pdf.set_fill_color(*self.color_primary)
        pdf.rect(0, 0, 210, 40, 'F')
        
        # Brand Name
        pdf.set_font(self.font_primary, 'B', 24)
        pdf.set_text_color(255, 255, 255)
        pdf.set_xy(10, 10)
        pdf.cell(0, 15, "DIGITAL SANCTUM", 0, 1, 'L')
        
        # ABN
        pdf.set_font(self.font_primary, '', 10)
        pdf.set_xy(10, 25)
        pdf.cell(0, 5, "ABN: 57 221 340 918", 0, 1, 'L')

        # Document Title (Right Aligned)
        pdf.set_font(self.font_primary, 'B', 20)
        pdf.set_text_color(255, 255, 255)
        pdf.set_xy(100, 10)
        pdf.cell(100, 15, title, 0, 1, 'R')

        # Reset Colors for Body
        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(10, 50)

    def generate_invoice_pdf(self, invoice_data):
        self.ensure_directory()
        
        pdf = FPDF()
        pdf.add_page()
        
        # --- 1. HEADER ---
        self._header(pdf, "TAX INVOICE", invoice_data['client_name'])

        # --- 2. META DATA ---
        raw_date = datetime.strptime(invoice_data['date'], "%Y-%m-%d")
        formatted_date = raw_date.strftime("%d-%m-%Y")

        # Client Info (Left)
        pdf.set_xy(10, 50)
        pdf.set_font(self.font_primary, 'B', 12)
        pdf.cell(0, 6, f"Bill To: {invoice_data['client_name']}", 0, 1, 'L')

        # Invoice Meta (Right)
        pdf.set_font(self.font_primary, '', 10)
        pdf.set_xy(140, 50)
        pdf.cell(30, 6, "Invoice #:", 0, 0, 'R')
        pdf.cell(30, 6, invoice_data['id'][:8], 0, 1, 'R')
        
        pdf.set_xy(140, 56)
        pdf.cell(30, 6, "Date:", 0, 0, 'R')
        pdf.cell(30, 6, formatted_date, 0, 1, 'R')

        pdf.ln(20)

        # --- 3. TABLE HEADER ---
        pdf.set_fill_color(240, 240, 240)
        pdf.set_font(self.font_primary, 'B', 10)
        
        # Column Widths
        w_desc = 100
        w_qty = 20
        w_price = 30
        w_total = 40
        
        pdf.cell(w_desc, 8, "Description", 1, 0, 'L', True)
        pdf.cell(w_qty, 8, "Qty", 1, 0, 'C', True)
        pdf.cell(w_price, 8, "Unit Price", 1, 0, 'R', True)
        pdf.cell(w_total, 8, "Total", 1, 1, 'R', True)

        # --- 4. TABLE BODY (DYNAMIC WRAPPING) ---
        pdf.set_font(self.font_primary, size=9)
        
        for item in invoice_data['items']:
            desc = item['desc']
            qty = str(item['qty'])
            price = f"${item['price']:.2f}"
            total = f"${item['total']:.2f}"

            # 1. Save current position
            x_start = pdf.get_x()
            y_start = pdf.get_y()
            
            # 2. Print Description (MultiCell allows wrapping)
            # We assume description is the tallest element
            pdf.multi_cell(w_desc, 6, desc, border=1)
            
            # 3. Calculate Row Height based on where the cursor ended up
            y_end = pdf.get_y()
            h_row = y_end - y_start
            
            # 4. Move cursor back to top-right of description to print other columns
            pdf.set_xy(x_start + w_desc, y_start)
            
            # 5. Print remaining columns with the CALCULATED height of the row
            pdf.cell(w_qty, h_row, qty, 1, 0, 'C')
            pdf.cell(w_price, h_row, price, 1, 0, 'R')
            pdf.cell(w_total, h_row, total, 1, 1, 'R')
            
            # 6. Move cursor to next line (below the MultiCell)
            pdf.set_xy(x_start, y_end)

        pdf.ln(5)

        # --- 5. TOTALS ---
        x_start = 130
        pdf.set_font(self.font_primary, '', 10)
        
        pdf.set_x(x_start)
        pdf.cell(40, 6, "Subtotal:", 0, 0, 'R')
        pdf.cell(30, 6, f"${invoice_data['subtotal']:.2f}", 1, 1, 'R') # Box for alignment check

        pdf.set_x(x_start)
        pdf.cell(40, 6, "GST (10%):", 0, 0, 'R')
        pdf.cell(30, 6, f"${invoice_data['gst']:.2f}", 1, 1, 'R')
        
        pdf.set_font(self.font_primary, 'B', 12)
        pdf.set_x(x_start)
        pdf.cell(40, 10, "Total (AUD):", 0, 0, 'R')
        pdf.cell(30, 10, f"${invoice_data['total']:.2f}", 1, 1, 'R')

        # --- 6. FOOTER ---
        pdf.set_y(-60)
        pdf.set_font(self.font_primary, '', 10)
        pdf.cell(0, 6, "Payment Details:", 0, 1, 'L')
        pdf.set_font("Courier", '', 10)
        pdf.cell(0, 5, "Bank: Sanctum Bank", 0, 1, 'L')
        pdf.cell(0, 5, "BSB:  063 010", 0, 1, 'L')
        pdf.cell(0, 5, "ACC:  1149 9520", 0, 1, 'L')
        
        pdf.ln(5)
        pdf.set_font(self.font_primary, 'I', 9)
        terms = invoice_data.get('payment_terms', 'Net 14 Days')
        pdf.cell(0, 5, f"Terms: {terms}", 0, 1, 'L')

        return pdf

    def generate_audit_pdf(self, audit_data: dict):
        self.ensure_directory()
        pdf = FPDF()
        pdf.add_page()
        
        # 1. HEADER
        self._header(pdf, "AUDIT REPORT", audit_data['client_name'])

        # 2. SCORES
        pdf.ln(10)
        pdf.set_font(self.font_primary, 'B', 14)
        pdf.cell(95, 10, f"Security Score: {audit_data['security_score']}/100", 1, 0, 'C')
        pdf.cell(95, 10, f"Infra Score: {audit_data['infrastructure_score']}/100", 1, 1, 'C')
        pdf.ln(15)

        # 3. CONTENT TABLE
        pdf.set_font(self.font_primary, 'B', 10)
        pdf.set_fill_color(240, 240, 240)
        
        w_cat = 40
        w_item = 50
        w_stat = 25
        w_comm = 75

        pdf.cell(w_cat, 8, "Category", 1, 0, 'L', True)
        pdf.cell(w_item, 8, "Item", 1, 0, 'L', True)
        pdf.cell(w_stat, 8, "Status", 1, 0, 'C', True)
        pdf.cell(w_comm, 8, "Comment", 1, 1, 'L', True)

        pdf.set_font(self.font_primary, '', 9)
        
        items = audit_data.get('content', {}).get('items', [])
        for item in items:
            # Color code status
            status = item.get('status', 'Green')
            pdf.set_text_color(0,0,0)
            
            # Simple Row (No Wrapping for Audit v1 to keep it simple, or add MultiCell logic if needed)
            pdf.cell(w_cat, 8, item.get('category', '')[:20], 1, 0, 'L')
            pdf.cell(w_item, 8, item.get('item', '')[:25], 1, 0, 'L')
            
            # Color the status text
            if status.lower() == 'red': pdf.set_text_color(200, 0, 0)
            elif status.lower() == 'amber': pdf.set_text_color(200, 150, 0)
            elif status.lower() == 'green': pdf.set_text_color(0, 150, 0)
            
            pdf.cell(w_stat, 8, status, 1, 0, 'C')
            
            pdf.set_text_color(0,0,0) # Reset
            comm = item.get('comment', '')
            if len(comm) > 40: comm = comm[:37] + "..."
            pdf.cell(w_comm, 8, comm, 1, 1, 'L')

        return pdf

# Instantiate as pdf_engine to match main.py imports
pdf_engine = PDFService()