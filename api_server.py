#!/usr/bin/env python3
"""Nordic Lead Finder API — BDR auth, lead claiming, ownership tracking, website scanning for B2C tyre ecommerce."""
import sqlite3, json, os, re
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# --- GOOGLE API PROXY (keeps API key server-side) ---
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

class GeocodeRequest(BaseModel):
    address: str

class PlacesSearchRequest(BaseModel):
    text_query: str
    latitude: float
    longitude: float
    radius: float

@app.post("/api/geocode")
async def proxy_geocode(req: GeocodeRequest):
    """Proxy geocoding requests to keep API key server-side."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="Google API key not configured")
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={req.address}&key={GOOGLE_API_KEY}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url)
        return resp.json()

@app.post("/api/places-search")
async def proxy_places_search(req: PlacesSearchRequest):
    """Proxy Google Places Text Search to keep API key server-side."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="Google API key not configured")
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.id,places.location,places.businessStatus"
    }
    body = {
        "textQuery": req.text_query,
        "locationBias": {
            "circle": {
                "center": {"latitude": req.latitude, "longitude": req.longitude},
                "radius": req.radius
            }
        }
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, headers=headers, json=body)
        return resp.json()


from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import httpx

DB_PATH = os.path.join(os.path.dirname(__file__), "leads.db")

BDR_LIST = [
    {"name": "Daniel Beihaghi", "email": "daniel.beihaghi@klipboard.com"},
    {"name": "Jennifer Lundmark", "email": "jennifer.lundmark@klipboard.com"},
    {"name": "Lovisa Persson", "email": "lovisa.persson@klipboard.com"},
    {"name": "Melina Nyberg", "email": "melina.nyberg@klipboard.com"},
    {"name": "Bhanu Chawla", "email": "bhanu.chawla@klipboard.com"}
]


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    db = get_db()
    db.execute("""CREATE TABLE IF NOT EXISTS claimed_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id TEXT NOT NULL UNIQUE,
        lead_name TEXT NOT NULL,
        lead_address TEXT DEFAULT '',
        lead_phone TEXT DEFAULT '',
        lead_website TEXT DEFAULT '',
        lead_score INTEGER DEFAULT 0,
        lead_category TEXT DEFAULT '',
        lead_size TEXT DEFAULT '',
        bdr_email TEXT NOT NULL,
        bdr_name TEXT NOT NULL,
        hubspot_status TEXT DEFAULT 'not_created',
        notes TEXT DEFAULT '',
        claimed_at TEXT NOT NULL
    )""")
    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str

class ClaimRequest(BaseModel):
    place_id: str
    lead_name: str
    lead_address: str = ""
    lead_phone: str = ""
    lead_website: str = ""
    lead_score: int = 0
    lead_category: str = ""
    lead_size: str = ""
    bdr_email: str
    bdr_name: str

class HubspotStatusUpdate(BaseModel):
    place_id: str
    hubspot_status: str  # not_created | created | synced
    bdr_email: str

class NoteUpdate(BaseModel):
    place_id: str
    notes: str
    bdr_email: str

class ScanWebsiteRequest(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Endpoints — Auth
# ---------------------------------------------------------------------------

@app.post("/api/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    bdr = next((b for b in BDR_LIST if b["email"].lower() == email), None)
    if not bdr:
        raise HTTPException(status_code=401, detail="Email not recognised. Please use your Klipboard email.")
    return {"name": bdr["name"], "email": bdr["email"]}


# ---------------------------------------------------------------------------
# Endpoints — Claims
# ---------------------------------------------------------------------------

@app.get("/api/claims")
def get_claims():
    db = get_db()
    rows = db.execute("SELECT * FROM claimed_leads ORDER BY claimed_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/api/claims/{bdr_email}")
def get_my_claims(bdr_email: str):
    db = get_db()
    rows = db.execute("SELECT * FROM claimed_leads WHERE bdr_email = ? ORDER BY claimed_at DESC", [bdr_email.lower()]).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.post("/api/claim", status_code=201)
def claim_lead(req: ClaimRequest):
    db = get_db()
    existing = db.execute("SELECT bdr_name, bdr_email FROM claimed_leads WHERE place_id = ?", [req.place_id]).fetchone()
    if existing:
        db.close()
        raise HTTPException(status_code=409, detail=f"Already claimed by {existing['bdr_name']}")
    db.execute(
        "INSERT INTO claimed_leads (place_id, lead_name, lead_address, lead_phone, lead_website, lead_score, lead_category, lead_size, bdr_email, bdr_name, claimed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [req.place_id, req.lead_name, req.lead_address, req.lead_phone, req.lead_website,
         req.lead_score, req.lead_category, req.lead_size, req.bdr_email.lower(), req.bdr_name,
         datetime.utcnow().isoformat()]
    )
    db.commit()
    db.close()
    return {"status": "claimed", "bdr_name": req.bdr_name}


@app.put("/api/hubspot-status")
def update_hubspot_status(req: HubspotStatusUpdate):
    db = get_db()
    row = db.execute("SELECT bdr_email FROM claimed_leads WHERE place_id = ?", [req.place_id]).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Lead not found")
    if row["bdr_email"] != req.bdr_email.lower():
        db.close()
        raise HTTPException(status_code=403, detail="Only the claiming BDR can update HubSpot status")
    db.execute("UPDATE claimed_leads SET hubspot_status = ? WHERE place_id = ?", [req.hubspot_status, req.place_id])
    db.commit()
    db.close()
    return {"status": "updated"}


@app.put("/api/notes")
def update_notes(req: NoteUpdate):
    db = get_db()
    row = db.execute("SELECT bdr_email FROM claimed_leads WHERE place_id = ?", [req.place_id]).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Lead not found")
    if row["bdr_email"] != req.bdr_email.lower():
        db.close()
        raise HTTPException(status_code=403, detail="Only the claiming BDR can update notes")
    db.execute("UPDATE claimed_leads SET notes = ? WHERE place_id = ?", [req.notes, req.place_id])
    db.commit()
    db.close()
    return {"status": "updated"}


# ---------------------------------------------------------------------------
# Website Scanning — Nordic Tyre Market Signals
# ---------------------------------------------------------------------------

ECOMMERCE_PLATFORMS = ['shopify', 'woocommerce', 'magento', 'bigcommerce', 'prestashop', 'opencart', 'woo-commerce']
TECH_STACK_BUILDERS = ['wordpress', 'wix', 'squarespace', 'weebly', 'godaddy', 'joomla', 'drupal', 'webflow']
ONLINE_ORDERING_SIGNALS = [
    'add to basket', 'add to cart', 'checkout', 'buy now', 'shop now',
    'online ordering', 'order online', 'e-commerce', 'ecommerce',
    'online store', 'web shop', 'webshop', 'nettbutikk', 'nätbutik',
    'verkkokauppa', 'netbutik', 'köp nu', 'kjøp nå', 'osta nyt',
    'lägg i varukorgen', 'legg i handlekurv', 'lisää ostoskoriin',
    'bestill nå', 'beställ nu', 'tilaa nyt', 'handla nu',
    'varukorg', 'handlekurv', 'ostoskori', 'indkøbskurv',
    'kassa', 'til kassen', 'till kassan', 'kassalle'
]

# Tyre-specific signals
TYRE_HOTEL_SIGNALS = [
    'tyre hotel', 'tire hotel', 'däckhotell', 'dekkhotell', 'rengashotelli',
    'dækhotel', 'seasonal storage', 'säsongsförvaring', 'sesonglagring',
    'kausivarastointi', 'sæsonopbevaring', 'däckförvaring', 'dekklagring',
    'rengasvarasto', 'dækopbevaring', 'vinterförvaring', 'vinterlagring',
    'winter storage', 'summer storage', 'hjulskifte', 'hjulbyte',
    'rengasvaihtö', 'hjulskift', 'tyre storage', 'tire storage'
]

TYRE_SEARCH_SIGNALS = [
    'tyre search', 'tire search', 'däcksök', 'dekksøk', 'rengashaku',
    'dæksøg', 'find your tyre', 'hitta däck', 'finn dekk', 'etsi rengas',
    'find dæk', 'vehicle lookup', 'reg lookup', 'registration lookup',
    'regnr', 'registreringsnummer', 'rekisterinumero', 'tyre finder',
    'däckhittare', 'dekkfinner', 'rengaslöytäjä', 'dækfinder',
    'välj fordon', 'velg kjøretøy', 'valitse ajoneuvo', 'vælg køretøj',
    'search by vehicle', 'search by size', 'sök däck', 'søk dekk'
]

TYRE_BRANDS = [
    'nokian', 'continental', 'michelin', 'bridgestone', 'goodyear',
    'pirelli', 'hankook', 'dunlop', 'yokohama', 'falken',
    'cooper', 'kumho', 'nexen', 'toyo', 'firestone',
    'bf goodrich', 'bfgoodrich', 'general tire', 'gislaved',
    'viking', 'kleber', 'matador', 'barum', 'semperit',
    'uniroyal', 'vredestein', 'sailun', 'nankang', 'westlake',
    'maxxis', 'triangle', 'laufenn', 'marshal'
]

NORDIC_PAYMENT_METHODS = {
    'klarna': ['klarna'],
    'vipps': ['vipps'],
    'mobilepay': ['mobilepay', 'mobile pay'],
    'swish': ['swish'],
    'nets': ['nets', 'netaxept'],
    'paytrail': ['paytrail'],
    'bambora': ['bambora'],
    'stripe': ['stripe'],
    'paypal': ['paypal']
}

MODERN_TECH_SIGNALS = [
    'react', 'angular', 'vue', 'next.js', 'nuxt', 'tailwind',
    'cloudflare', 'aws', 'stripe', 'google analytics', 'gtag',
    'hubspot', 'mailchimp', 'intercom', 'zendesk', 'freshdesk',
    'crm', 'erp', 'api', 'cdn', 'webpack', 'vite'
]

BASIC_SITE_SIGNALS = [
    'under construction', 'coming soon', 'website coming',
    'call us for', 'phone for prices', 'contact us for pricing',
    'email for quotes', 'last updated 20', 'under utveckling',
    'kommer snart', 'under utvikling', 'tulossa pian'
]

B2B_INDICATORS = [
    'trade account', 'wholesale', 'bulk order', 'bulk buy',
    'distributor', 'trade customer', 'trade price', 'b2b',
    'företagskund', 'bedriftskund', 'yritysasiakas', 'erhvervskunde',
    'grossist', 'tukkumyynti', 'engros', 'fleet', 'bilpark',
    'vagnpark', 'flåte', 'ajoneuvokalusto', 'flådestyring'
]

SOCIAL_PLATFORMS = {
    'facebook': ['facebook.com', 'fb.com'],
    'instagram': ['instagram.com'],
    'linkedin': ['linkedin.com'],
    'twitter': ['twitter.com', 'x.com'],
    'youtube': ['youtube.com'],
    'tiktok': ['tiktok.com']
}


def analyse_html(content: str, url: str) -> dict:
    """Analyse HTML content for digital readiness and Nordic tyre market signals."""
    lower = content.lower()
    results = {
        'digitalReadiness': 'low',
        'readinessScore': 0,
        'hasOnlineOrdering': False,
        'hasBasicSiteOnly': False,
        'ecommercePlatform': [],
        'techStack': [],
        'b2bIndicators': [],
        'socialMedia': {},
        'socialCount': 0,
        'multipleLocations': False,
        'hasSSL': url.startswith('https'),
        # Tyre-specific fields
        'hasTyreHotel': False,
        'tyreHotelSignals': [],
        'hasTyreSearch': False,
        'tyreSearchSignals': [],
        'tyreBrands': [],
        'paymentMethods': [],
        'signals': []
    }
    score = 0

    # --- Basic site signals (low digital maturity) ---
    basic_found = [s for s in BASIC_SITE_SIGNALS if s in lower]
    if basic_found:
        results['hasBasicSiteOnly'] = True
        results['signals'].append('Basic/outdated website detected')
    else:
        score += 10

    # --- Online ordering ---
    ordering = [s for s in ONLINE_ORDERING_SIGNALS if s in lower]
    if ordering:
        results['hasOnlineOrdering'] = True
        score += 25
        results['signals'].append('Online ordering/e-commerce capability detected')

    # --- E-commerce platform ---
    for p in ECOMMERCE_PLATFORMS:
        if p in lower:
            name = p.replace('woo-commerce', 'WooCommerce').capitalize()
            if p == 'woo-commerce':
                name = 'WooCommerce'
            results['ecommercePlatform'].append(name)
    results['ecommercePlatform'] = list(set(results['ecommercePlatform']))
    if results['ecommercePlatform']:
        score += 15
        results['signals'].append('E-commerce platform: ' + ', '.join(results['ecommercePlatform']))

    # --- Tech stack ---
    for t in MODERN_TECH_SIGNALS:
        if t in lower:
            results['techStack'].append(t.capitalize())
    for t in TECH_STACK_BUILDERS:
        if t in lower:
            results['techStack'].append(t.capitalize())
    results['techStack'] = list(set(results['techStack']))
    if results['techStack']:
        score += min(len(results['techStack']) * 5, 15)
        results['signals'].append('Tech detected: ' + ', '.join(results['techStack'][:5]))

    # --- Tyre hotel / seasonal storage ---
    hotel_found = [s for s in TYRE_HOTEL_SIGNALS if s in lower]
    if hotel_found:
        results['hasTyreHotel'] = True
        results['tyreHotelSignals'] = list(set(hotel_found))[:5]
        score += 5
        results['signals'].append('Tyre hotel / seasonal storage service detected')

    # --- Online tyre search / vehicle lookup ---
    search_found = [s for s in TYRE_SEARCH_SIGNALS if s in lower]
    if search_found:
        results['hasTyreSearch'] = True
        results['tyreSearchSignals'] = list(set(search_found))[:5]
        score += 10
        results['signals'].append('Online tyre search / vehicle lookup capability')

    # --- Tyre brands ---
    for brand in TYRE_BRANDS:
        if brand in lower:
            results['tyreBrands'].append(brand.capitalize() if brand != 'bf goodrich' and brand != 'bfgoodrich' else 'BF Goodrich')
    results['tyreBrands'] = list(set(results['tyreBrands']))
    if results['tyreBrands']:
        score += min(len(results['tyreBrands']) * 2, 10)
        results['signals'].append(f"{len(results['tyreBrands'])} tyre brand(s) mentioned: " + ', '.join(results['tyreBrands'][:6]))

    # --- Nordic payment methods ---
    for method, keywords in NORDIC_PAYMENT_METHODS.items():
        for kw in keywords:
            if kw in lower:
                results['paymentMethods'].append(method.capitalize())
                break
    results['paymentMethods'] = list(set(results['paymentMethods']))
    if results['paymentMethods']:
        score += min(len(results['paymentMethods']) * 5, 10)
        results['signals'].append('Payment methods: ' + ', '.join(results['paymentMethods']))

    # --- B2B indicators ---
    for ind in B2B_INDICATORS:
        if ind in lower:
            results['b2bIndicators'].append(ind)
    results['b2bIndicators'] = list(set(results['b2bIndicators']))
    if results['b2bIndicators']:
        score += 5
        results['signals'].append('B2B signals: ' + ', '.join(results['b2bIndicators'][:5]))

    # --- Social media ---
    for platform, urls in SOCIAL_PLATFORMS.items():
        found = False
        for u in urls:
            if u in lower:
                found = True
                break
        results['socialMedia'][platform] = found
    results['socialCount'] = sum(1 for v in results['socialMedia'].values() if v)
    if results['socialCount'] > 0:
        score += min(results['socialCount'] * 3, 10)
        platforms = [k for k, v in results['socialMedia'].items() if v]
        results['signals'].append('Social presence: ' + ', '.join(platforms))

    # --- Multiple locations ---
    location_words = [
        'branch', 'branches', 'depot', 'depots', 'warehouse', 'warehouses',
        'location', 'locations', 'store', 'stores', 'office', 'offices',
        'verkstad', 'verkstäder', 'verksted', 'filial', 'filialer',
        'butik', 'butiker', 'butikk', 'butikker', 'myymälä'
    ]
    for w in location_words:
        pattern = r'\b(multiple|several|our|våra|våre|meidän)\s+' + w + r'|\d+\s+' + w
        if re.search(pattern, lower, re.IGNORECASE):
            results['multipleLocations'] = True
            results['signals'].append('Multiple locations detected')
            break

    # --- SSL ---
    if results['hasSSL']:
        score += 5

    score = max(0, min(100, score))
    results['readinessScore'] = score
    if score >= 60:
        results['digitalReadiness'] = 'high'
    elif score >= 30:
        results['digitalReadiness'] = 'medium'
    else:
        results['digitalReadiness'] = 'low'

    return results


@app.post("/api/scan-website")
async def scan_website(req: ScanWebsiteRequest):
    """Fetch a website server-side and analyse it for digital readiness and Nordic tyre signals."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Ensure URL has scheme
    if not url.startswith('http'):
        url = 'https://' + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "sv-SE,sv;q=0.9,nb-NO;q=0.8,fi;q=0.7,da;q=0.6,en;q=0.5"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, verify=False) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text
    except httpx.TimeoutException:
        raise HTTPException(status_code=422, detail="Website timed out after 15 seconds")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=422, detail=f"Website returned HTTP {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch website: {str(e)}")

    results = analyse_html(html, url)
    return results


# ---------------------------------------------------------------------------
# Static files (for Railway deployment)
# ---------------------------------------------------------------------------

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
