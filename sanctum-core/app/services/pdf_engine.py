from fpdf import FPDF
import os
from datetime import datetime

class PDFService:
    def __init__(self):
        self.font_primary = 'DejaVu'
        self.color_primary = (10, 25, 47)  # Sanctum Dark Blue
        self.color_accent = (212, 175, 55) # Sanctum Gold

    def ensure_directory(self):
        path = "app/static/reports"
        if not os.path.exists(path):
            os.makedirs(path)
        return path

    def _header(self, pdf, title, client_name):
        pdf.set_fill_color(*self.color_primary)
        pdf.rect(0, 0, 210, 40, 'F')
        
        pdf.set_font(self.font_primary, 'B', 24)
        pdf.set_text_color(255, 255, 255)
        pdf.set_xy(10, 10)
        pdf.cell(0, 15, "DIGITAL SANCTUM", 0, 1, 'L')
        
        pdf.set_font(self.font_primary, '', 10)
        pdf.set_xy(10, 25)
        pdf.cell(0, 5, "ABN: 57 221 340 918", 0, 1, 'L')

        pdf.set_font(self.font_primary, 'B', 20)
        pdf.set_text_color(255, 255, 255)
        pdf.set_xy(100, 10)
        pdf.cell(100, 15, title, 0, 1, 'R')

        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(10, 50)

    def _setup_fonts(self, pdf):
        font_dir = "/usr/share/fonts/truetype/dejavu"
        pdf.add_font("DejaVu", "",  f"{font_dir}/DejaVuSans.ttf", uni=True)
        pdf.add_font("DejaVu", "B", f"{font_dir}/DejaVuSans-Bold.ttf", uni=True)
        pdf.add_font("DejaVu", "I", f"{font_dir}/DejaVuSans.ttf", uni=True)
        pdf.add_font("DejaVuMono", "",  f"{font_dir}/DejaVuSansMono.ttf", uni=True)
        pdf.add_font("DejaVuMono", "B", f"{font_dir}/DejaVuSansMono-Bold.ttf", uni=True)

    def generate_invoice_pdf(self, invoice_data):

        self.ensure_directory()
        
        pdf = FPDF()
        self._setup_fonts(pdf)
        pdf.add_page()
        
        # Determine Status robustly
        status = str(invoice_data.get('status', 'draft')).lower().strip()
        is_paid = status == 'paid'

        # HEADER
        title = "TAX RECEIPT" if is_paid else "TAX INVOICE"
        self._header(pdf, title, invoice_data['client_name'])

        # META DATA
        try:
            raw_date = datetime.strptime(invoice_data['date'], "%Y-%m-%d")
            formatted_date = raw_date.strftime("%d-%m-%Y")
        except ValueError:
            formatted_date = invoice_data['date']

        pdf.set_xy(10, 50)
        pdf.set_font(self.font_primary, 'B', 12)
        pdf.cell(0, 6, f"Bill To: {invoice_data['client_name']}", 0, 1, 'L')

        pdf.set_font(self.font_primary, '', 10)
        pdf.set_xy(140, 50)
        pdf.cell(30, 6, "Invoice #:", 0, 0, 'R')
        pdf.cell(30, 6, invoice_data['id'][:8].upper(), 0, 1, 'R')
        
        pdf.set_xy(140, 56)
        pdf.cell(30, 6, "Date:", 0, 0, 'R')
        pdf.cell(30, 6, formatted_date, 0, 1, 'R')

        # --- PAID STAMP ---
        if is_paid:
            # 1. Visual Stamp
            pdf.set_text_color(0, 150, 0) # Green
            pdf.set_font(self.font_primary, 'B', 30)
            pdf.set_xy(140, 75)
            pdf.cell(50, 15, "PAID", 1, 0, 'C')
            
            # 2. Payment Details
            pdf.set_font(self.font_primary, 'B', 9)
            pdf.set_xy(140, 90)
            
            paid_date_str = invoice_data.get('paid_at')
            if paid_date_str:
                try:
                    paid_date = datetime.strptime(paid_date_str, "%Y-%m-%d").strftime("%d-%m-%Y")
                    pdf.cell(50, 5, f"Date: {paid_date}", 0, 1, 'C')
                except: pass
            
            method = invoice_data.get('payment_method')
            if method:
                pdf.set_xy(140, 95)
                pdf.cell(50, 5, f"Via: {method.replace('_', ' ').title()}", 0, 1, 'C')
            
            pdf.set_text_color(0, 0, 0) # Reset

        pdf.ln(20)
        if pdf.get_y() < 110: pdf.set_y(110)

        # --- TABLE ---
        pdf.set_fill_color(240, 240, 240)
        pdf.set_font(self.font_primary, 'B', 10)
        
        w_desc, w_qty, w_price, w_total = 100, 20, 30, 40
        
        pdf.cell(w_desc, 8, "Description", 1, 0, 'L', True)
        pdf.cell(w_qty, 8, "Qty", 1, 0, 'C', True)
        pdf.cell(w_price, 8, "Unit Price", 1, 0, 'R', True)
        pdf.cell(w_total, 8, "Total", 1, 1, 'R', True)

        pdf.set_font(self.font_primary, size=9)
        
        for item in invoice_data['items']:
            desc = item['desc']
            qty = str(item['qty'])
            price = f"${float(item['price']):.2f}"
            total = f"${float(item['total']):.2f}"

            x_start, y_start = pdf.get_x(), pdf.get_y()
            pdf.multi_cell(w_desc, 6, desc, border=1)
            y_end = pdf.get_y()
            h_row = y_end - y_start
            
            pdf.set_xy(x_start + w_desc, y_start)
            pdf.cell(w_qty, h_row, qty, 1, 0, 'C')
            pdf.cell(w_price, h_row, price, 1, 0, 'R')
            pdf.cell(w_total, h_row, total, 1, 1, 'R')
            pdf.set_xy(x_start, y_end)

        pdf.ln(5)

        # --- TOTALS & BALANCE DUE ---
        x_start = 130
        pdf.set_font(self.font_primary, '', 10)
        
        pdf.set_x(x_start)
        pdf.cell(40, 6, "Subtotal:", 0, 0, 'R')
        pdf.cell(30, 6, f"${float(invoice_data['subtotal']):.2f}", 1, 1, 'R') 

        pdf.set_x(x_start)
        pdf.cell(40, 6, "GST (10%):", 0, 0, 'R')
        pdf.cell(30, 6, f"${float(invoice_data['gst']):.2f}", 1, 1, 'R')
        
        pdf.set_font(self.font_primary, 'B', 12)
        pdf.set_x(x_start)
        pdf.cell(40, 10, "Total (AUD):", 0, 0, 'R')
        pdf.cell(30, 10, f"${float(invoice_data['total']):.2f}", 1, 1, 'R')

        # BALANCE DUE
        if is_paid:
            pdf.set_text_color(0, 150, 0)
            pdf.set_x(x_start)
            pdf.cell(40, 10, "Amount Paid:", 0, 0, 'R')
            pdf.cell(30, 10, f"${float(invoice_data['total']):.2f}", 1, 1, 'R')
            
            pdf.set_text_color(0, 0, 0)
            pdf.set_x(x_start)
            pdf.cell(40, 10, "Balance Due:", 0, 0, 'R')
            pdf.cell(30, 10, "$0.00", 1, 1, 'R')
        else:
            pdf.set_x(x_start)
            pdf.cell(40, 10, "Balance Due:", 0, 0, 'R')
            pdf.cell(30, 10, f"${float(invoice_data['total']):.2f}", 1, 1, 'R')

        # FOOTER
        pdf.set_y(-60)
        pdf.set_font(self.font_primary, '', 10)
        pdf.cell(0, 6, "Payment Details:", 0, 1, 'L')
        pdf.set_font("DejaVuMono", '', 10)
        pdf.cell(0, 5, "Bank: Sanctum Bank", 0, 1, 'L')
        pdf.cell(0, 5, "BSB:  063 010", 0, 1, 'L')
        pdf.cell(0, 5, "ACC:  1149 9520", 0, 1, 'L')
        
        pdf.ln(5)
        pdf.set_font(self.font_primary, 'I', 9)
        terms = invoice_data.get('payment_terms', 'Net 14 Days')
        pdf.cell(0, 5, f"Terms: {terms}", 0, 1, 'L')

        return pdf

    def generate_article_pdf(self, article_data):
        """Generate a branded PDF from a wiki article using markdown -> HTML -> PDF."""
        import markdown
        from weasyprint import HTML
        
        self.ensure_directory()
        
        # Resolve template paths
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        template_dir = os.path.join(base_dir, 'templates', 'pdf')
        
        with open(os.path.join(template_dir, 'article.css'), 'r') as f:
            css = f.read()
        
        with open(os.path.join(template_dir, 'article.html'), 'r') as f:
            html_template = f.read()
        
        # Convert markdown to HTML
        md_content = article_data.get('content', '')
        html_body = markdown.markdown(md_content, extensions=['tables', 'fenced_code', 'codehilite', 'toc'])
        
        # Build meta line
        meta_parts = []
        if article_data.get('identifier'):
            meta_parts.append(f"Ref: {article_data['identifier']}")
        if article_data.get('version'):
            meta_parts.append(f"Version: {article_data['version']}")
        if article_data.get('author_name'):
            meta_parts.append(f"Author: {article_data['author_name']}")
        if article_data.get('updated_at'):
            meta_parts.append(f"Updated: {article_data['updated_at']}")
        
        meta_line = "  |  ".join(meta_parts)
        
        # Assemble
        full_html = html_template.replace('{{css}}', css)\
            .replace('{{title}}', article_data['title'])\
            .replace('{{meta}}', meta_line)\
            .replace('{{body}}', html_body)
        
        # Generate PDF
        static_dir = self.ensure_directory()
        identifier = article_data.get('identifier', 'doc').replace(' ', '_')
        filepath = os.path.join(static_dir, f"article_{identifier}.pdf")
        HTML(string=full_html).write_pdf(filepath)
        
        return filepath

# Instantiate as pdf_engine to match main.py imports
pdf_engine = PDFService()
