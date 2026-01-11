from fpdf import FPDF
import os
from datetime import datetime

class PDFService:
    def ensure_directory(self):
        path = "app/static/reports"
        if not os.path.exists(path):
            os.makedirs(path)
        return path

    def generate_audit_pdf(self, data):
        # Placeholder for existing Audit logic
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        pdf.cell(200, 10, txt=f"Security Audit: {data.get('client_name')}", ln=1, align="C")
        return pdf

    def generate_invoice_pdf(self, invoice_data):
        self.ensure_directory()
        
        pdf = FPDF()
        pdf.add_page()
        
        # --- 1. HEADER & BRANDING ---
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(0, 10, "GST TAX INVOICE", ln=True, align='R')
        
        pdf.set_font("Arial", size=10)
        pdf.cell(0, 5, "Digital Sanctum Pty Ltd", ln=True, align='R')
        pdf.cell(0, 5, "ABN: 57 221 340 918", ln=True, align='R')
        pdf.ln(10)

        # --- 2. CLIENT & META ---
        raw_date = datetime.strptime(invoice_data['date'], "%Y-%m-%d")
        formatted_date = raw_date.strftime("%d-%m-%Y")

        pdf.set_font("Arial", 'B', 12)
        pdf.cell(0, 5, f"Bill To: {invoice_data['client_name']}", ln=True)
        pdf.set_font("Arial", size=10)
        pdf.cell(0, 5, f"Invoice #: {invoice_data['id'][:8]}", ln=True)
        pdf.cell(0, 5, f"Date: {formatted_date}", ln=True)
        pdf.ln(10)

        # --- 3. TABLE HEADER ---
        pdf.set_fill_color(240, 240, 240)
        pdf.set_font("Arial", 'B', 10)
        
        # Column Widths
        w_desc = 100
        w_qty = 20
        w_price = 30
        w_total = 40
        
        pdf.cell(w_desc, 8, "Description", 1, 0, 'L', 1)
        pdf.cell(w_qty, 8, "Qty", 1, 0, 'C', 1)
        pdf.cell(w_price, 8, "Unit Price", 1, 0, 'R', 1)
        pdf.cell(w_total, 8, "Total", 1, 1, 'R', 1)

        # --- 4. TABLE BODY (DYNAMIC WRAPPING) ---
        pdf.set_font("Arial", size=9)
        
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
            pdf.multi_cell(w_desc, 5, desc, border=1)
            
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
        pdf.set_font("Arial", size=10)
        pdf.cell(150, 8, "Subtotal", 0, 0, 'R')
        pdf.cell(40, 8, f"${invoice_data['subtotal']:.2f}", 1, 1, 'R')
        
        pdf.cell(150, 8, "GST (10%)", 0, 0, 'R')
        pdf.cell(40, 8, f"${invoice_data['gst']:.2f}", 1, 1, 'R')
        
        pdf.set_font("Arial", 'B', 12)
        pdf.cell(150, 10, "Total", 0, 0, 'R')
        pdf.cell(40, 10, f"${invoice_data['total']:.2f}", 1, 1, 'R')

        # --- 6. FOOTER ---
        pdf.ln(20)
        pdf.set_font("Arial", 'I', 8)
        
        terms = invoice_data.get('payment_terms', 'Net 14 Days')
        pdf.cell(0, 5, f"Payment Terms: {terms}", ln=True)
        pdf.cell(0, 5, "Bank: Sanctum Bank | BSB: 063 010 | ACC: 1149 9520", ln=True)

        return pdf

pdf_engine = PDFService()