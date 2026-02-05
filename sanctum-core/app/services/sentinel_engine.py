import asyncio
import socket
import ssl
import requests
import dns.resolver
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from datetime import datetime

class SentinelEngine:
    def __init__(self):
        self.results = []

    async def perform_scan(self, url: str):
        if not url.startswith(('http://', 'https://')):
            url = f'https://{url}'
        domain = url.replace("https://", "").replace("http://", "").split('/')[0].strip()

        # 1. THE LEGACY RECON (Restoring what was "lost")
        self._run_network_pass(domain)
        self._run_dns_pass(domain)

        # 2. THE DEEP SCAN (Playwright)
        async with async_playwright() as p:
            try:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(ignore_https_errors=True)
                page = await context.new_page()
                
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                content = await page.content()
                soup = BeautifulSoup(content, 'html.parser')
                
                # SEO Infiltration
                title = soup.title.string if soup.title else "Missing Title"
                self._add_item("SEO", "Page Title", "Green" if len(title) > 10 else "Amber", f"Title: {title}")
                
                # Tech Stack Recon
                platform = "Shopify" if "cdn.shopify.com" in content else "Custom CMS"
                self._add_item("Tech Stack", "Platform", "Green", platform)

                # Performance (Core Web Vitals)
                try:
                    fcp = await page.evaluate("performance.getEntriesByName('first-contentful-paint')[0].startTime")
                    self._add_item("Performance", "First Paint", "Green" if fcp < 2000 else "Amber", f"{round(fcp)}ms")
                except:
                    self._add_item("Performance", "First Paint", "Amber", "Metrics inhibited by browser")

                await browser.close()
            except Exception as e:
                self._add_item("System", "Browser Pass", "Red", f"Handshake failed: {str(e)}")

        return self.results

    def _add_item(self, category, item, status, comment):
        self.results.append({"category": category, "item": item, "status": status, "comment": str(comment)})

    def _run_network_pass(self, domain):
        try:
            r = requests.get(f"https://{domain}", timeout=10)
            h = r.headers
            self._add_item("Headers", "HSTS", "Green" if 'Strict-Transport-Security' in h else "Amber", "Downgrade protection check")
            self._add_item("Headers", "X-Frame-Options", "Green" if 'X-Frame-Options' in h else "Amber", "Clickjacking protection check")
        except: pass

    def _run_dns_pass(self, domain):
        try:
            mx = dns.resolver.resolve(domain, 'MX')
            self._add_item("DNS", "MX Records", "Green", f"Found {len(mx)} mail servers")
            txt = dns.resolver.resolve(domain, 'TXT')
            spf = any("v=spf1" in str(r) for r in txt)
            self._add_item("DNS", "SPF Record", "Green" if spf else "Red", "SPF verified" if spf else "Missing SPF (Spoofing risk)")
        except: pass