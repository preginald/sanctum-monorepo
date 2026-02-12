import os
import sys
import uuid
from datetime import datetime

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Vendor, Base
from app.database import SQLALCHEMY_DATABASE_URL

# Setup DB Connection
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

"""
PHASE 62: Comprehensive Vendor Catalog Seed Data
Run this after creating the vendors table: python -m app.seed_vendors
"""

VENDOR_SEED_DATA = [
    # ========================================
    # SAAS PLATFORMS (80+ entries)
    # ========================================
    
    # Productivity & Collaboration
    {
        'name': 'Microsoft 365',
        'category': 'saas',
        'website': 'https://www.microsoft.com/microsoft-365',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'base_price_aud': 12.50,
        'description': 'Cloud productivity suite with Office apps, OneDrive, Teams',
        'tags': ['productivity', 'collaboration', 'enterprise', 'popular']
    },
    {
        'name': 'Google Workspace',
        'category': 'saas',
        'website': 'https://workspace.google.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'base_price_aud': 9.60,
        'description': 'Gmail, Drive, Docs, Meet, Calendar for business',
        'tags': ['productivity', 'collaboration', 'popular']
    },
    {
        'name': 'Zoho Workplace',
        'category': 'saas',
        'website': 'https://www.zoho.com/workplace',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Email, docs, chat, and collaboration tools',
        'tags': ['productivity', 'sme']
    },
    {
        'name': 'Slack',
        'category': 'saas',
        'website': 'https://slack.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'base_price_aud': 10.25,
        'description': 'Team messaging and collaboration platform',
        'tags': ['collaboration', 'messaging', 'popular']
    },
    {
        'name': 'Microsoft Teams',
        'category': 'saas',
        'website': 'https://www.microsoft.com/microsoft-teams',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Video meetings, chat, file collaboration',
        'tags': ['collaboration', 'video', 'popular']
    },
    {
        'name': 'Zoom',
        'category': 'saas',
        'website': 'https://zoom.us',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Video conferencing and webinars',
        'tags': ['video', 'meetings', 'popular']
    },
    
    # Accounting & Finance (Australian focus)
    {
        'name': 'Xero',
        'category': 'saas',
        'website': 'https://www.xero.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'base_price_aud': 32.00,
        'description': 'Cloud accounting software',
        'tags': ['accounting', 'australian', 'popular', 'sme']
    },
    {
        'name': 'MYOB',
        'category': 'saas',
        'website': 'https://www.myob.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'base_price_aud': 27.00,
        'description': 'Australian accounting and business management',
        'tags': ['accounting', 'australian', 'popular']
    },
    {
        'name': 'QuickBooks Online',
        'category': 'saas',
        'website': 'https://quickbooks.intuit.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Cloud accounting for small business',
        'tags': ['accounting', 'sme']
    },
    {
        'name': 'Reckon',
        'category': 'saas',
        'website': 'https://www.reckon.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Australian accounting software',
        'tags': ['accounting', 'australian']
    },
    {
        'name': 'FreshBooks',
        'category': 'saas',
        'website': 'https://www.freshbooks.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Invoicing and accounting for service businesses',
        'tags': ['accounting', 'invoicing', 'sme']
    },
    
    # CRM & Sales
    {
        'name': 'Salesforce',
        'category': 'saas',
        'website': 'https://www.salesforce.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'base_price_aud': 50.00,
        'description': 'Enterprise CRM platform',
        'tags': ['crm', 'enterprise', 'popular']
    },
    {
        'name': 'HubSpot',
        'category': 'saas',
        'website': 'https://www.hubspot.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'CRM, marketing, and sales platform',
        'tags': ['crm', 'marketing', 'popular']
    },
    {
        'name': 'Pipedrive',
        'category': 'saas',
        'website': 'https://www.pipedrive.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Sales CRM for small teams',
        'tags': ['crm', 'sales', 'sme']
    },
    {
        'name': 'Zoho CRM',
        'category': 'saas',
        'website': 'https://www.zoho.com/crm',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Comprehensive CRM solution',
        'tags': ['crm', 'sme']
    },
    
    # Project Management
    {
        'name': 'Asana',
        'category': 'saas',
        'website': 'https://asana.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Work management and team collaboration',
        'tags': ['project_management', 'popular']
    },
    {
        'name': 'Monday.com',
        'category': 'saas',
        'website': 'https://monday.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Work operating system for teams',
        'tags': ['project_management', 'popular']
    },
    {
        'name': 'Trello',
        'category': 'saas',
        'website': 'https://trello.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Kanban-style project boards',
        'tags': ['project_management', 'sme']
    },
    {
        'name': 'Jira',
        'category': 'saas',
        'website': 'https://www.atlassian.com/software/jira',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Project tracking for software teams',
        'tags': ['project_management', 'development']
    },
    {
        'name': 'ClickUp',
        'category': 'saas',
        'website': 'https://clickup.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'All-in-one productivity platform',
        'tags': ['project_management']
    },
    
    # Marketing & Email
    {
        'name': 'Mailchimp',
        'category': 'saas',
        'website': 'https://mailchimp.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'usage_based',
        'description': 'Email marketing and automation',
        'tags': ['marketing', 'email', 'popular']
    },
    {
        'name': 'ActiveCampaign',
        'category': 'saas',
        'website': 'https://www.activecampaign.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'usage_based',
        'description': 'Email marketing automation',
        'tags': ['marketing', 'email']
    },
    {
        'name': 'Campaign Monitor',
        'category': 'saas',
        'website': 'https://www.campaignmonitor.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'usage_based',
        'description': 'Email marketing platform',
        'tags': ['marketing', 'email', 'australian']
    },
    
    # E-commerce
    {
        'name': 'Shopify',
        'category': 'saas',
        'website': 'https://www.shopify.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'base_price_aud': 42.00,
        'description': 'E-commerce platform',
        'tags': ['ecommerce', 'popular']
    },
    {
        'name': 'WooCommerce',
        'category': 'saas',
        'website': 'https://woocommerce.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'flat_rate',
        'description': 'WordPress e-commerce plugin',
        'tags': ['ecommerce', 'wordpress']
    },
    {
        'name': 'BigCommerce',
        'category': 'saas',
        'website': 'https://www.bigcommerce.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Enterprise e-commerce platform',
        'tags': ['ecommerce']
    },
    
    # HR & Payroll (Australian)
    {
        'name': 'Employment Hero',
        'category': 'saas',
        'website': 'https://employmenthero.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Australian HR and payroll software',
        'tags': ['hr', 'payroll', 'australian', 'popular']
    },
    {
        'name': 'KeyPay',
        'category': 'saas',
        'website': 'https://keypay.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Cloud payroll software',
        'tags': ['payroll', 'australian']
    },
    {
        'name': 'BambooHR',
        'category': 'saas',
        'website': 'https://www.bamboohr.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'HR management software',
        'tags': ['hr']
    },
    
    # Field Service (Australian)
    {
        'name': 'Servicem8',
        'category': 'saas',
        'website': 'https://www.servicem8.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Job management for trade businesses',
        'tags': ['field_service', 'australian', 'trades']
    },
    {
        'name': 'simPRO',
        'category': 'saas',
        'website': 'https://www.simprogroup.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Job management for contractors',
        'tags': ['field_service', 'australian']
    },
    
    # Document Management
    {
        'name': 'DocuSign',
        'category': 'saas',
        'website': 'https://www.docusign.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Electronic signature platform',
        'tags': ['documents', 'esignature']
    },
    {
        'name': 'Adobe Sign',
        'category': 'saas',
        'website': 'https://www.adobe.com/sign.html',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'E-signature and document workflows',
        'tags': ['documents', 'esignature']
    },
    {
        'name': 'Dropbox Business',
        'category': 'saas',
        'website': 'https://www.dropbox.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Cloud file storage and sharing',
        'tags': ['storage', 'collaboration']
    },
    {
        'name': 'Box',
        'category': 'saas',
        'website': 'https://www.box.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Enterprise content management',
        'tags': ['storage', 'enterprise']
    },
    
    # Design & Creative
    {
        'name': 'Adobe Creative Cloud',
        'category': 'saas',
        'website': 'https://www.adobe.com/creativecloud.html',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'base_price_aud': 76.99,
        'description': 'Creative software suite',
        'tags': ['design', 'creative']
    },
    {
        'name': 'Canva Pro',
        'category': 'saas',
        'website': 'https://www.canva.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Graphic design platform',
        'tags': ['design', 'australian', 'popular']
    },
    {
        'name': 'Figma',
        'category': 'saas',
        'website': 'https://www.figma.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Collaborative interface design',
        'tags': ['design', 'collaboration']
    },
    
    # ========================================
    # ANTIVIRUS & ENDPOINT SECURITY (30+ entries)
    # ========================================
    
    # Enterprise EDR/XDR
    {
        'name': 'CrowdStrike Falcon',
        'category': 'antivirus',
        'website': 'https://www.crowdstrike.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Cloud-native endpoint protection platform',
        'tags': ['enterprise', 'edr', 'popular']
    },
    {
        'name': 'SentinelOne',
        'category': 'antivirus',
        'website': 'https://www.sentinelone.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'AI-powered endpoint security',
        'tags': ['enterprise', 'edr']
    },
    {
        'name': 'Sophos Intercept X',
        'category': 'antivirus',
        'website': 'https://www.sophos.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Next-gen endpoint protection',
        'tags': ['enterprise', 'sme', 'popular']
    },
    {
        'name': 'Trend Micro Apex One',
        'category': 'antivirus',
        'website': 'https://www.trendmicro.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Advanced threat protection',
        'tags': ['enterprise', 'popular']
    },
    {
        'name': 'Palo Alto Cortex XDR',
        'category': 'antivirus',
        'website': 'https://www.paloaltonetworks.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Extended detection and response',
        'tags': ['enterprise', 'xdr']
    },
    {
        'name': 'Carbon Black',
        'category': 'antivirus',
        'website': 'https://www.vmware.com/products/carbon-black.html',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Endpoint protection by VMware',
        'tags': ['enterprise', 'edr']
    },
    
    # SMB Antivirus
    {
        'name': 'ESET Endpoint Protection',
        'category': 'antivirus',
        'website': 'https://www.eset.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Multi-layered endpoint security',
        'tags': ['sme', 'popular']
    },
    {
        'name': 'Bitdefender GravityZone',
        'category': 'antivirus',
        'website': 'https://www.bitdefender.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Business security platform',
        'tags': ['sme', 'enterprise']
    },
    {
        'name': 'Kaspersky Endpoint Security',
        'category': 'antivirus',
        'website': 'https://www.kaspersky.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Endpoint protection for business',
        'tags': ['sme']
    },
    {
        'name': 'McAfee Endpoint Security',
        'category': 'antivirus',
        'website': 'https://www.mcafee.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Comprehensive endpoint protection',
        'tags': ['enterprise', 'sme']
    },
    {
        'name': 'Norton Small Business',
        'category': 'antivirus',
        'website': 'https://au.norton.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'flat_rate',
        'description': 'Antivirus for small business',
        'tags': ['sme']
    },
    {
        'name': 'Avast Business Antivirus',
        'category': 'antivirus',
        'website': 'https://www.avast.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Business security solution',
        'tags': ['sme']
    },
    {
        'name': 'AVG Business',
        'category': 'antivirus',
        'website': 'https://www.avg.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Antivirus for business',
        'tags': ['sme']
    },
    {
        'name': 'Malwarebytes for Business',
        'category': 'antivirus',
        'website': 'https://www.malwarebytes.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Anti-malware protection',
        'tags': ['sme']
    },
    
    # Built-in / Free
    {
        'name': 'Windows Defender',
        'category': 'antivirus',
        'website': 'https://www.microsoft.com/windows/comprehensive-security',
        'typical_renewal_cycle': 0,
        'typical_pricing_model': 'included',
        'description': 'Built-in Windows security',
        'tags': ['built_in', 'free']
    },
    {
        'name': 'Microsoft Defender for Endpoint',
        'category': 'antivirus',
        'website': 'https://www.microsoft.com/security/business/endpoint-security',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Enterprise endpoint protection',
        'tags': ['enterprise', 'microsoft']
    },
    
    # ========================================
    # AUSTRALIAN DOMAIN REGISTRARS (20+ entries)
    # ========================================
    
    {
        'name': 'VentraIP',
        'category': 'registrar',
        'website': 'https://ventraip.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'base_price_aud': 16.50,
        'support_email': 'support@ventraip.com.au',
        'description': 'Australian domain registrar and hosting',
        'tags': ['australian', 'popular', 'hosting']
    },
    {
        'name': 'Crazy Domains',
        'category': 'registrar',
        'website': 'https://www.crazydomains.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Domain registration and web hosting',
        'tags': ['australian', 'popular']
    },
    {
        'name': 'NetRegistry',
        'category': 'registrar',
        'website': 'https://www.netregistry.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Australian domain and hosting provider',
        'tags': ['australian']
    },
    {
        'name': 'Melbourne IT',
        'category': 'registrar',
        'website': 'https://www.melbourneit.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Enterprise domain and digital services',
        'tags': ['australian', 'enterprise']
    },
    {
        'name': 'TPP Wholesale',
        'category': 'registrar',
        'website': 'https://www.tppwholesale.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Wholesale domain registration',
        'tags': ['australian', 'wholesale']
    },
    {
        'name': 'Synergy Wholesale',
        'category': 'registrar',
        'website': 'https://synergywholesale.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Wholesale domains and hosting',
        'tags': ['australian', 'wholesale']
    },
    {
        'name': 'Digital Pacific',
        'category': 'registrar',
        'website': 'https://www.digitalpacific.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Australian web hosting and domains',
        'tags': ['australian']
    },
    {
        'name': 'Hosting Australia',
        'category': 'registrar',
        'website': 'https://hostingaustralia.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Australian domain registration',
        'tags': ['australian']
    },
    {
        'name': 'Ventranet',
        'category': 'registrar',
        'website': 'https://www.ventranet.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Australian ISP and domain services',
        'tags': ['australian']
    },
    {
        'name': 'Register Direct',
        'category': 'registrar',
        'website': 'https://www.registerdirect.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Discount domain registration',
        'tags': ['australian']
    },
    {
        'name': 'Dreamscape',
        'category': 'registrar',
        'website': 'https://www.dreamscape.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Domain and hosting services',
        'tags': ['australian']
    },
    {
        'name': 'Zuver',
        'category': 'registrar',
        'website': 'https://zuver.net.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Australian domain registrar',
        'tags': ['australian']
    },
    
    # International (but commonly used in Australia)
    {
        'name': 'GoDaddy',
        'category': 'registrar',
        'website': 'https://www.godaddy.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Global domain registrar',
        'tags': ['international', 'popular']
    },
    {
        'name': 'Namecheap',
        'category': 'registrar',
        'website': 'https://www.namecheap.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'Affordable domain registration',
        'tags': ['international']
    },
    {
        'name': 'Cloudflare Registrar',
        'category': 'registrar',
        'website': 'https://www.cloudflare.com/products/registrar',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_domain',
        'description': 'At-cost domain registration',
        'tags': ['international', 'security']
    },
    
    # ========================================
    # HOSTING PROVIDERS (40+ entries)
    # ========================================
    
    # Australian Hosting
    {
        'name': 'VentraIP Australia',
        'category': 'hosting',
        'website': 'https://ventraip.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Australian web hosting',
        'tags': ['australian', 'popular', 'shared']
    },
    {
        'name': 'SiteGround',
        'category': 'hosting',
        'website': 'https://www.siteground.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Managed WordPress hosting',
        'tags': ['wordpress', 'popular']
    },
    {
        'name': 'Hosting Australia',
        'category': 'hosting',
        'website': 'https://hostingaustralia.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Australian web hosting',
        'tags': ['australian']
    },
    {
        'name': 'Zuver',
        'category': 'hosting',
        'website': 'https://zuver.net.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Australian cloud hosting',
        'tags': ['australian', 'cloud']
    },
    
    # Cloud Providers
    {
        'name': 'Amazon Web Services (AWS)',
        'category': 'hosting',
        'website': 'https://aws.amazon.com',
        'typical_renewal_cycle': 0,
        'typical_pricing_model': 'usage_based',
        'description': 'Cloud computing platform',
        'tags': ['cloud', 'enterprise', 'popular']
    },
    {
        'name': 'Microsoft Azure',
        'category': 'hosting',
        'website': 'https://azure.microsoft.com',
        'typical_renewal_cycle': 0,
        'typical_pricing_model': 'usage_based',
        'description': 'Cloud services platform',
        'tags': ['cloud', 'enterprise', 'popular']
    },
    {
        'name': 'Google Cloud Platform',
        'category': 'hosting',
        'website': 'https://cloud.google.com',
        'typical_renewal_cycle': 0,
        'typical_pricing_model': 'usage_based',
        'description': 'Cloud computing services',
        'tags': ['cloud', 'enterprise']
    },
    {
        'name': 'DigitalOcean',
        'category': 'hosting',
        'website': 'https://www.digitalocean.com',
        'typical_renewal_cycle': 0,
        'typical_pricing_model': 'usage_based',
        'description': 'Developer cloud platform',
        'tags': ['cloud', 'sme', 'popular']
    },
    {
        'name': 'Linode',
        'category': 'hosting',
        'website': 'https://www.linode.com',
        'typical_renewal_cycle': 0,
        'typical_pricing_model': 'usage_based',
        'description': 'Cloud hosting for developers',
        'tags': ['cloud', 'sme']
    },
    {
        'name': 'Vultr',
        'category': 'hosting',
        'website': 'https://www.vultr.com',
        'typical_renewal_cycle': 0,
        'typical_pricing_model': 'usage_based',
        'description': 'High performance cloud compute',
        'tags': ['cloud']
    },
    
    # WordPress Hosting
    {
        'name': 'WP Engine',
        'category': 'hosting',
        'website': 'https://wpengine.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Managed WordPress hosting',
        'tags': ['wordpress', 'enterprise']
    },
    {
        'name': 'Kinsta',
        'category': 'hosting',
        'website': 'https://kinsta.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Premium WordPress hosting',
        'tags': ['wordpress', 'premium']
    },
    {
        'name': 'Flywheel',
        'category': 'hosting',
        'website': 'https://getflywheel.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'WordPress hosting for agencies',
        'tags': ['wordpress']
    },
    
    # Shared/Budget Hosting
    {
        'name': 'Bluehost',
        'category': 'hosting',
        'website': 'https://www.bluehost.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Shared web hosting',
        'tags': ['shared', 'budget']
    },
    {
        'name': 'HostGator',
        'category': 'hosting',
        'website': 'https://www.hostgator.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Shared hosting provider',
        'tags': ['shared', 'budget']
    },
    {
        'name': 'DreamHost',
        'category': 'hosting',
        'website': 'https://www.dreamhost.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Web hosting and domains',
        'tags': ['shared']
    },
    
    # Email Hosting
    {
        'name': 'Microsoft Exchange Online',
        'category': 'hosting',
        'website': 'https://www.microsoft.com/microsoft-365/exchange',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Business email hosting',
        'tags': ['email', 'enterprise']
    },
    {
        'name': 'Google Workspace',
        'category': 'hosting',
        'website': 'https://workspace.google.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Gmail for business',
        'tags': ['email', 'popular']
    },
    {
        'name': 'Rackspace Email',
        'category': 'hosting',
        'website': 'https://www.rackspace.com/email-hosting',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Business email hosting',
        'tags': ['email']
    },
    {
        'name': 'Melbourne IT',
        'category': 'hosting',
        'website': 'https://www.melbourneit.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Enterprise-grade Australian hosting and domain management.',
        'tags': ['australian', 'enterprise', 'hosting']
    },
    {
        'name': 'Synergy Wholesale',
        'category': 'hosting',
        'website': 'https://synergywholesale.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'wholesale',
        'description': 'White-label Australian hosting and domain provisioning.',
        'tags': ['australian', 'wholesale', 'hosting']
    },
    {
        'name': 'Digital Sanctum',
        'category': 'hosting',
        'website': 'https://digitalsanctum.com.au',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'managed',
        'description': 'Secure, high-performance managed hosting solutions.',
        'tags': ['australian', 'managed', 'hosting', 'premium']
    },
    # --- ADDITIONAL HOSTING PROVIDERS (NON-DUPLICATES) ---
    {
        'name': 'Hetzner',
        'category': 'hosting',
        'website': 'https://www.hetzner.com',
        'typical_pricing_model': 'usage_based',
        'description': 'High-performance cloud and dedicated servers (EU/US).',
        'tags': ['cloud', 'dedicated', 'europe']
    },
    {
        'name': 'OVHcloud',
        'category': 'hosting',
        'website': 'https://www.ovhcloud.com',
        'typical_pricing_model': 'usage_based',
        'description': 'Global cloud infrastructure provider.',
        'tags': ['cloud', 'global', 'enterprise']
    },
    {
        'name': 'A2 Hosting',
        'category': 'hosting',
        'website': 'https://www.a2hosting.com',
        'typical_pricing_model': 'tiered',
        'description': 'High-speed shared and VPS hosting.',
        'tags': ['shared', 'speed']
    },
    {
        'name': 'Pantheon',
        'category': 'hosting',
        'website': 'https://pantheon.io',
        'typical_pricing_model': 'tiered',
        'description': 'WebOps platform for Drupal and WordPress.',
        'tags': ['wordpress', 'drupal', 'webops']
    },
    {
        'name': 'Liquid Web',
        'category': 'hosting',
        'website': 'https://www.liquidweb.com',
        'typical_pricing_model': 'managed',
        'description': 'Premium managed hosting and dedicated servers.',
        'tags': ['managed', 'premium', 'support']
    },
    
    # ========================================
    # BACKUP SOLUTIONS (20+ entries)
    # ========================================
    
    {
        'name': 'Backblaze',
        'category': 'backup',
        'website': 'https://www.backblaze.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'base_price_aud': 10.00,
        'description': 'Unlimited cloud backup',
        'tags': ['cloud', 'popular']
    },
    {
        'name': 'Carbonite',
        'category': 'backup',
        'website': 'https://www.carbonite.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Cloud backup for business',
        'tags': ['cloud', 'business']
    },
    {
        'name': 'Acronis Cyber Backup',
        'category': 'backup',
        'website': 'https://www.acronis.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Cyber protection and backup',
        'tags': ['enterprise', 'cyber']
    },
    {
        'name': 'Veeam Backup',
        'category': 'backup',
        'website': 'https://www.veeam.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Enterprise backup and recovery',
        'tags': ['enterprise', 'vmware']
    },
    {
        'name': 'Datto',
        'category': 'backup',
        'website': 'https://www.datto.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Business continuity and backup',
        'tags': ['enterprise', 'msp']
    },
    {
        'name': 'StorageCraft',
        'category': 'backup',
        'website': 'https://www.storagecraft.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Backup and disaster recovery',
        'tags': ['business']
    },
    {
        'name': 'IDrive',
        'category': 'backup',
        'website': 'https://www.idrive.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Cloud backup service',
        'tags': ['cloud', 'sme']
    },
    {
        'name': 'Microsoft OneDrive',
        'category': 'backup',
        'website': 'https://www.microsoft.com/microsoft-365/onedrive',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Cloud file sync and backup',
        'tags': ['cloud', 'microsoft', 'popular']
    },
    {
        'name': 'Google Drive',
        'category': 'backup',
        'website': 'https://www.google.com/drive',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Cloud storage and backup',
        'tags': ['cloud', 'google', 'popular']
    },
    {
        'name': 'Dropbox Business',
        'category': 'backup',
        'website': 'https://www.dropbox.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'File sync and backup',
        'tags': ['cloud', 'popular']
    },
    
    # ========================================
    # PASSWORD MANAGERS (15+ entries)
    # ========================================
    
    {
        'name': '1Password Business',
        'category': 'password_manager',
        'website': 'https://1password.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'base_price_aud': 11.99,
        'description': 'Password manager for teams',
        'tags': ['popular', 'business']
    },
    {
        'name': 'LastPass Business',
        'category': 'password_manager',
        'website': 'https://www.lastpass.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Enterprise password management',
        'tags': ['popular', 'enterprise']
    },
    {
        'name': 'Bitwarden',
        'category': 'password_manager',
        'website': 'https://bitwarden.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Open source password manager',
        'tags': ['open_source', 'sme']
    },
    {
        'name': 'Dashlane Business',
        'category': 'password_manager',
        'website': 'https://www.dashlane.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Password manager and security',
        'tags': ['business']
    },
    {
        'name': 'Keeper Business',
        'category': 'password_manager',
        'website': 'https://www.keepersecurity.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Zero-knowledge password security',
        'tags': ['enterprise', 'zero_knowledge']
    },
    {
        'name': 'NordPass Business',
        'category': 'password_manager',
        'website': 'https://nordpass.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Password manager for business',
        'tags': ['business']
    },
    {
        'name': 'RoboForm Business',
        'category': 'password_manager',
        'website': 'https://www.roboform.com/business',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Password and form manager',
        'tags': ['business']
    },
    
    # ========================================
    # FIREWALL & NETWORK SECURITY (25+ entries)
    # ========================================
    
    # Hardware Firewalls
    {
        'name': 'Fortinet FortiGate',
        'category': 'firewall',
        'website': 'https://www.fortinet.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Next-generation firewall',
        'tags': ['enterprise', 'hardware', 'popular']
    },
    {
        'name': 'Cisco Meraki',
        'category': 'firewall',
        'website': 'https://meraki.cisco.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Cloud-managed firewall',
        'tags': ['enterprise', 'cloud_managed', 'popular']
    },
    {
        'name': 'SonicWall',
        'category': 'firewall',
        'website': 'https://www.sonicwall.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Network security firewall',
        'tags': ['enterprise', 'hardware']
    },
    {
        'name': 'Palo Alto Networks',
        'category': 'firewall',
        'website': 'https://www.paloaltonetworks.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Enterprise firewall platform',
        'tags': ['enterprise', 'hardware']
    },
    {
        'name': 'WatchGuard',
        'category': 'firewall',
        'website': 'https://www.watchguard.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Unified security platform',
        'tags': ['sme', 'hardware']
    },
    {
        'name': 'pfSense',
        'category': 'firewall',
        'website': 'https://www.pfsense.org',
        'typical_renewal_cycle': 0,
        'typical_pricing_model': 'free',
        'description': 'Open source firewall',
        'tags': ['open_source', 'software']
    },
    {
        'name': 'Sophos XG Firewall',
        'category': 'firewall',
        'website': 'https://www.sophos.com/products/next-gen-firewall',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_device',
        'description': 'Next-gen firewall',
        'tags': ['enterprise', 'sme']
    },
    
    # Cloud Firewalls
    {
        'name': 'Cloudflare',
        'category': 'firewall',
        'website': 'https://www.cloudflare.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'tiered',
        'description': 'Web application firewall',
        'tags': ['cloud', 'waf', 'popular']
    },
    {
        'name': 'Zscaler',
        'category': 'firewall',
        'website': 'https://www.zscaler.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Cloud security platform',
        'tags': ['cloud', 'enterprise']
    },
    {
        'name': 'Perimeter 81',
        'category': 'firewall',
        'website': 'https://www.perimeter81.com',
        'typical_renewal_cycle': 12,
        'typical_pricing_model': 'per_user',
        'description': 'Zero trust network security',
        'tags': ['cloud', 'zero_trust']
    },
]

# Execution function
def seed():
    """Main seed function to populate the Vendor table with multi-category support."""
    # This recreates the dropped table with the new ARRAY schema
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    print("🌱 Seeding Vendor Catalog (Multi-Category Support)...")
    
    created_count = 0
    merged_count = 0
    
    try:
        for vendor_data in VENDOR_SEED_DATA:
            v_name = vendor_data['name']
            new_cat = vendor_data['category'] # The string category from your list

            existing = db.query(Vendor).filter(Vendor.name == v_name).first()
            
            if not existing:
                # First time seeing this vendor: wrap category in a list
                vendor_data['category'] = [new_cat]
                new_vendor = Vendor(
                    id=uuid.uuid4(),
                    created_at=datetime.utcnow(),
                    is_active=True,
                    **vendor_data
                )
                db.add(new_vendor)
                created_count += 1
            else:
                # Vendor exists: append the new category to the list if not already there
                current_categories = existing.category or []
                if new_cat not in current_categories:
                    # SQLAlchemy needs a new list object to detect the change
                    existing.category = current_categories + [new_cat]
                    merged_count += 1
            
            db.flush()

        db.commit()
        print(f"✅ Seeding Complete. Created: {created_count} | Merged/Updated: {merged_count}")
        
    except Exception as e:
        print(f"❌ Error during vendor seeding: {e}")
        db.rollback()
    finally:
        db.close()