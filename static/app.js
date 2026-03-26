/* ========================================
   Autowork eCommerce Lead Finder — Application Logic
   Nordic B2C Tyre E-Commerce Market
   ======================================== */

// ---- PRODUCT KNOWLEDGE (from autowork-ecommerce-product-knowledge.json) ----
const PRODUCT = {
  name: 'Autowork eCommerce',
  company: 'Klipboard',
  tagline: 'The Complete Online Tyre Shopping Experience',
  stat: 'Online tyre sales are the fastest growing channel in the tyre industry at 6% annual growth, with 55% of tyre buyers researching online before purchasing and 15% buying via internet (Goodyear/Continental research)',
  integrations: ['Workshop management systems', 'Klarna', 'Vipps', 'MobilePay', 'Swish']
};

const PERSONAS = {
  owner: {
    title: 'Business Owner / Shop Manager',
    painPoints: [
      "Missing online sales to competitors like Däckonline",
      "Seasonal revenue dips between tyre change seasons",
      "Managing tyre hotel inventory manually",
      "No online booking system for fitting appointments"
    ],
    cares: 'Capturing online customers, managing seasonal peaks, growing tyre hotel revenue',
    productHelps: 'Branded online tyre shop that captures the 55% of customers researching online, with integrated tyre hotel management',
    hook: 'capturing the customers who are already searching for tyres online',
    pitch: "Your customers are already searching for tyres online — 55% research digitally before buying. Autowork eCommerce lets you capture those customers with your own branded online tyre shop, without building anything from scratch."
  },
  workshopManager: {
    title: 'Workshop / Operations Manager',
    painPoints: [
      "Fitting appointments managed by phone only",
      "No visibility into tyre stock across locations",
      "Manual tyre hotel tracking with spreadsheets",
      "Customers asking for online price quotes"
    ],
    cares: 'Streamlining workshop scheduling, managing stock visibility, automating tyre hotel reminders',
    productHelps: 'Online booking flows into workshop schedule, tyre hotel customers get automated reminders, stock visibility is real-time',
    hook: 'eliminating double-entry and making your workshop schedule work for you online',
    pitch: "Autowork eCommerce integrates directly with your workshop operations — online booking flows into your schedule, tyre hotel customers get automated reminders, and stock visibility is real-time."
  },
  wholesaler: {
    title: 'Wholesaler / Distribution Manager',
    painPoints: [
      "Dealer network wants online ordering capability",
      "Losing market share to online-only retailers",
      "No B2C channel to complement B2B",
      "Complex pricing across dealer tiers"
    ],
    cares: 'Enabling dealer network with online presence, competing with online-only retailers, B2C channel development',
    productHelps: 'Every dealer in your network gets a branded storefront, connected to your catalogue and pricing — no development costs for them',
    hook: 'giving your dealer network the online capability they need to compete',
    pitch: "Your dealer network needs an online presence to compete. Autowork eCommerce gives every dealer in your network a branded storefront, connected to your catalogue and pricing — no development costs for them."
  }
};

const PAIN_POINTS = [
  { pain: 'Missing online sales', solution: 'Consumer-facing tyre search by vehicle reg or tyre size, with price comparison' },
  { pain: 'Seasonal revenue management', solution: 'Tyre hotel / seasonal storage management with automated reminders' },
  { pain: 'Manual booking process', solution: 'Online booking for fitting appointments integrated with workshop schedule' },
  { pain: 'No online price visibility', solution: 'Real-time pricing with brand comparison and online ordering' },
  { pain: 'Growing EV tyre demand', solution: 'EV and specialty tyre support with dedicated search filters' },
  { pain: 'Losing customers to chains', solution: 'Branded storefront with local service advantage, customer reviews and ratings' }
];

const MESSAGING_PILLARS = [
  { pillar: 'Capture Online Demand', detail: "15% of tyre buyers already purchase online. That number grows every year. Don't send them to Däckonline or Amazon." },
  { pillar: 'Tyre Hotel Made Digital', detail: 'Automate seasonal storage reminders, booking, and tracking. Turn your tyre hotel into a loyalty engine.' },
  { pillar: 'Nordic-First Design', detail: 'Built for the Nordic market — winter/summer tyre seasons, local payment methods (Klarna, Vipps, MobilePay), and local language support.' },
  { pillar: 'No Development Required', detail: 'Your branded tyre shop, live in days. No web agency, no IT team needed.' },
  { pillar: 'Workshop Integration', detail: 'Online bookings flow directly into your workshop schedule. No double-entry, no missed appointments.' }
];

// ---- API & BDR STATE ----
const API_BASE = '__PORT_8000__';
let currentBdr = null;  // { name, email }
let allClaims = [];     // All claimed leads from server

// ---- APP STATE (in-memory only — no browser storage APIs) ----
let state = {
  leads: [],
  outreachList: [],
  currentLocation: null,
  currentCoords: null,
  searchPhase: 0,
  selectedChannel: 'email',
  theme: 'light'
};

// ---- API CONFIG ----
// API key removed — all Google API calls go through backend proxy

// Search queries for different phases — Nordic tyre industry
const SEARCH_QUERIES_PHASE1 = [
  'tyre shop', 'tire shop', 'tyre fitting', 'auto workshop', 'car garage', 'tyre service'
];

const SEARCH_QUERIES_PHASE2 = [
  'tyre hotel', 'wheel alignment', 'tyre wholesaler', 'tyre distributor', 'seasonal tyre storage', 'car tyre centre'
];

// Country-specific local terms
const COUNTRY_LOCAL_TERMS = {
  sweden: ['däckverkstad', 'däckbutik', 'däckhotell', 'bilverkstad'],
  norway: ['dekkverksted', 'dekkbutikk', 'dekkhotell', 'bilverksted'],
  denmark: ['dækværksted', 'dækbutik', 'dækhotel', 'autoværksted'],
  finland: ['rengasliike', 'rengashotelli', 'autokorjaamo'],
  iceland: ['dekkjaverkstæði', 'bílaverkstæði']
};

// Country bias for geocoding
const COUNTRY_BIAS = {
  all: '',
  sweden: ',+Sweden',
  norway: ',+Norway',
  denmark: ',+Denmark',
  finland: ',+Finland',
  iceland: ',+Iceland'
};

const COUNTRY_REGION_BIAS = {
  all: '',
  sweden: '&region=se',
  norway: '&region=no',
  denmark: '&region=dk',
  finland: '&region=fi',
  iceland: '&region=is'
};

// --- CHAIN / LARGE BUSINESS DETECTION ---
const CHAIN_KEYWORDS = [
  'däckia', 'euromaster', 'vianor', 'dekkteam', 'dekkproff',
  'nordic tyre group', 'gummigrossen', 'rengasduo', 'dekk1',
  'mekonomen', 'automaster', 'abs wheels', 'pirelli', 'continental',
  'bridgestone', 'goodyear', 'nokian', 'michelin', 'firestone',
  'speedy', 'kwik fit', 'norauto', 'point s', 'driver center',
  'first stop', 'premio'
];

// ---- DOM ELEMENTS ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  // Hide app layout initially, show login
  document.querySelector('.app-layout').style.display = 'none';
  initLogin();
  initTheme();
  initNavigation();
  initSearch();
  initOutreach();
  initMobileNav();
});

// ---- BDR LOGIN ----
function initLogin() {
  const loginBtn = document.getElementById('loginBtn');
  const loginInput = document.getElementById('loginEmail');
  const loginError = document.getElementById('loginError');

  loginBtn.addEventListener('click', () => attemptLogin());
  loginInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });

  async function attemptLogin() {
    const email = loginInput.value.trim().toLowerCase();
    if (!email) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    loginError.style.display = 'none';

    try {
      const resp = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Login failed');
      }

      const data = await resp.json();
      currentBdr = { name: data.name, email: data.email };
      showApp();
      loadAllClaims();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.style.display = 'block';
    }

    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
}

function showApp() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.querySelector('.app-layout').style.display = 'grid';

  // Update user indicator
  const indicator = document.getElementById('userIndicator');
  indicator.style.display = 'flex';
  document.getElementById('userName').textContent = currentBdr.name;
  document.getElementById('userAvatar').textContent = currentBdr.name.split(' ').map(n => n[0]).join('');

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentBdr = null;
    allClaims = [];
    document.getElementById('loginOverlay').style.display = 'flex';
    document.querySelector('.app-layout').style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('userIndicator').style.display = 'none';
  });
}

async function loadAllClaims() {
  try {
    const resp = await fetch(`${API_BASE}/api/claims`);
    if (resp.ok) {
      allClaims = await resp.json();
      updateMyLeadsBadge();
    }
  } catch (err) {
    console.warn('Failed to load claims:', err);
  }
}

function updateMyLeadsBadge() {
  if (!currentBdr) return;
  const myCount = allClaims.filter(c => c.bdr_email === currentBdr.email).length;
  const badge = document.getElementById('myLeadsBadge');
  badge.textContent = myCount;
  badge.style.display = myCount > 0 ? 'inline' : 'none';
}

// ---- LEAD CLAIMING ----
async function claimLead(placeId) {
  if (!currentBdr) return;
  const lead = state.leads.find(l => l.id === placeId);
  if (!lead) return;

  try {
    const resp = await fetch(`${API_BASE}/api/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        place_id: lead.id,
        lead_name: lead.name,
        lead_address: lead.address,
        lead_phone: lead.phone,
        lead_website: lead.website,
        lead_score: lead.score,
        lead_category: lead.category,
        lead_size: lead.estimatedSize || '',
        bdr_email: currentBdr.email,
        bdr_name: currentBdr.name
      })
    });

    if (resp.status === 409) {
      const err = await resp.json();
      showToast(err.detail, 'error');
      return;
    }

    if (!resp.ok) throw new Error('Claim failed');

    showToast(`Claimed ${lead.name}`, 'success');
    await loadAllClaims();
    renderResults();
  } catch (err) {
    showToast('Failed to claim lead. Try again.', 'error');
  }
}

function getClaimForLead(placeId) {
  return allClaims.find(c => c.place_id === placeId);
}

// ---- HUBSPOT STATUS ----
async function updateHubspotStatus(placeId, newStatus) {
  if (!currentBdr) return;
  try {
    const resp = await fetch(`${API_BASE}/api/hubspot-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: placeId, hubspot_status: newStatus, bdr_email: currentBdr.email })
    });
    if (resp.ok) {
      await loadAllClaims();
      renderMyLeads();
      showToast('HubSpot status updated', 'success');
    }
  } catch (err) {
    showToast('Failed to update status', 'error');
  }
}

async function updateNotes(placeId, notes) {
  if (!currentBdr) return;
  try {
    const resp = await fetch(`${API_BASE}/api/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: placeId, notes: notes, bdr_email: currentBdr.email })
    });
    if (resp.ok) {
      await loadAllClaims();
      showToast('Notes saved', 'success');
    }
  } catch (err) {
    showToast('Failed to save notes', 'error');
  }
}

function showHubspotReminder(placeId) {
  const claim = getClaimForLead(placeId);
  if (!claim) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <h3 class="modal-title">Create Lead in HubSpot</h3>
      <p class="modal-desc">Copy the details below to create this lead in HubSpot:</p>
      <div class="modal-details">
        <div class="modal-field"><strong>Company:</strong> ${escapeHtml(claim.lead_name)}</div>
        <div class="modal-field"><strong>Address:</strong> ${escapeHtml(claim.lead_address)}</div>
        <div class="modal-field"><strong>Phone:</strong> ${escapeHtml(claim.lead_phone)}</div>
        <div class="modal-field"><strong>Website:</strong> ${escapeHtml(claim.lead_website)}</div>
        <div class="modal-field"><strong>Lead Score:</strong> ${claim.lead_score} (${escapeHtml(claim.lead_category)})</div>
        <div class="modal-field"><strong>Category:</strong> ${escapeHtml(claim.lead_category)}</div>
        <div class="modal-field"><strong>Owner:</strong> ${escapeHtml(claim.bdr_name)}</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary modal-copy-btn">Copy All Details</button>
        <button class="btn btn-secondary modal-done-btn">I've Created It</button>
        <button class="btn btn-ghost modal-close-btn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.modal-copy-btn').addEventListener('click', () => {
    const text = `Company: ${claim.lead_name}\nAddress: ${claim.lead_address}\nPhone: ${claim.lead_phone}\nWebsite: ${claim.lead_website}\nLead Score: ${claim.lead_score} (${claim.lead_category})\nOwner: ${claim.bdr_name}`;
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
  });

  modal.querySelector('.modal-done-btn').addEventListener('click', () => {
    updateHubspotStatus(placeId, 'created');
    modal.remove();
  });

  modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ---- MY LEADS RENDERING ----
function renderMyLeads() {
  if (!currentBdr) return;
  const myClaims = allClaims.filter(c => c.bdr_email === currentBdr.email);
  const emptyEl = document.getElementById('myLeadsEmpty');
  const tableWrap = document.getElementById('myLeadsTableWrap');
  const tbody = document.getElementById('myLeadsTableBody');

  if (myClaims.length === 0) {
    emptyEl.style.display = 'flex';
    tableWrap.style.display = 'none';
    return;
  }
  emptyEl.style.display = 'none';
  tableWrap.style.display = 'block';

  const hubspotLabels = { 'not_created': '\u26A0\uFE0F Not Created', 'created': '\u2705 Created', 'synced': '\uD83D\uDD04 Synced' };

  tbody.innerHTML = myClaims.map(c => {
    const badgeClass = c.lead_category === 'hot' ? 'badge-hot' : c.lead_category === 'warm' ? 'badge-warm' : 'badge-cool';
    const claimedDate = new Date(c.claimed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `<tr>
      <td><strong style="font-size:var(--text-sm);">${escapeHtml(c.lead_name)}</strong>
        ${c.lead_website ? `<br><a href="${escapeHtml(c.lead_website)}" target="_blank" rel="noopener noreferrer" style="font-size:var(--text-xs);color:var(--color-primary);text-decoration:none;">${truncateUrl(c.lead_website)}</a>` : ''}</td>
      <td>${escapeHtml(c.lead_address)}</td>
      <td style="font-variant-numeric:tabular-nums;">${escapeHtml(c.lead_phone)}</td>
      <td><span class="lead-score-badge ${badgeClass}">${c.lead_score}</span></td>
      <td><button class="btn btn-sm ${c.hubspot_status === 'not_created' ? 'btn-hubspot-warn' : 'btn-hubspot-ok'} btn-hs-toggle" data-id="${c.place_id}" data-status="${c.hubspot_status}">${hubspotLabels[c.hubspot_status] || c.hubspot_status}</button></td>
      <td style="font-size:var(--text-xs);color:var(--color-text-muted);">${claimedDate}</td>
      <td><textarea class="notes-textarea" data-id="${c.place_id}" placeholder="Add notes...">${escapeHtml(c.notes || '')}</textarea></td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-sm btn-save-notes" data-id="${c.place_id}" title="Save notes">💾</button>
        <button class="btn btn-ghost btn-sm btn-hs-create" data-id="${c.place_id}" title="HubSpot details">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-hs-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const currentStatus = btn.dataset.status;
      const nextStatus = currentStatus === 'not_created' ? 'created' : currentStatus === 'created' ? 'synced' : 'not_created';
      updateHubspotStatus(btn.dataset.id, nextStatus);
    });
  });

  tbody.querySelectorAll('.btn-hs-create').forEach(btn => {
    btn.addEventListener('click', () => showHubspotReminder(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-save-notes').forEach(btn => {
    btn.addEventListener('click', () => {
      const placeId = btn.dataset.id;
      const textarea = tbody.querySelector(`.notes-textarea[data-id="${placeId}"]`);
      if (textarea) {
        updateNotes(placeId, textarea.value);
      }
    });
  });
}

// ---- THEME ----
function initTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = prefersDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);

  $('[data-theme-toggle]').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
  });
}

// ---- NAVIGATION ----
function initNavigation() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      $$('.nav-item').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');

      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      $(`#panel-${tab}`).classList.add('active');

      const titles = { finder: 'Lead Finder', outreach: 'Outreach Generator', list: 'Outreach List', myleads: 'My Leads', insights: 'Market Insights' };
      $('#pageTitle').textContent = titles[tab] || 'Lead Finder';

      if (tab === 'outreach') updateOutreachLeadSelect();
      if (tab === 'list') renderOutreachList();
      if (tab === 'myleads') renderMyLeads();

      // Close mobile nav
      $('#sidebar').classList.remove('open');
    });
  });
}

function initMobileNav() {
  $('#mobileNavToggle').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    const sidebar = $('#sidebar');
    const toggle = $('#mobileNavToggle');
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// ---- SEARCH ----
function initSearch() {
  $('#searchBtn').addEventListener('click', performSearch);
  $('#searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  $('#loadMoreBtn').addEventListener('click', loadMore);
  $('#scoreFilter').addEventListener('change', renderResults);
  $('#sizeFilter').addEventListener('change', renderResults);
}

async function performSearch() {
  const location = $('#searchInput').value.trim();
  if (!location) return;

  state.searchPhase = 0;
  state.leads = [];
  state.currentLocation = location;

  showSkeleton();
  hideEmpty();

  try {
    // Geocode the location
    const country = $('#countrySelect').value;
    const coords = await geocodeLocation(location, country);
    if (!coords) {
      showToast('Location not found. Try a different search.', 'error');
      hideSkeleton();
      showEmpty();
      return;
    }
    state.currentCoords = coords;

    // Run parallel queries — Phase 1 + country local terms
    const radius = parseInt($('#radiusSelect').value);
    let queries = [...SEARCH_QUERIES_PHASE1];

    // Add country-specific local terms
    if (country !== 'all' && COUNTRY_LOCAL_TERMS[country]) {
      queries = queries.concat(COUNTRY_LOCAL_TERMS[country]);
    } else if (country === 'all') {
      // Add a mix of local terms for all countries
      queries = queries.concat(['däckverkstad', 'dekkverksted', 'rengasliike']);
    }

    const results = await runSearchQueries(queries, coords, radius, location);

    state.leads = deduplicateLeads(results);
    scoreLeads();

    hideSkeleton();
    renderResults();
    showStats();
    $('#loadMoreWrap').style.display = 'flex';
  } catch (err) {
    console.error('Search error:', err);
    showToast('Search failed. Please try again.', 'error');
    hideSkeleton();
    showEmpty();
  }
}

async function loadMore() {
  if (!state.currentCoords) return;

  const btn = $('#loadMoreBtn');
  btn.disabled = true;
  btn.textContent = 'Searching...';

  try {
    state.searchPhase++;
    const radius = parseInt($('#radiusSelect').value);
    const country = $('#countrySelect').value;
    let queries;

    if (state.searchPhase === 1) {
      queries = [...SEARCH_QUERIES_PHASE2];
      // Add remaining country terms
      if (country !== 'all' && COUNTRY_LOCAL_TERMS[country]) {
        queries = queries.concat(COUNTRY_LOCAL_TERMS[country]);
      }
    } else {
      queries = SEARCH_QUERIES_PHASE1.map(q => q + ' near me');
    }

    const results = await runSearchQueries(queries, state.currentCoords, radius, state.currentLocation);
    const newLeads = deduplicateLeads([...state.leads, ...results]);
    const addedCount = newLeads.length - state.leads.length;

    state.leads = newLeads;
    scoreLeads();
    renderResults();
    showStats();

    showToast(`Found ${addedCount} additional lead${addedCount !== 1 ? 's' : ''}.`, addedCount > 0 ? 'success' : 'info');
  } catch (err) {
    console.error('Load more error:', err);
    showToast('Could not load more results.', 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Load More Leads';
}

async function geocodeLocation(location, country) {
  const suffix = COUNTRY_BIAS[country] || '';
  const regionParam = COUNTRY_REGION_BIAS[country] || '';
  const fullAddress = encodeURIComponent(location + suffix) + regionParam;
  try {
    const resp = await fetch(`${API_BASE}/api/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: fullAddress })
    });
    const data = await resp.json();
    if (data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch (err) {
    console.warn('Geocode failed:', err);
    return null;
  }
}

async function runSearchQueries(queries, coords, radius, locationName) {
  const promises = queries.map(query => {
    const fullQuery = `${query} near ${locationName}`;
    return searchPlaces(fullQuery, coords, radius);
  });

  const results = await Promise.allSettled(promises);
  const allPlaces = [];

  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      allPlaces.push(...r.value);
    }
  });

  return allPlaces;
}

async function searchPlaces(textQuery, coords, radius) {
  try {
    const resp = await fetch(`${API_BASE}/api/places-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text_query: textQuery,
        latitude: coords.lat,
        longitude: coords.lng,
        radius: radius
      })
    });

    const data = await resp.json();
    if (data.places) {
      return data.places.map(p => ({
        id: p.id,
        name: p.displayName?.text || 'Unknown',
        address: p.formattedAddress || '',
        phone: p.nationalPhoneNumber || '',
        website: p.websiteUri || '',
        rating: p.rating || 0,
        reviewCount: p.userRatingCount || 0,
        types: p.types || [],
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        businessStatus: p.businessStatus || '',
        score: 0,
        category: 'cool',
        scanned: false,
        scanResults: null,
        inOutreachList: false,
        notes: ''
      }));
    }
    return [];
  } catch (err) {
    console.warn('Places query failed:', textQuery, err);
    return [];
  }
}

function deduplicateLeads(leads) {
  const seen = new Map();
  leads.forEach(lead => {
    if (!seen.has(lead.id)) {
      seen.set(lead.id, lead);
    }
  });
  return Array.from(seen.values());
}

// ---- BUSINESS SIZE ESTIMATION ----
function estimateBusinessSize(lead) {
  const name = lead.name.toLowerCase();
  const address = (lead.address || '').toLowerCase();
  const combined = name + ' ' + address;

  // Check against known large chains
  const isKnownChain = CHAIN_KEYWORDS.some(kw => combined.includes(kw));
  if (isKnownChain) return 'large';

  // High review count is a strong proxy for larger businesses
  if (lead.reviewCount > 200) return 'large';
  if (lead.reviewCount > 80) return 'medium-large';

  // Patterns suggesting large national businesses
  if (/\b(kedja|kjede|kæde|ketju|chain|nationwide|national)\b/i.test(combined)) return 'large';
  if (/\b(huvudkontor|hovedkontor|pääkonttori|headquarters|hq)\b/i.test(combined)) return 'medium-large';

  // Low reviews = likely small, local business (sweet spot)
  if (lead.reviewCount <= 15) return 'small';
  if (lead.reviewCount <= 50) return 'small-medium';

  return 'medium';
}

// ---- LEAD CATEGORY DETECTION ----
function inferBusinessType(lead) {
  const name = lead.name.toLowerCase();
  const types = (lead.types || []).join(' ').toLowerCase();
  const combined = name + ' ' + types;

  // Tyre-specific Nordic terms
  const tyreShopTerms = ['däck', 'dekk', 'dæk', 'rengas', 'tyre', 'tire', 'pneumatik'];
  const workshopTerms = ['verkstad', 'verksted', 'værksted', 'korjaamo', 'workshop', 'garage', 'auto repair', 'bilverkstad', 'bilverksted', 'autoværksted', 'autokorjaamo'];
  const wholesaleTerms = ['wholesale', 'grossist', 'tukkumyynti', 'engros', 'distributor', 'distribution'];
  const hotelTerms = ['hotell', 'hotel', 'hotelli', 'storage', 'förvaring', 'lagring', 'varasto', 'opbevaring'];
  const fastFitTerms = ['fast fit', 'quick fit', 'snabbservice', 'hurtigservice', 'pikapalvelu'];

  // Check tyre hotel first (specific)
  if (tyreShopTerms.some(t => combined.includes(t)) && hotelTerms.some(t => combined.includes(t))) return 'Tyre Hotel';

  // Wholesaler / Distributor
  if (wholesaleTerms.some(t => combined.includes(t))) return 'Tyre Wholesaler';
  if (combined.includes('distributor') || combined.includes('distribution')) return 'Tyre Distributor';

  // Fast-fit
  if (fastFitTerms.some(t => combined.includes(t))) return 'Fast-Fit Centre';

  // Tyre shop (has tyre terms)
  if (tyreShopTerms.some(t => combined.includes(t))) return 'Tyre Shop';

  // Workshop / garage
  if (workshopTerms.some(t => combined.includes(t))) return 'Auto Workshop';

  // Fall back to types
  if (types.includes('car_repair') || types.includes('auto_repair')) return 'Auto Workshop';
  if (types.includes('car_dealer')) return 'Auto Workshop';

  return '';
}

// ---- LEAD SCORING — B2C Tyre eCommerce Opportunity ----
function scoreLeads() {
  state.leads.forEach(lead => {
    let score = 0;
    const size = estimateBusinessSize(lead);
    lead.estimatedSize = size;

    // === SIZE-BASED SCORING ===
    switch (size) {
      case 'small':        score += 30; break;  // Independent shop — prime prospect
      case 'small-medium': score += 25; break;  // Growing business — ideal ICP
      case 'medium':       score += 15; break;  // Established but may still need online presence
      case 'medium-large': score += 0;  break;  // May already have systems
      case 'large':        score -= 20; break;  // Chain — already have corporate platform
    }

    // === CHAIN DETECTION ===
    const nameLower = lead.name.toLowerCase();
    const isChain = CHAIN_KEYWORDS.some(kw => nameLower.includes(kw));
    if (isChain) {
      score -= 15; // Chains less likely to adopt independent platform
      lead.isChain = true;
    } else {
      lead.isChain = false;
    }

    // === DIGITAL PRESENCE SCORING ===
    // No website = prime prospect for Autowork eCommerce
    if (!lead.website) {
      score += 25; // Hot — no online presence at all
    } else {
      score += 5; // Has website — needs scanning to determine opportunity
    }

    // === BUSINESS TYPE SCORING ===
    const typeStr = (lead.types || []).join(' ').toLowerCase() + ' ' + nameLower;
    const tyreTerms = ['däck', 'dekk', 'dæk', 'rengas', 'tyre', 'tire'];
    const hasTyreTerms = tyreTerms.some(t => typeStr.includes(t));
    if (hasTyreTerms) score += 10; // Direct tyre business = good fit

    // Tyre hotel signal — recurring revenue potential
    const hotelTerms = ['hotell', 'hotel', 'hotelli', 'storage', 'förvaring', 'lagring'];
    const hasTyreHotelInName = hotelTerms.some(t => typeStr.includes(t));
    if (hasTyreHotelInName) {
      score += 10; // Bonus for tyre hotel businesses
      lead.hasTyreHotelSignal = true;
    } else {
      lead.hasTyreHotelSignal = false;
    }

    // === RATING SCORING ===
    if (lead.rating >= 4.0 && lead.rating <= 5.0) score += 5;

    // === SCAN-BASED ADJUSTMENTS (after website deep scan) ===
    if (lead.scanned && lead.scanResults) {
      const sr = lead.scanResults;

      // No website or basic website = Hot
      if (sr.hasBasicSiteOnly) score += 20;

      // Digital readiness
      if (sr.digitalReadiness === 'low')    score += 15; // Basic digital = needs ecommerce
      if (sr.digitalReadiness === 'medium') score += 5;  // Some digital but gaps
      if (sr.digitalReadiness === 'high')   score -= 10; // Already sophisticated

      // Website with ecommerce but no tyre-specific search = Warm
      if (sr.hasOnlineOrdering && !sr.hasTyreSearch) score -= 5;

      // Website with tyre search + ecommerce = Cool (already digital)
      if (sr.hasTyreSearch && sr.hasOnlineOrdering) score -= 15;

      // Has tyre hotel = bonus signal (recurring revenue potential)
      if (sr.hasTyreHotel) score += 10;

      // B2B indicators
      if (sr.b2bIndicators && sr.b2bIndicators.length > 0) score += 5;

      // Multiple locations = may need multi-location support
      if (sr.multipleLocations) score += 5;
    }

    score = Math.max(0, Math.min(100, score));
    lead.score = score;
    lead.category = score >= 65 ? 'hot' : score >= 40 ? 'warm' : 'cool';
  });

  // Sort by score descending
  state.leads.sort((a, b) => b.score - a.score);
}

// ---- RENDERING ----
function renderResults() {
  const grid = $('#resultsGrid');
  const filter = $('#scoreFilter').value;

  let filtered = state.leads;
  if (filter === 'hot') filtered = state.leads.filter(l => l.category === 'hot');
  else if (filter === 'warm') filtered = state.leads.filter(l => l.category === 'hot' || l.category === 'warm');

  // Apply size filter
  const sizeFilter = $('#sizeFilter') ? $('#sizeFilter').value : 'small';
  if (sizeFilter === 'small') {
    filtered = filtered.filter(l => ['small', 'small-medium'].includes(l.estimatedSize));
  } else if (sizeFilter === 'smallmed') {
    filtered = filtered.filter(l => ['small', 'small-medium', 'medium'].includes(l.estimatedSize));
  }

  if (filtered.length === 0 && state.leads.length > 0) {
    grid.innerHTML = '<div class="empty-state"><h3>No leads match these filters</h3><p>Try adjusting the size or score filters to see more results.</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(lead => renderLeadCard(lead)).join('');

  // Attach event handlers
  grid.querySelectorAll('.btn-add-list').forEach(btn => {
    btn.addEventListener('click', () => addToOutreachList(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-scan').forEach(btn => {
    btn.addEventListener('click', () => scanWebsite(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-outreach').forEach(btn => {
    btn.addEventListener('click', () => goToOutreach(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-claim').forEach(btn => {
    btn.addEventListener('click', () => claimLead(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-hs-remind').forEach(btn => {
    btn.addEventListener('click', () => showHubspotReminder(btn.dataset.id));
  });
}

function renderLeadCard(lead) {
  const badgeClass = lead.category === 'hot' ? 'badge-hot' : lead.category === 'warm' ? 'badge-warm' : 'badge-cool';
  const categoryLabel = lead.category === 'hot' ? 'Hot Lead' : lead.category === 'warm' ? 'Warm Lead' : 'Cool Lead';
  const inList = state.outreachList.some(l => l.id === lead.id);
  const typeLabel = inferBusinessType(lead);

  let scanHtml = '';
  if (lead.scanned && lead.scanResults) {
    scanHtml = renderScanPanel(lead.scanResults);
  }

  // Ownership badge
  const claim = getClaimForLead(lead.id);
  let ownershipHtml = '';
  if (claim) {
    const isMine = currentBdr && claim.bdr_email === currentBdr.email;
    if (isMine) {
      ownershipHtml = '<div class="ownership-badge ownership-mine"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Claimed by you</div>';
    } else {
      ownershipHtml = `<div class="ownership-badge ownership-other"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Claimed by ${escapeHtml(claim.bdr_name)}</div>`;
    }
  }

  // Special signal badges
  let signalBadges = '';
  if (lead.isChain) {
    signalBadges += '<span class="tyre-signal-badge badge-chain">🏪 Chain</span> ';
  }
  if (lead.hasTyreHotelSignal) {
    signalBadges += '<span class="tyre-signal-badge badge-tyre-hotel">🏨 Tyre Hotel</span> ';
  }
  if (lead.scanned && lead.scanResults) {
    if (lead.scanResults.hasTyreHotel) {
      signalBadges += '<span class="tyre-signal-badge badge-tyre-hotel">🏨 Tyre Hotel</span> ';
    }
    if (lead.scanResults.hasTyreSearch) {
      signalBadges += '<span class="tyre-signal-badge badge-tyre-search">🔍 Tyre Search</span> ';
    }
  }

  // Actions — claim-aware
  const isMine = claim && currentBdr && claim.bdr_email === currentBdr.email;
  const isOther = claim && !isMine;

  let actionsHtml = '';
  if (!claim) {
    actionsHtml += `<button class="btn btn-sm btn-primary btn-claim" data-id="${lead.id}">Claim Lead</button>`;
  }
  if (!isOther) {
    actionsHtml += `<button class="btn btn-sm btn-secondary btn-add-list" data-id="${lead.id}" ${inList ? 'disabled' : ''}>${inList ? '\u2713 In List' : '+ Add to List'}</button>`;
  }
  if (isMine && claim.hubspot_status === 'not_created') {
    actionsHtml += `<button class="btn btn-sm btn-hubspot-remind btn-hs-remind" data-id="${lead.id}" title="Click after creating in HubSpot">\uD83D\uDD14 Create in HubSpot</button>`;
  }
  if (lead.website && !lead.scanned) {
    actionsHtml += `<button class="btn btn-sm btn-secondary btn-scan" data-id="${lead.id}">Scan</button>`;
  }
  if (lead.scanned) {
    actionsHtml += '<span class="lead-tag" style="background:var(--color-success-bg);color:var(--color-success);">Scanned</span>';
  }
  if (!isOther && inList) {
    actionsHtml += `<button class="btn btn-sm btn-ghost btn-outreach" data-id="${lead.id}">Outreach</button>`;
  }

  return `
    <div class="lead-card" data-id="${lead.id}">
      <div class="lead-card-header">
        <div class="lead-name">${escapeHtml(lead.name)}</div>
        <span class="lead-score-badge ${badgeClass}">${categoryLabel} \u00B7 ${lead.score}</span>
      </div>
      ${ownershipHtml}
      ${signalBadges ? `<div class="lead-meta" style="margin-bottom:var(--space-2);">${signalBadges}</div>` : ''}
      <div class="lead-details">
        <div class="lead-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${escapeHtml(lead.address)}</span>
        </div>
        ${lead.phone ? `<div class="lead-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span>${escapeHtml(lead.phone)}</span>
        </div>` : ''}
        ${lead.website ? `<div class="lead-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener noreferrer">${truncateUrl(lead.website)}</a>
        </div>` : '<div class="lead-detail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg><span style="color:var(--color-warning);">No website \u2014 prime ecommerce prospect</span></div>'}
      <div class="lead-detail">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <span class="size-tag size-${lead.estimatedSize || 'unknown'}">${getSizeLabel(lead.estimatedSize)}</span>
      </div>
      </div>
      <div class="lead-meta">
        ${lead.rating > 0 ? `<span class="lead-tag">\u2605 ${lead.rating.toFixed(1)} (${lead.reviewCount})</span>` : ''}
        ${typeLabel ? `<span class="lead-tag">${escapeHtml(typeLabel)}</span>` : ''}
      </div>
      <div class="lead-actions">
        ${actionsHtml}
      </div>
      ${scanHtml}
    </div>
  `;
}

function renderScanPanel(sr) {
  const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
  const xIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // Readiness colours — inverted for ecommerce opportunity
  const readinessColors = {
    low: 'var(--color-success)',       // Low digital = great prospect for ecommerce
    medium: 'var(--color-warning)',
    high: 'var(--color-error)',          // High digital = may not need our platform
    unknown: 'var(--color-text-faint)'
  };
  const readinessLabels = {
    low: 'Low — Strong ecommerce prospect',
    medium: 'Medium — Some digital capability',
    high: 'High — Already has digital tools',
    unknown: 'Unknown — Scan incomplete'
  };
  const readinessColor = readinessColors[sr.digitalReadiness] || readinessColors.unknown;
  const readinessLabel = readinessLabels[sr.digitalReadiness] || readinessLabels.unknown;

  let html = '<div class="scan-panel">';

  // Digital Readiness Gauge
  html += `<div class="scan-readiness-header">
    <div class="readiness-gauge">
      <div class="readiness-bar">
        <div class="readiness-fill" style="width:${sr.readinessScore}%;background:${readinessColor};"></div>
      </div>
      <div class="readiness-label" style="color:${readinessColor};">
        <strong>Digital Readiness: ${(sr.digitalReadiness || 'unknown').toUpperCase()}</strong>
        <span>${readinessLabel}</span>
      </div>
    </div>
  </div>`;

  // Findings list
  if (sr.signals && sr.signals.length > 0) {
    html += '<div class="scan-findings">';
    sr.signals.forEach(signal => {
      const isPositiveForUs = signal.includes('Basic') || signal.includes('Could not');
      const icon = isPositiveForUs ? checkIcon : xIcon;
      const cls = isPositiveForUs ? 'scan-found' : 'scan-neutral';
      html += `<div class="scan-row ${cls}">${icon} ${escapeHtml(signal)}</div>`;
    });
    html += '</div>';
  }

  // Tyre Hotel signal
  if (sr.hasTyreHotel) {
    html += `<div class="scan-row scan-found">${checkIcon} <strong>🏨 Tyre Hotel:</strong>&nbsp;${escapeHtml((sr.tyreHotelSignals || []).join(', '))} — recurring revenue potential</div>`;
  }

  // Tyre Search signal
  if (sr.hasTyreSearch) {
    html += `<div class="scan-row scan-warning">${xIcon} <strong>🔍 Tyre Search:</strong>&nbsp;${escapeHtml((sr.tyreSearchSignals || []).join(', '))} — already has tyre lookup</div>`;
  }

  // Tyre brands
  if (sr.tyreBrands && sr.tyreBrands.length > 0) {
    html += '<div class="scan-tyre-section">';
    html += `<div class="scan-row scan-neutral">${checkIcon} <strong>Tyre Brands:</strong></div>`;
    html += '<div class="scan-tags-row">';
    sr.tyreBrands.forEach(brand => {
      html += `<span class="tyre-brand-tag">${escapeHtml(brand)}</span>`;
    });
    html += '</div></div>';
  }

  // Payment methods
  if (sr.paymentMethods && sr.paymentMethods.length > 0) {
    html += '<div class="scan-tyre-section">';
    html += `<div class="scan-row scan-found">${checkIcon} <strong>Payment Methods:</strong></div>`;
    html += '<div class="scan-tags-row">';
    sr.paymentMethods.forEach(method => {
      html += `<span class="payment-tag">${escapeHtml(method)}</span>`;
    });
    html += '</div></div>';
  }

  // B2B
  if (sr.b2bIndicators && sr.b2bIndicators.length > 0) {
    html += `<div class="scan-row scan-found">${checkIcon} <strong>B2B signals:</strong>&nbsp;${escapeHtml(sr.b2bIndicators.join(', '))}</div>`;
  }

  // Multi-location
  if (sr.multipleLocations) {
    html += `<div class="scan-row scan-found">${checkIcon} Multiple locations detected</div>`;
  }

  html += '</div>';
  return html;
}

// ---- WEBSITE SCANNING — via server-side /api/scan-website endpoint ----
async function scanWebsite(placeId) {
  const lead = state.leads.find(l => l.id === placeId);
  if (!lead || !lead.website || lead.scanned) return;

  const btn = document.querySelector(`.btn-scan[data-id="${placeId}"]`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Scanning...';
  }

  try {
    const resp = await fetch(`${API_BASE}/api/scan-website`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: lead.website }),
      signal: AbortSignal.timeout(20000)
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.detail || `Server returned ${resp.status}`);
    }

    const scanResults = await resp.json();

    lead.scanned = true;
    lead.scanResults = scanResults;

    // Re-score
    scoreLeads();
    renderResults();
    showStats();
    showToast(`Scanned ${lead.name} — Digital Readiness: ${scanResults.digitalReadiness.toUpperCase()}`, 'success');
  } catch (err) {
    console.warn('Scan failed:', err);
    lead.scanned = true;
    lead.scanResults = {
      digitalReadiness: 'unknown',
      readinessScore: 0,
      hasOnlineOrdering: false,
      hasBasicSiteOnly: false,
      ecommercePlatform: [],
      techStack: [],
      b2bIndicators: [],
      socialMedia: { facebook: false, instagram: false, linkedin: false, twitter: false },
      socialCount: 0,
      multipleLocations: false,
      hasTyreHotel: false,
      tyreHotelSignals: [],
      hasTyreSearch: false,
      tyreSearchSignals: [],
      tyreBrands: [],
      paymentMethods: [],
      signals: ['Could not scan — ' + (err.message || 'site may be blocked or down')]
    };
    scoreLeads();
    renderResults();
    showStats();
    showToast(`Could not scan ${lead.name} — ${err.message || 'site may be blocked'}`, 'error');
  }
}

// ---- OUTREACH LIST ----
function addToOutreachList(placeId) {
  const lead = state.leads.find(l => l.id === placeId);
  if (!lead || state.outreachList.some(l => l.id === placeId)) return;

  state.outreachList.push({ ...lead, inOutreachList: true });
  lead.inOutreachList = true;

  updateListBadge();
  renderResults();
  showToast(`Added ${lead.name} to outreach list`, 'success');
}

function removeFromOutreachList(placeId) {
  state.outreachList = state.outreachList.filter(l => l.id !== placeId);
  const lead = state.leads.find(l => l.id === placeId);
  if (lead) lead.inOutreachList = false;

  updateListBadge();
  renderOutreachList();
  renderResults();
}

function updateListBadge() {
  const badge = $('#listBadge');
  const count = state.outreachList.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
}

function renderOutreachList() {
  const emptyState = $('#listEmptyState');
  const tableWrap = $('#listTableWrap');
  const tbody = $('#listTableBody');

  if (state.outreachList.length === 0) {
    emptyState.style.display = 'flex';
    tableWrap.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  tableWrap.style.display = 'block';

  tbody.innerHTML = state.outreachList.map(lead => {
    const badgeClass = lead.category === 'hot' ? 'badge-hot' : lead.category === 'warm' ? 'badge-warm' : 'badge-cool';
    return `
      <tr>
        <td>
          <strong style="font-size:var(--text-sm);">${escapeHtml(lead.name)}</strong>
          ${lead.website ? `<br><a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener noreferrer" style="font-size:var(--text-xs);color:var(--color-primary);text-decoration:none;">${truncateUrl(lead.website)}</a>` : ''}
        </td>
        <td>${escapeHtml(lead.address)}</td>
        <td style="font-variant-numeric:tabular-nums;">${escapeHtml(lead.phone)}</td>
        <td><span class="lead-score-badge ${badgeClass}">${lead.score}</span></td>
        <td>${escapeHtml(inferBusinessType(lead))}</td>
        <td class="td-actions">
          <button class="btn btn-ghost btn-sm btn-outreach-from-list" data-id="${lead.id}" title="Generate outreach">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </button>
          <button class="btn btn-danger btn-sm btn-remove-list" data-id="${lead.id}" title="Remove from list">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach handlers
  tbody.querySelectorAll('.btn-remove-list').forEach(btn => {
    btn.addEventListener('click', () => removeFromOutreachList(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-outreach-from-list').forEach(btn => {
    btn.addEventListener('click', () => goToOutreach(btn.dataset.id));
  });
}

// CSV Export
function initExportCsv() {
  $('#exportCsvBtn').addEventListener('click', exportCsv);
}

function exportCsv() {
  if (state.outreachList.length === 0) {
    showToast('No leads in outreach list to export.', 'error');
    return;
  }

  const headers = ['Business Name', 'Address', 'Phone', 'Website', 'Google Rating', 'Reviews', 'Type', 'Lead Score', 'Category', 'Estimated Size', 'Digital Readiness', 'Tyre Hotel', 'Tyre Search', 'Tyre Brands', 'Payment Methods', 'Notes'];
  const rows = state.outreachList.map(lead => {
    const sr = lead.scanResults;
    return [
      lead.name,
      lead.address,
      lead.phone,
      lead.website,
      lead.rating,
      lead.reviewCount,
      inferBusinessType(lead),
      lead.score,
      lead.category,
      getSizeLabel(lead.estimatedSize),
      sr ? (sr.digitalReadiness || 'Not scanned') : 'Not scanned',
      sr ? (sr.hasTyreHotel ? 'Yes' : 'No') : 'Not scanned',
      sr ? (sr.hasTyreSearch ? 'Yes' : 'No') : 'Not scanned',
      sr ? (sr.tyreBrands || []).join('; ') : 'Not scanned',
      sr ? (sr.paymentMethods || []).join('; ') : 'Not scanned',
      lead.notes
    ];
  });

  const csvContent = [headers, ...rows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autowork-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully', 'success');
}

// ---- OUTREACH GENERATOR ----
function initOutreach() {
  // Channel toggle
  $$('.channel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.channel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedChannel = btn.dataset.channel;
    });
  });

  $('#generateBtn').addEventListener('click', generateOutreach);
  initExportCsv();
}

function updateOutreachLeadSelect() {
  const select = $('#outreachLeadSelect');
  select.innerHTML = '<option value="">Choose a lead...</option>';

  // Merge outreach list + claimed leads into one deduplicated list
  const seen = new Set();
  const allOutreachLeads = [];

  state.outreachList.forEach(lead => {
    if (!seen.has(lead.id)) {
      seen.add(lead.id);
      allOutreachLeads.push({ id: lead.id, name: lead.name, address: lead.address, source: 'list' });
    }
  });

  if (currentBdr) {
    allClaims
      .filter(c => c.bdr_email === currentBdr.email)
      .forEach(c => {
        if (!seen.has(c.place_id)) {
          seen.add(c.place_id);
          allOutreachLeads.push({ id: c.place_id, name: c.lead_name, address: c.lead_address, source: 'claimed' });
        }
      });
  }

  if (allOutreachLeads.length === 0) {
    select.innerHTML = '<option value="">No leads yet — claim or add leads first</option>';
    return;
  }

  allOutreachLeads.forEach(lead => {
    const badge = lead.source === 'claimed' ? ' (Claimed)' : '';
    select.innerHTML += `<option value="${lead.id}">${escapeHtml(lead.name)} — ${escapeHtml(lead.address)}${badge}</option>`;
  });
}

function goToOutreach(placeId) {
  if (!state.outreachList.some(l => l.id === placeId)) {
    const lead = state.leads.find(l => l.id === placeId);
    if (lead) addToOutreachList(placeId);
  }

  $$('.nav-item').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
  document.querySelector('[data-tab="outreach"]').classList.add('active');
  document.querySelector('[data-tab="outreach"]').setAttribute('aria-current', 'page');

  $$('.tab-panel').forEach(p => p.classList.remove('active'));
  $('#panel-outreach').classList.add('active');
  $('#pageTitle').textContent = 'Outreach Generator';

  updateOutreachLeadSelect();
  $('#outreachLeadSelect').value = placeId;
}

function generateOutreach() {
  const leadId = $('#outreachLeadSelect').value;
  const personaKey = $('#personaSelect').value;
  const industry = $('#industrySelect').value;
  const channel = state.selectedChannel;

  if (!leadId) {
    showToast('Please select a lead first.', 'error');
    return;
  }

  let lead = state.outreachList.find(l => l.id === leadId) || state.leads.find(l => l.id === leadId);
  if (!lead) {
    const claim = allClaims.find(c => c.place_id === leadId);
    if (claim) {
      lead = {
        id: claim.place_id,
        name: claim.lead_name,
        address: claim.lead_address,
        phone: claim.lead_phone,
        website: claim.lead_website,
        score: claim.lead_score,
        category: claim.lead_category,
        estimatedSize: claim.lead_size,
        types: [],
        rating: 0,
        reviewCount: 0,
        scanned: false,
        scanResults: null
      };
    }
  }
  if (!lead) return;

  const persona = PERSONAS[personaKey];
  const output = $('#outreachOutput');

  if (channel === 'email') {
    output.innerHTML = generateEmailSequence(lead, persona, industry);
  } else if (channel === 'call') {
    output.innerHTML = generateCallScript(lead, persona, industry);
  } else if (channel === 'linkedin') {
    output.innerHTML = generateLinkedInMessage(lead, persona, industry);
  }

  // Attach copy handlers
  output.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.closest('.script-section').querySelector('.script-body').textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }).catch(() => {
        showToast('Could not copy to clipboard', 'error');
      });
    });
  });
}

function generateEmailSequence(lead, persona, industry) {
  const name = lead.name;
  const painPoint1 = persona.painPoints[0];
  const painPoint2 = persona.painPoints[1] || persona.painPoints[0];
  const pillar1 = MESSAGING_PILLARS[0];
  const pillar2 = MESSAGING_PILLARS[1]; // Tyre Hotel Made Digital

  const scanContext = lead.scanned && lead.scanResults;
  const hasTyreHotel = scanContext && lead.scanResults.hasTyreHotel;
  const hasTyreSearch = scanContext && lead.scanResults.hasTyreSearch;

  // Email 1 — Introduction
  const email1 = `
    <div class="script-section">
      <div class="script-label">Email 1 — Introduction</div>
      <div class="script-subject">Subject options:</div>
      <div class="script-body">1. "${name} — are your customers buying tyres from someone else online?"
2. "Quick question about how ${name} handles online tyre enquiries"
3. "For ${name}: 55% of tyre buyers search online first — are you capturing them?"</div>
      <br>
      <div class="script-body">Hi there,

I came across ${name} and noticed you're likely dealing with a challenge we hear from a lot of ${persona.title.toLowerCase()}s in the ${getIndustryLabel(industry)} space:

<strong>"${painPoint1}"</strong>

That's exactly why we built Autowork eCommerce — a B2C platform that lets tyre shops and workshops sell tyres online with their own branded storefront. Customers can search by vehicle or tyre size, compare brands, book fitting appointments, and even manage their tyre hotel storage — all online.

${scanContext && lead.scanResults.digitalReadiness === 'low' ? `From what I can see online, ${name} may not yet have an e-commerce presence — which is actually a great position to be in, because Autowork eCommerce gets you online in days, not months. No web agency or IT team needed.` : scanContext && lead.scanResults.hasOnlineOrdering ? `I can see ${name} already has some online capability — Autowork eCommerce could complement that with tyre-specific search, booking integration, and tyre hotel management.` : `The platform supports Klarna, Vipps, and MobilePay — the payment methods your customers already prefer.`}

${hasTyreHotel ? `I also noticed ${name} offers tyre hotel services — Autowork eCommerce includes full tyre hotel management with automated seasonal reminders, which our customers love.` : ''}

Would you be open to a quick 15-minute demo? I think you'd find it interesting.

Best regards,
${currentBdr ? currentBdr.name : '[Your Name]'}
Klipboard | Autowork eCommerce</div>
      <div class="script-tip">Tip: Keep email under 150 words. Personalise the opening line based on your research.</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;

  // Email 2 — Follow-up
  const email2 = `
    <div class="script-section">
      <div class="script-label">Email 2 — Follow-up (send 3 days later)</div>
      <div class="script-subject">Subject: Re: ${name} — a stat that might surprise you</div>
      <div class="script-body">Hi again,

I wanted to follow up on my last note with a stat that often catches people's attention:

<strong>55% of tyre buyers research online before purchasing, and 15% already buy online — with 6% annual growth.</strong> (Goodyear/Continental)

I bring this up because another common challenge we hear — especially from ${persona.title.toLowerCase()}s — is:

<strong>"${painPoint2}"</strong>

${pillar2.detail}

One of our early customers, a tyre shop similar to ${name}, was losing customers to Däckonline and other online-only retailers. Within weeks of launching their Autowork eCommerce storefront, they were capturing online bookings and had automated their entire tyre hotel workflow.

Worth a quick chat? I'm flexible on timing.

Best,
${currentBdr ? currentBdr.name : '[Your Name]'}
Klipboard | Autowork eCommerce</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;

  // Email 3 — Breakup
  const email3 = `
    <div class="script-section">
      <div class="script-label">Email 3 — Breakup (send 5 days after Email 2)</div>
      <div class="script-subject">Subject: Closing the loop, ${name}</div>
      <div class="script-body">Hi,

I don't want to be a pest, so this will be my last note for now.

I genuinely believe Autowork eCommerce could help ${name} capture the online tyre buyers you're currently missing — without the complexity or cost of building your own e-commerce site.

Here's what makes us different: <strong>${pillar1.detail}</strong>

Your branded tyre shop can be live in days. No web agency, no IT team, no development costs.

If the timing isn't right, no hard feelings at all. I'm happy to reconnect whenever it makes sense.

If you'd like to see a quick demo, just reply to this email or book a time here: klipboard.com

All the best,
${currentBdr ? currentBdr.name : '[Your Name]'}
Klipboard | Autowork eCommerce</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;

  return email1 + email2 + email3;
}

function generateCallScript(lead, persona, industry) {
  const name = lead.name;

  return `
    <div class="script-section">
      <div class="script-label">Opening</div>
      <div class="script-body"><strong>Pattern interrupt opener:</strong>

"Hi, this is ${currentBdr ? currentBdr.name : '[Your Name]'} from Klipboard. I know I've called completely out of the blue, so I'll be brief — would you give me 30 seconds to explain why I'm calling, and then you can tell me if it's worth continuing?"

<strong>[Wait for response — most people will say yes]</strong>

"Thanks. I work with tyre shops and workshops like ${name} across the Nordics who are seeing more and more of their customers buying tyres online — from Däckonline, Amazon, and the big chains. We've built a platform called Autowork eCommerce that gives independent shops like yours a branded online tyre shop — so you can capture those customers instead of losing them."</div>
    </div>

    <div class="script-section">
      <div class="script-label">Discovery Questions</div>
      <div class="script-body">1. "How are your customers currently finding and buying tyres from ${name}? Is it mostly walk-ins, phone calls, or do you get any online enquiries?"

2. "When tyre season hits — winter or summer changeover — what does that look like for you? Do you get overwhelmed, or is it manageable?"

3. "Do you offer tyre hotel / seasonal storage? If so, how are you managing those customers today — spreadsheets, a system, or mostly manual?"

4. "If I could show you a way to have your own online tyre shop — with tyre search by vehicle, online booking, and even tyre hotel management — all branded as ${name}, would that be interesting?"</div>
    </div>

    <div class="script-section">
      <div class="script-label">Objection Handling</div>
      <div class="script-body"><strong>"We already have a website"</strong>
→ "That's great! But does it let customers search for tyres by their car registration, compare brands, and book a fitting appointment online? Autowork eCommerce is purpose-built for the tyre industry — it's not a generic web shop."

<strong>"We don't sell online / our customers prefer to come in"</strong>
→ "I hear that a lot. But here's the thing — 55% of tyre buyers already research online before choosing where to buy. If they can't find you with prices and availability online, they're going to a competitor who does. Autowork eCommerce doesn't replace your workshop — it brings customers to it."

<strong>"We're part of a chain / franchise"</strong>
→ "Understood. In that case, we may not be the right fit — Autowork eCommerce is really built for independent shops who want their own branded online presence. But if you're interested in exploring it independently, I'm happy to chat."

<strong>"Not interested / bad timing"</strong>
→ "Totally understand. Quick question before I go — are you losing any customers to online tyre retailers? [Listen] The reason I ask is that the shift to online tyre buying is accelerating, and shops that get ahead of it now are seeing real benefits."</div>
    </div>

    <div class="script-section">
      <div class="script-label">Close</div>
      <div class="script-body">"Look, I don't want to take up more of your time. Based on what you've told me, I think Autowork eCommerce could genuinely help ${name} capture online customers and [restate their pain point]. Would you be open to a 15-minute demo this week? I can show you exactly how it would work for your business."

<strong>Book the demo. Confirm the time. Send a calendar invite immediately.</strong></div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;
}

function generateLinkedInMessage(lead, persona, industry) {
  const name = lead.name;

  return `
    <div class="script-section">
      <div class="script-label">Connection Request (300 chars max)</div>
      <div class="script-body">Hi, I noticed you're at ${name} — we work with tyre shops and workshops across the Nordics helping them sell tyres online and manage tyre hotels digitally. Would love to connect and share some ideas.</div>
      <div class="script-tip">Keep it short. No pitch in the connection request — just establish relevance.</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>

    <div class="script-section">
      <div class="script-label">Follow-up InMail (after acceptance)</div>
      <div class="script-body">Hi,

Thanks for connecting! I wanted to reach out because we've been working with a number of ${getIndustryLabel(industry)} businesses across the Nordics who were facing similar challenges to what I imagine ${name} deals with — specifically around ${persona.cares.toLowerCase()}.

We built Autowork eCommerce (by Klipboard) specifically for tyre shops, workshops, and wholesalers who want to sell tyres online without building anything from scratch.

${lead.scanResults && lead.scanResults.hasTyreHotel ? `I also noticed you offer tyre hotel services — our platform includes full tyre hotel management with automated seasonal reminders and digital tracking.` : lead.scanResults && lead.scanResults.digitalReadiness === 'low' ? `From what I can see, ${name} might not yet have an online shop — Autowork eCommerce gets you online in days with your own branded storefront.` : `The platform includes tyre search by vehicle, online booking, tyre hotel management, and supports Nordic payment methods like Klarna, Vipps, and MobilePay.`}

Here's a stat that often resonates: <strong>55% of tyre buyers research online first, and 15% already buy online — with 6% annual growth.</strong>

Would you be open to a quick chat? No pressure — happy to share some insights either way.

Best,
${currentBdr ? currentBdr.name : '[Your Name]'}</div>
      <button class="btn btn-ghost btn-sm copy-btn">Copy</button>
    </div>
  `;
}

function getIndustryLabel(key) {
  const labels = {
    tyreRetail: 'Tyre Retail',
    autoWorkshop: 'Auto Workshop',
    tyreWholesale: 'Tyre Wholesale',
    tyreHotel: 'Tyre Hotel / Storage'
  };
  return labels[key] || 'tyre and automotive';
}

// ---- SIZE LABEL HELPER ----
function getSizeLabel(size) {
  const labels = {
    'small': 'Small Business',
    'small-medium': 'Small–Medium',
    'medium': 'Medium Business',
    'medium-large': 'Medium–Large',
    'large': 'Large / Chain'
  };
  return labels[size] || 'Unknown';
}

// ---- UI HELPERS ----
function showSkeleton() {
  $('#skeletonContainer').style.display = 'grid';
  $('#resultsGrid').innerHTML = '';
  $('#loadMoreWrap').style.display = 'none';
  $('#statsBar').style.display = 'none';
}

function hideSkeleton() {
  $('#skeletonContainer').style.display = 'none';
}

function showEmpty() {
  $('#emptyState').style.display = 'flex';
}

function hideEmpty() {
  $('#emptyState').style.display = 'none';
}

function showStats() {
  const bar = $('#statsBar');
  bar.style.display = 'flex';

  const hot = state.leads.filter(l => l.category === 'hot').length;
  const warm = state.leads.filter(l => l.category === 'warm').length;
  const cool = state.leads.filter(l => l.category === 'cool').length;

  $('#totalLeads').textContent = state.leads.length;
  $('#hotCount').textContent = hot;
  $('#warmCount').textContent = warm;
  $('#coolCount').textContent = cool;
}

// Toast system
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px)';
    toast.style.transition = 'all 300ms ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Utilities
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url.substring(0, 40);
  }
}
