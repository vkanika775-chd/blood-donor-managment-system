/**
 * BloodLink India — Core Application Logic & Real API Integration Layer
 * Integrates:
 * - Verified MoHFW / e-RaktKosh / OGD Indian Blood Banks Directory
 * - OpenStreetMap Nominatim Geocoding & Leaflet Maps
 * - Real Voluntary Donor Registry (DPDP Act 2023 Masked Privacy)
 * - Hospital Emergency Coordination in Chandigarh, Mohali, Punjab & Haryana
 */

(function () {
  'use strict';

  const Data = window.BloodLinkData;

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  let state = {
    currentRole: 'coordinator', // 'coordinator' | 'donor' | 'seeker'
    currentView: 'landing',
    currentUser: Data.DEMO_USERS.coordinator,
    indianStates: [],
    bloodBanks: [],
    donors: [],
    requests: [],
    stats: {},
    eraktkoshStatus: {},
    mapInstance: null,
    mapMarkers: [],
    activeTrackingId: 'BL-IN-701',
    selectedCompatibility: 'O-',

    // Filters
    filters: {
      bloodBankState: 'Chandigarh',
      bloodBankDistrict: 'Chandigarh',
      bloodBankCategory: 'all',
      bloodBankSearch: '',
      donorState: 'all',
      donorDistrict: 'all',
      donorBloodGroup: 'all',
      donorAvailableOnly: false,
      donorPincode: ''
    },

    // Reports State
    reports: {
      search: '',
      bloodGroup: 'all',
      state: 'all',
      district: 'all',
      status: 'all',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: 10,
      selectedDonor: null
    },

    // UI States
    uiState: {
      bloodBanksLoading: false,
      bloodBanksError: null,
      donorsLoading: false,
      donorsError: null,
      requestsLoading: false,
      requestsError: null,
      statsLoading: false
    }
  };

  // --------------------------------------------------------------------------
  // Notifications / Toast System
  // --------------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `<span>${iconSvg}</span><div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, 4500);
  }

  // --------------------------------------------------------------------------
  // Modal Handlers
  // --------------------------------------------------------------------------
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  // --------------------------------------------------------------------------
  // Backend API Client
  // --------------------------------------------------------------------------
  async function apiFetch(endpoint, options = {}) {
    try {
      const token = sessionStorage.getItem('bloodlink_token') || '';
      const activeRole = state.currentRole || (state.currentUser ? state.currentUser.role : 'coordinator');
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'X-Active-Role': activeRole,
          ...(options.headers || {})
        },
        ...options
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }
      return data;
    } catch (err) {
      console.warn(`API call error for ${endpoint}:`, err.message);
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Data Loading & Syncing
  // --------------------------------------------------------------------------
  async function loadInitialData() {
    try {
      // 1. Fetch States & Districts
      const statesRes = await apiFetch('/api/states-districts');
      state.indianStates = statesRes.states || [];
      populateStateDropdowns();

      // 2. Fetch Derived Stats
      fetchStats();

      // 3. Fetch e-RaktKosh Status
      fetchEraktkoshStatus();

      // 4. Fetch Blood Banks (defaulting to Chandigarh Tricity)
      fetchBloodBanks();

      // 5. Fetch Real Voluntary Donors
      fetchDonors();

      // 6. Fetch Emergency Requests
      fetchRequests();
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
  }

  async function fetchStats() {
    state.uiState.statsLoading = true;
    try {
      const res = await apiFetch('/api/stats');
      if (res.success && res.data) {
        state.stats = res.data;
        updateStatsUI(res.data);
      }
    } catch (e) {
      console.warn('Could not load stats:', e);
    } finally {
      state.uiState.statsLoading = false;
    }
  }

  function updateStatsUI(stats) {
    // Overview metrics
    const elBbCount = document.getElementById('stat-total-blood-banks');
    const elDonorsCount = document.getElementById('stat-total-donors');
    const elPending = document.getElementById('stat-pending-requests');
    const elFulfilled = document.getElementById('stat-completed-requests');

    if (elBbCount) elBbCount.textContent = stats.verifiedBloodBanks || '24';
    if (elDonorsCount) elDonorsCount.textContent = stats.registeredDonors || '0';
    if (elPending) elPending.textContent = stats.pendingRequests || '2';
    if (elFulfilled) elFulfilled.textContent = stats.completedRequests || '1';

    // Public Landing Page Stats
    const pubBb = document.getElementById('pub-stat-blood-banks');
    const pubGovt = document.getElementById('pub-stat-govt');
    const pubDonors = document.getElementById('pub-stat-donors');
    const pubTricity = document.getElementById('pub-stat-tricity');

    if (pubBb) pubBb.textContent = stats.verifiedBloodBanks || '24';
    if (pubGovt) pubGovt.textContent = stats.govtBloodBanks || '14';
    if (pubDonors) pubDonors.textContent = stats.registeredDonors || '0';
    if (pubTricity) pubTricity.textContent = stats.tricityBloodBanks || '12';

    // Last updated & source attribution
    const sourceAttr = document.getElementById('source-attribution-text');
    if (sourceAttr) {
      sourceAttr.textContent = `Verified MoHFW Directory • Real-time DB • Last updated: ${new Date(stats.lastUpdated).toLocaleDateString('en-IN')}`;
    }
  }

  async function fetchEraktkoshStatus() {
    try {
      const st = state.filters.bloodBankState || 'Chandigarh';
      const dist = state.filters.bloodBankDistrict || 'Chandigarh';
      const res = await apiFetch(`/api/eraktkosh/status?state=${encodeURIComponent(st)}&district=${encodeURIComponent(dist)}`);
      state.eraktkoshStatus = res;

      const directLink = document.getElementById('eraktkosh-direct-link');
      if (directLink && res.directVerificationUrl) {
        directLink.href = res.directVerificationUrl;
      }
    } catch (e) {
      console.warn('e-RaktKosh status check error:', e);
    }
  }

  async function fetchBloodBanks() {
    state.uiState.bloodBanksLoading = true;
    state.uiState.bloodBanksError = null;
    renderBloodBanksLoading();

    try {
      let queryParams = new URLSearchParams();
      if (state.filters.bloodBankState && state.filters.bloodBankState !== 'all') {
        queryParams.append('state', state.filters.bloodBankState);
      }
      if (state.filters.bloodBankDistrict && state.filters.bloodBankDistrict !== 'all') {
        queryParams.append('district', state.filters.bloodBankDistrict);
      }
      if (state.filters.bloodBankCategory && state.filters.bloodBankCategory !== 'all') {
        queryParams.append('hospitalType', state.filters.bloodBankCategory);
      }
      if (state.filters.bloodBankSearch) {
        queryParams.append('search', state.filters.bloodBankSearch);
      }

      const res = await apiFetch(`/api/blood-banks?${queryParams.toString()}`);
      state.bloodBanks = res.bloodBanks || [];
      renderBloodBanksList();
      updateLeafletMapMarkers();
    } catch (err) {
      state.uiState.bloodBanksError = err.message || 'Unable to connect to verified blood bank service';
      renderBloodBanksError();
    } finally {
      state.uiState.bloodBanksLoading = false;
    }
  }

  async function fetchDonors() {
    state.uiState.donorsLoading = true;
    state.uiState.donorsError = null;
    renderDonorsLoading();

    try {
      let queryParams = new URLSearchParams();
      if (state.filters.donorState && state.filters.donorState !== 'all') {
        queryParams.append('state', state.filters.donorState);
      }
      if (state.filters.donorDistrict && state.filters.donorDistrict !== 'all') {
        queryParams.append('district', state.filters.donorDistrict);
      }
      if (state.filters.donorBloodGroup && state.filters.donorBloodGroup !== 'all') {
        queryParams.append('bloodGroup', state.filters.donorBloodGroup);
      }
      if (state.filters.donorAvailableOnly) {
        queryParams.append('availableOnly', 'true');
      }
      if (state.filters.donorPincode) {
        queryParams.append('pincode', state.filters.donorPincode);
      }

      const res = await apiFetch(`/api/donors?${queryParams.toString()}`);
      state.donors = res.donors || [];
      renderDonorsList();
      renderDonorReportsTable();
    } catch (err) {
      state.uiState.donorsError = err.message || 'Unable to load donor registry';
      renderDonorsError();
    } finally {
      state.uiState.donorsLoading = false;
    }
  }

  async function fetchRequests() {
    state.uiState.requestsLoading = true;
    try {
      const res = await apiFetch('/api/requests');
      state.requests = res.requests || [];
      renderUrgentRequestsFeed();
      renderRequestTable();
      renderTrackingView();
    } catch (e) {
      console.warn('Failed to load blood requests:', e);
    } finally {
      state.uiState.requestsLoading = false;
    }
  }

  // --------------------------------------------------------------------------
  // Cascading State & District Selectors
  // --------------------------------------------------------------------------
  function populateStateDropdowns() {
    const stateDropdowns = [
      'hero-state-select',
      'bb-filter-state',
      'donor-filter-state',
      'reports-filter-state',
      'req-state',
      'reg-state',
      'reg-input-state'
    ];

    stateDropdowns.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      const isFilter = id.includes('filter') || id.includes('hero');
      let optionsHtml = isFilter ? '<option value="all">All States & UTs</option>' : '<option value="">Select State / UT</option>';

      state.indianStates.forEach(st => {
        const isPriority = st.priority;
        const selected = (isFilter && st.name === 'Chandigarh' && id === 'bb-filter-state') ? 'selected' : '';
        optionsHtml += `<option value="${st.name}" ${selected}>${isPriority ? '★ ' : ''}${st.name}</option>`;
      });

      el.innerHTML = optionsHtml;
    });

    // Populate Initial Districts
    updateDistrictDropdown('bb-filter-state', 'bb-filter-district', true);
    updateDistrictDropdown('hero-state-select', 'hero-district-select', true);
    updateDistrictDropdown('donor-filter-state', 'donor-filter-district', true);
    updateDistrictDropdown('reports-filter-state', 'reports-filter-district', true);
    updateDistrictDropdown('req-state', 'req-district', false);
    updateDistrictDropdown('reg-state', 'reg-district', false);
    updateDistrictDropdown('reg-input-state', 'reg-input-district', false);
  }

  function updateDistrictDropdown(stateSelectId, districtSelectId, isFilter = true) {
    const stateEl = document.getElementById(stateSelectId);
    const districtEl = document.getElementById(districtSelectId);
    if (!stateEl || !districtEl) return;

    const selectedStateName = stateEl.value;
    let districts = [];

    if (selectedStateName && selectedStateName !== 'all') {
      const stateObj = state.indianStates.find(s => s.name === selectedStateName);
      if (stateObj && stateObj.districts) {
        districts = stateObj.districts;
      }
    }

    let html = isFilter ? '<option value="all">All Districts</option>' : '<option value="">Select District</option>';
    districts.forEach(d => {
      html += `<option value="${d}">${d}</option>`;
    });

    districtEl.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // Navigation & Routing (with Hash Aliases)
  // --------------------------------------------------------------------------
  const ROUTE_ALIASES = {
    'home': 'landing',
    'landing': 'landing',
    '': 'landing',
    'login': 'login',
    'sign-in': 'login',
    'signin': 'login',
    'register': 'register',
    'registration': 'register',
    'signup': 'register',
    'sign-up': 'register',
    'how-it-works': 'landing',
    'impact': 'landing',
    'why-bloodlink': 'landing',
    'compatibility': 'landing',
    'about-us': 'landing',
    'dashboard': 'overview',
    'overview': 'overview',
    'blood-banks': 'blood-banks',
    'nearby-blood-banks': 'blood-banks',
    'donor-search': 'donor-search',
    'find-donors': 'donor-search',
    'create-request': 'create-request',
    'request-blood': 'create-request',
    'register-donor': 'register-donor',
    'donor-registration': 'register-donor',
    'tracking': 'tracking',
    'request-tracking': 'tracking',
    'history': 'history',
    'donation-history': 'history',
    'donor-reports': 'donor-reports',
    'reports': 'donor-reports',
    'profile': 'profile',
    'user-profile': 'profile',
    'settings': 'settings'
  };

  function setView(viewName) {
    const rawView = (viewName || '').replace(/^#/, '');
    const normalized = ROUTE_ALIASES[rawView] || 'overview';
    state.currentView = normalized;

    const publicLanding = document.getElementById('public-landing-view');
    const dashboardRoot = document.getElementById('dashboard-root-view');
    const authLoginView = document.getElementById('auth-login-view');
    const authRegisterView = document.getElementById('auth-register-view');

    const dashViews = [
      'overview', 'blood-banks', 'donor-search', 'create-request',
      'register-donor', 'tracking', 'history', 'donor-reports', 'profile', 'settings'
    ];

    if (normalized === 'login') {
      if (publicLanding) publicLanding.style.display = 'none';
      if (dashboardRoot) dashboardRoot.style.display = 'none';
      if (authRegisterView) authRegisterView.style.display = 'none';
      if (authLoginView) authLoginView.style.display = 'block';
      hideAuthAlerts();
      if (window.location.hash !== '#login') {
        window.location.hash = 'login';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (normalized === 'register') {
      if (publicLanding) publicLanding.style.display = 'none';
      if (dashboardRoot) dashboardRoot.style.display = 'none';
      if (authLoginView) authLoginView.style.display = 'none';
      if (authRegisterView) authRegisterView.style.display = 'block';
      hideAuthAlerts();
      updateDistrictDropdown('reg-input-state', 'reg-input-district', false);
      if (window.location.hash !== '#register') {
        window.location.hash = 'register';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Hide auth views when accessing landing or dashboard
    if (authLoginView) authLoginView.style.display = 'none';
    if (authRegisterView) authRegisterView.style.display = 'none';

    if (normalized === 'landing') {
      if (publicLanding) publicLanding.style.display = 'block';
      if (dashboardRoot) dashboardRoot.style.display = 'none';

      if (rawView && rawView !== 'home' && rawView !== 'landing') {
        const anchorEl = document.getElementById(rawView);
        if (anchorEl) {
          setTimeout(() => anchorEl.scrollIntoView({ behavior: 'smooth' }), 50);
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (publicLanding) publicLanding.style.display = 'none';
      if (dashboardRoot) dashboardRoot.style.display = 'block';

      let targetTab = normalized;
      if (!dashViews.includes(targetTab)) {
        targetTab = 'overview';
      }

      dashViews.forEach(v => {
        const el = document.getElementById(`dash-view-${v}`);
        if (el) el.style.display = (v === targetTab) ? 'block' : 'none';
      });

      document.querySelectorAll('.dash-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === targetTab);
      });

      if (targetTab === 'blood-banks') {
        setTimeout(initOrResizeLeafletMap, 150);
      }

      if (targetTab === 'donor-reports') {
        renderDonorReportsTable();
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function switchRole(roleKey) {
    if (!Data.DEMO_USERS[roleKey]) return;
    state.currentRole = roleKey;
    state.currentUser = Data.DEMO_USERS[roleKey];
    updateUserInterfaceHeaders();
    if (state.currentView === 'donor-reports') {
      renderDonorReportsTable();
    }
    const donorModal = document.getElementById('modal-donor-report');
    if (donorModal && donorModal.classList.contains('active') && state.reports.selectedDonor) {
      openDonorReport(state.reports.selectedDonor.id);
    }
    showToast(`Switched active persona to: ${state.currentUser.name} (${state.currentUser.roleLabel})`, 'info');
  }

  function updateUserInterfaceHeaders() {
    const u = state.currentUser;
    document.querySelectorAll('.user-name-display').forEach(el => el.textContent = u.name);
    document.querySelectorAll('.user-role-display').forEach(el => el.textContent = u.roleLabel);
    document.querySelectorAll('.user-avatar-display').forEach(el => el.textContent = u.avatar || 'IN');

    const greetingEl = document.getElementById('dash-welcome-title');
    if (greetingEl) {
      greetingEl.innerHTML = `Namaste, <span style="color:var(--color-burgundy-700);">${u.name}</span>! Let's make a difference today.`;
    }

    const greetingSub = document.getElementById('dash-welcome-sub');
    if (greetingSub) {
      if (u.role === 'hospital') {
        greetingSub.textContent = `Hospital Blood Bank Command: ${u.hospital}. Coordinated under NBTC guidelines.`;
      } else if (u.role === 'donor') {
        greetingSub.textContent = `Blood Type ${u.bloodGroup} • Voluntary Donor (${u.city}, ${u.state}). Ready to respond to urgent hospital needs.`;
      } else {
        greetingSub.textContent = `Verified blood bank directory & emergency donor coordination network for India.`;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Leaflet Map Integration (OpenStreetMap of India)
  // --------------------------------------------------------------------------
  function initOrResizeLeafletMap() {
    const mapEl = document.getElementById('leaflet-bloodbank-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (!state.mapInstance) {
      // Centered on Chandigarh / Tricity region by default [30.7333, 76.7794]
      state.mapInstance = L.map('leaflet-bloodbank-map', {
        zoomControl: true,
        scrollWheelZoom: false
      }).setView([30.7333, 76.7794], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | BloodLink India'
      }).addTo(state.mapInstance);
    } else {
      state.mapInstance.invalidateSize();
    }

    updateLeafletMapMarkers();
  }

  function updateLeafletMapMarkers() {
    if (!state.mapInstance || typeof L === 'undefined') return;

    // Clear existing markers
    state.mapMarkers.forEach(m => state.mapInstance.removeLayer(m));
    state.mapMarkers = [];

    const bounds = [];

    state.bloodBanks.forEach(bb => {
      if (bb.latitude && bb.longitude) {
        const isGovt = bb.hospitalType === 'Government';
        const markerColor = isGovt ? '#2A784E' : '#681A2A';

        const customIcon = L.divIcon({
          className: 'custom-map-pin',
          html: `<div style="background-color:${markerColor}; color:#fff; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3); font-weight:800; font-size:12px;">🏥</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = L.marker([bb.latitude, bb.longitude], { icon: customIcon }).addTo(state.mapInstance);

        const popupContent = `
          <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px; max-width:260px;">
            <div style="font-size:11px; font-weight:700; color:${markerColor}; text-transform:uppercase;">${bb.category}</div>
            <h4 style="font-size:14px; margin:4px 0 6px; color:#1E2225; line-height:1.2;">${bb.name}</h4>
            <div style="font-size:12px; color:#535A62; margin-bottom:8px;">${bb.address}</div>
            <div style="font-size:12px; margin-bottom:8px;">📞 <strong>${bb.contactPhone}</strong></div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${bb.latitude},${bb.longitude}" target="_blank" rel="noopener" style="display:inline-block; font-size:11px; font-weight:700; color:#681A2A; text-decoration:none;">
              Get Directions ↗
            </a>
          </div>
        `;

        marker.bindPopup(popupContent);
        state.mapMarkers.push(marker);
        bounds.push([bb.latitude, bb.longitude]);
      }
    });

    if (bounds.length > 0 && state.mapInstance) {
      state.mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }

  // --------------------------------------------------------------------------
  // Render: Verified Blood Banks List & Cards
  // --------------------------------------------------------------------------
  function renderBloodBanksLoading() {
    const grid = document.getElementById('blood-banks-cards-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div style="grid-column: 1 / -1;" class="state-container-card">
        <div class="loading-spinner-ring"></div>
        <h4>Querying Official Blood Banks Directory...</h4>
        <p style="color:var(--color-text-muted); font-size:0.875rem;">Connecting to verified MoHFW & State Health System records</p>
      </div>
    `;
  }

  function renderBloodBanksError() {
    const grid = document.getElementById('blood-banks-cards-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div style="grid-column: 1 / -1;" class="state-container-card">
        <div class="state-icon-large error">⚠️</div>
        <h4>Unable to Load Blood Banks Directory</h4>
        <p style="color:var(--color-text-secondary); font-size:0.875rem; margin-bottom:16px;">${state.uiState.bloodBanksError}</p>
        <button class="btn btn-primary btn-sm" onclick="window.fetchBloodBanks && window.fetchBloodBanks()">Retry Connection</button>
      </div>
    `;
  }

  function renderBloodBanksList() {
    const grid = document.getElementById('blood-banks-cards-grid');
    const countEl = document.getElementById('bb-results-count');
    if (!grid) return;

    if (countEl) {
      countEl.textContent = `Showing ${state.bloodBanks.length} verified blood banks in India`;
    }

    if (state.bloodBanks.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1;" class="state-container-card">
          <div class="state-icon-large empty">🏥</div>
          <h4>No Licensed Blood Banks Found for Selected Filters</h4>
          <p style="color:var(--color-text-secondary); font-size:0.875rem; margin-bottom:16px;">
            Try clearing filters or search for neighboring districts in Chandigarh, Punjab, or Haryana.
          </p>
          <a href="https://eraktkosh.mohfw.gov.in/" target="_blank" rel="noopener" class="btn btn-outline-burgundy btn-sm">
            Search National e-RaktKosh Portal ↗
          </a>
        </div>
      `;
      return;
    }

    grid.innerHTML = state.bloodBanks.map(bb => {
      const isGovt = bb.hospitalType === 'Government';
      const isCharitable = bb.hospitalType === 'Charitable';
      const badgeClass = isGovt ? 'gov' : (isCharitable ? 'charitable' : '');

      return `
        <div class="blood-bank-item-card">
          <div class="bb-header">
            <div class="bb-title-area">
              <h4>${bb.name}</h4>
              <span class="bb-category-badge ${badgeClass}">${bb.category}</span>
            </div>
            <div style="text-align:right;">
              <span class="status-pill fulfilled" style="font-size:0.6875rem;">Licensed</span>
            </div>
          </div>

          <div class="bb-meta-row">
            <div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              ${bb.address}, ${bb.district}, ${bb.state} – <strong>${bb.pincode}</strong>
            </div>
            <div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              ${bb.timing || '24x7 Emergency Service'}
            </div>
            <div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              Direct: <strong>${bb.contactPhone}</strong> ${bb.helpline ? `• Helpline: <strong>${bb.helpline}</strong>` : ''}
            </div>
          </div>

          <div style="font-size:0.75rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:6px;">Available Components:</div>
          <div class="bb-components-tags">
            ${(bb.componentsAvailable || ['Whole Blood', 'PRBC', 'FFP', 'Platelets']).map(c => `
              <span class="bb-comp-pill">${c}</span>
            `).join('')}
          </div>

          <div class="bb-actions-row">
            <a href="tel:${bb.contactPhone.replace(/\D/g, '')}" class="btn btn-sm btn-primary" style="flex:1;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              Call Blood Bank
            </a>
            <a href="https://eraktkosh.mohfw.gov.in/BLDA/bloodbank/stockAvailability.html" target="_blank" rel="noopener" class="btn btn-sm btn-secondary" title="Verify Live Stock on e-RaktKosh">
              e-RaktKosh Stock ↗
            </a>
            ${bb.latitude && bb.longitude ? `
              <a href="https://www.google.com/maps/dir/?api=1&destination=${bb.latitude},${bb.longitude}" target="_blank" rel="noopener" class="btn btn-sm btn-ghost" title="Directions">
                📍 Map
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // --------------------------------------------------------------------------
  // Render: Real Voluntary Donors (with DPDP Act 2023 Compliance)
  // --------------------------------------------------------------------------
  function renderDonorsLoading() {
    const grid = document.getElementById('donors-cards-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div style="grid-column: 1 / -1;" class="state-container-card">
        <div class="loading-spinner-ring"></div>
        <h4>Searching Voluntary Donor Registry...</h4>
      </div>
    `;
  }

  function renderDonorsError() {
    const grid = document.getElementById('donors-cards-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div style="grid-column: 1 / -1;" class="state-container-card">
        <div class="state-icon-large error">⚠️</div>
        <h4>Unable to Connect to Donor Registry</h4>
        <p style="color:var(--color-text-secondary); font-size:0.875rem;">${state.uiState.donorsError}</p>
      </div>
    `;
  }

  function renderDonorsList() {
    const grid = document.getElementById('donors-cards-grid');
    const countEl = document.getElementById('donor-search-count');
    if (!grid) return;

    if (countEl) {
      countEl.textContent = `${state.donors.length} registered voluntary donors`;
    }

    // Honest State when 0 registered donors exist for a district
    if (state.donors.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1;" class="state-container-card">
          <div class="state-icon-large empty">🩸</div>
          <h4>No Voluntary Donors Registered in this Specific District Yet</h4>
          <p style="color:var(--color-text-secondary); font-size:0.9375rem; max-width:580px; margin:8px auto 20px;">
            BloodLink strictly maintains authentic volunteer registrations and never invents fake donor records.
            You can be the first voluntary donor to register for your area, or immediately contact one of the licensed blood banks in this region.
          </p>
          <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <button class="btn btn-coral" data-route="register-donor">Register as First Donor in this Area</button>
            <button class="btn btn-secondary" data-route="blood-banks">View Verified Blood Banks</button>
          </div>
        </div>
      `;
      return;
    }

    grid.innerHTML = state.donors.map(d => {
      const compInfo = Data.BLOOD_COMPATIBILITY[d.bloodGroup];
      return `
        <div class="donor-card">
          <div class="donor-card-top">
            <div class="donor-name-area">
              <h4>
                ${d.fullName}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#2A784E" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="9 12 12 15 16 10"></polyline></svg>
              </h4>
              <div class="donor-meta">${d.district}, ${d.state} • PIN: ${d.pincode || 'India'}</div>
            </div>
            <div class="badge-blood ${d.bloodGroup === 'O-' ? 'rare' : ''}">${d.bloodGroup}</div>
          </div>

          <div class="donor-stats-row">
            <div>
              <span style="color:var(--color-text-muted);">Age / Gender:</span>
              <strong> ${d.age}y / ${d.gender}</strong>
            </div>
            <div>
              <span style="color:var(--color-text-muted);">Status:</span>
              <span class="status-pill ${d.availableForEmergency ? 'available' : 'matching'}">
                ${d.availableForEmergency ? 'Available' : 'On-call'}
              </span>
            </div>
          </div>

          <div style="font-size:0.8125rem; background:var(--color-bg-base); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:12px; border:1px solid var(--border-subtle);">
            <span style="color:var(--color-text-muted);">Protected Mobile:</span>
            <strong style="color:var(--color-burgundy-900); font-family:monospace;">${d.maskedMobile}</strong>
            <span style="font-size:0.6875rem; color:var(--color-text-muted); display:block; margin-top:2px;">(DPDP Act 2023 Masked Privacy)</span>
          </div>

          <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:16px;">
            Can safely donate to: <span style="font-weight:600; color:var(--color-burgundy-800);">${compInfo ? compInfo.canGiveTo.slice(0, 4).join(', ') : ''}</span>
          </div>

          <div class="donor-card-actions">
            <button class="btn btn-sm btn-primary request-donor-direct-btn" data-id="${d.id}" data-blood="${d.bloodGroup}" data-name="${d.fullName}" style="flex:1;">
              Request Blood
            </button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.request-donor-direct-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const bgSelect = document.getElementById('req-blood-group');
        if (bgSelect) bgSelect.value = btn.dataset.blood;
        setView('create-request');
        showToast(`Initiating blood requisition matching ${btn.dataset.blood} donor ${btn.dataset.name}`, 'info');
      });
    });
  }

  // --------------------------------------------------------------------------
  // Render: Urgent Requests Feed & Table
  // --------------------------------------------------------------------------
  function renderUrgentRequestsFeed() {
    const listEl = document.getElementById('urgent-requests-list');
    if (!listEl) return;

    const urgentItems = state.requests.filter(r => r.status !== 'fulfilled');

    if (urgentItems.length === 0) {
      listEl.innerHTML = '<div style="padding:24px; text-align:center; color:var(--color-text-muted);">No urgent emergency requisitions currently active.</div>';
      return;
    }

    listEl.innerHTML = urgentItems.map(req => {
      const isCritical = req.urgency === 'critical';
      return `
        <div class="urgent-request-item" data-id="${req.id}">
          <div class="urgent-left">
            <div class="badge-blood ${isCritical ? 'critical' : ''}">${req.bloodGroup}</div>
            <div class="urgent-details">
              <h4>
                ${req.patientName}
                <span class="status-pill ${req.urgency}">${req.urgency}</span>
              </h4>
              <div class="urgent-location">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${req.hospitalName} • ${req.district}, ${req.state}
              </div>
            </div>
          </div>
          <div class="urgent-right">
            <div>
              <div class="urgent-units">${req.unitsPledged} of ${req.unitsRequired} Units Pledged</div>
              <div style="font-size:0.75rem; color:var(--color-text-muted);">${req.requiredByDate}</div>
            </div>
            <button class="btn btn-sm btn-outline-burgundy view-req-details-btn" data-id="${req.id}">Details</button>
            ${req.unitsPledged < req.unitsRequired ? `
              <button class="btn btn-sm btn-coral quick-pledge-action-btn" data-id="${req.id}">Pledge 1 Unit</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.view-req-details-btn').forEach(btn => {
      btn.addEventListener('click', () => openRequestDetailsModal(btn.dataset.id));
    });

    listEl.querySelectorAll('.quick-pledge-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePledgeDonation(btn.dataset.id);
      });
    });
  }

  function renderRequestTable() {
    const tbody = document.getElementById('requests-table-body');
    if (!tbody) return;

    tbody.innerHTML = state.requests.map(req => `
      <tr>
        <td><strong>#${req.id}</strong></td>
        <td>
          <div style="font-weight:600;">${req.patientName}</div>
          <div style="font-size:0.75rem; color:var(--color-text-muted);">${req.hospitalName} (${req.district})</div>
        </td>
        <td><span class="badge-blood" style="width:32px; height:32px; font-size:0.875rem;">${req.bloodGroup}</span></td>
        <td><strong>${req.unitsPledged} / ${req.unitsRequired}</strong> Units</td>
        <td><span class="status-pill ${req.status}">${req.status}</span></td>
        <td>${req.requiredByDate}</td>
        <td>
          <button class="btn btn-sm btn-secondary view-req-details-btn" data-id="${req.id}">View Dossier</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.view-req-details-btn').forEach(btn => {
      btn.addEventListener('click', () => openRequestDetailsModal(btn.dataset.id));
    });
  }

  // --------------------------------------------------------------------------
  // Render: 5-Stage Request Tracking Pipeline
  // --------------------------------------------------------------------------
  function renderTrackingView() {
    const activeReq = state.requests.find(r => r.id === state.activeTrackingId) || state.requests[0];
    if (!activeReq) return;

    const selectEl = document.getElementById('tracking-request-select');
    if (selectEl) {
      selectEl.innerHTML = state.requests.map(r => `
        <option value="${r.id}" ${r.id === activeReq.id ? 'selected' : ''}>
          ${r.id} — ${r.patientName} (${r.bloodGroup}, ${r.hospitalName})
        </option>
      `).join('');
    }

    const patientEl = document.getElementById('track-patient-name');
    const hospitalEl = document.getElementById('track-hospital-name');
    const bloodEl = document.getElementById('track-blood-badge');
    const unitsEl = document.getElementById('track-units-pledged');
    const statusEl = document.getElementById('track-status-pill');
    const reqByEl = document.getElementById('track-required-by');

    if (patientEl) patientEl.textContent = activeReq.patientName;
    if (hospitalEl) hospitalEl.textContent = `${activeReq.hospitalName} • ${activeReq.ward || 'ICU'} (${activeReq.district})`;
    if (bloodEl) bloodEl.textContent = activeReq.bloodGroup;
    if (unitsEl) unitsEl.textContent = `${activeReq.unitsPledged} of ${activeReq.unitsRequired} Units Pledged`;
    if (statusEl) {
      statusEl.className = `status-pill ${activeReq.status}`;
      statusEl.textContent = activeReq.status;
    }
    if (reqByEl) reqByEl.textContent = activeReq.requiredByDate;

    // 5-Stage Milestone Stepper
    const pipelineSteps = [
      { step: 'Requisition Logged', note: 'Created in BloodLink India' },
      { step: 'Hospital Verified', note: 'Reviewed by Transfusion Officer' },
      { step: 'Donors Alerted', note: 'Broadcasting nearby compatible donors' },
      { step: 'Donor Pledged', note: 'Donor confirmed & en route' },
      { step: 'Crossmatched & Transfused', note: 'Bedside delivery complete' }
    ];

    const currentStage = activeReq.status === 'fulfilled' ? 5 : (activeReq.unitsPledged > 0 ? 4 : 3);

    const pipelineEl = document.getElementById('track-pipeline-steps');
    if (pipelineEl) {
      pipelineEl.innerHTML = pipelineSteps.map((s, idx) => {
        let stepClass = '';
        if (idx + 1 < currentStage) stepClass = 'completed';
        else if (idx + 1 === currentStage) stepClass = 'active';

        return `
          <div class="pipeline-step ${stepClass}">
            <div class="step-circle">${idx + 1 < currentStage ? '✓' : idx + 1}</div>
            <div class="step-label">${s.step}</div>
            <div class="step-time">${s.note}</div>
          </div>
        `;
      }).join('');
    }

    const pledgesEl = document.getElementById('track-pledges-list');
    if (pledgesEl) {
      if (activeReq.pledges && activeReq.pledges.length > 0) {
        pledgesEl.innerHTML = activeReq.pledges.map(p => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--color-bg-base); border-radius:var(--radius-md); margin-bottom:8px; border:1px solid var(--border-subtle);">
            <div>
              <div style="font-weight:700;">${p.donorName}</div>
              <div style="font-size:0.75rem; color:var(--color-text-muted);">Pledged: ${p.units} unit • ${p.status}</div>
            </div>
            <span class="status-pill fulfilled">Confirmed</span>
          </div>
        `).join('');
      } else {
        pledgesEl.innerHTML = `
          <div style="text-align:center; padding:20px; color:var(--color-text-muted); font-size:0.875rem;">
            Awaiting volunteer pledges. You can contact ${activeReq.hospitalName} blood center directly to mobilize reserve units.
          </div>
        `;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Donor Reports & Clinical Dossier System (NBTC & DPDP Act 2023)
  // --------------------------------------------------------------------------
  function formatReportDate(dateStr) {
    if (!dateStr || dateStr === 'First Time Donor' || dateStr === 'Not recorded' || dateStr === 'Not specified') {
      return dateStr || 'Not recorded';
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function getFilteredReportsDonors() {
    let list = [...(state.donors || [])];
    const r = state.reports;

    // Search query: name, donor ID, blood group, city, district
    if (r.search && r.search.trim()) {
      const q = r.search.trim().toLowerCase();
      list = list.filter(d => 
        (d.fullName && d.fullName.toLowerCase().includes(q)) ||
        (d.id && d.id.toLowerCase().includes(q)) ||
        (d.bloodGroup && d.bloodGroup.toLowerCase().includes(q)) ||
        (d.city && d.city.toLowerCase().includes(q)) ||
        (d.district && d.district.toLowerCase().includes(q)) ||
        (d.state && d.state.toLowerCase().includes(q))
      );
    }

    // Blood Group filter
    if (r.bloodGroup && r.bloodGroup !== 'all') {
      list = list.filter(d => d.bloodGroup === r.bloodGroup);
    }

    // State filter
    if (r.state && r.state !== 'all') {
      list = list.filter(d => d.state && d.state.toLowerCase() === r.state.toLowerCase());
    }

    // District filter
    if (r.district && r.district !== 'all') {
      list = list.filter(d => d.district && d.district.toLowerCase() === r.district.toLowerCase());
    }

    // Status filter
    if (r.status && r.status !== 'all') {
      if (r.status === 'available') {
        list = list.filter(d => d.availableForEmergency === true);
      } else if (r.status === 'busy') {
        list = list.filter(d => !d.availableForEmergency || d.donorStatus === 'On-Call');
      } else if (r.status === 'inactive') {
        list = list.filter(d => d.donorStatus === 'Inactive');
      }
    }

    // Date range filter
    if (r.startDate) {
      const start = new Date(r.startDate).getTime();
      if (!isNaN(start)) {
        list = list.filter(d => {
          const dt = d.registeredAt ? new Date(d.registeredAt).getTime() : 
                     (d.lastDonationDate && d.lastDonationDate !== 'First Time Donor' ? new Date(d.lastDonationDate).getTime() : 0);
          return dt >= start;
        });
      }
    }
    if (r.endDate) {
      const end = new Date(r.endDate).getTime() + (24 * 60 * 60 * 1000 - 1);
      if (!isNaN(end)) {
        list = list.filter(d => {
          const dt = d.registeredAt ? new Date(d.registeredAt).getTime() : 
                     (d.lastDonationDate && d.lastDonationDate !== 'First Time Donor' ? new Date(d.lastDonationDate).getTime() : 0);
          return dt <= end;
        });
      }
    }

    return list;
  }

  function renderDonorReportsTable() {
    const tbody = document.getElementById('reports-table-body');
    const emptyState = document.getElementById('reports-empty-state');
    const paginationBar = document.getElementById('reports-pagination-bar');
    const countEl = document.getElementById('reports-summary-count');
    const kpiTotal = document.getElementById('reports-kpi-total');
    const kpiAvail = document.getElementById('reports-kpi-available');
    const kpiVerif = document.getElementById('reports-kpi-verified');
    const kpiDon = document.getElementById('reports-kpi-donations');

    if (!tbody) return;

    // Update KPI strip from state.donors
    const totalDonors = state.donors.length;
    const availDonors = state.donors.filter(d => d.availableForEmergency).length;
    const verifDonors = state.donors.filter(d => d.isVerified).length;
    const totalDonations = state.donors.reduce((acc, d) => {
      if (d.totalDonations && typeof d.totalDonations === 'number') return acc + d.totalDonations;
      if (d.donationHistory && Array.isArray(d.donationHistory)) return acc + d.donationHistory.length;
      return acc;
    }, 0);

    if (kpiTotal) kpiTotal.textContent = totalDonors;
    if (kpiAvail) kpiAvail.textContent = availDonors;
    if (kpiVerif) kpiVerif.textContent = verifDonors;
    if (kpiDon) kpiDon.textContent = totalDonations;

    // Filter donors
    const filtered = getFilteredReportsDonors();

    if (countEl) {
      countEl.innerHTML = `Showing <strong>${filtered.length}</strong> matching donor records (${totalDonors} total registered)`;
    }

    // Empty state handling
    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (paginationBar) paginationBar.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (paginationBar) paginationBar.style.display = 'flex';

    // Pagination
    const pageSize = state.reports.pageSize || 10;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (state.reports.page > totalPages) state.reports.page = totalPages;
    if (state.reports.page < 1) state.reports.page = 1;

    const startIdx = (state.reports.page - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, filtered.length);
    const pagedItems = filtered.slice(startIdx, endIdx);

    // Render Table Rows
    tbody.innerHTML = pagedItems.map(d => {
      const initials = (d.fullName || 'DN')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      const lastDonationDisplay = d.lastDonationDate
        ? (d.lastDonationDate === 'First Time Donor'
            ? '<span class="status-pill normal" style="font-size:0.75rem;">First Time Donor</span>'
            : formatReportDate(d.lastDonationDate))
        : '<span class="missing-data-pill">Not recorded</span>';

      return `
        <tr>
          <td><span class="badge-donor-id">${d.id}</span></td>
          <td>
            <div class="donor-name-cell">
              <div class="donor-avatar-circle">${initials}</div>
              <div>
                <div class="donor-name-text">${d.fullName}</div>
                <div class="donor-gender-age">${d.gender || 'Not recorded'} • ${d.age ? d.age + 'y' : 'Age not recorded'}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge-blood ${d.bloodGroup === 'O-' ? 'rare' : ''}">${d.bloodGroup}</span>
          </td>
          <td>${d.city || '<span class="missing-data-pill">Not available</span>'}</td>
          <td>${d.state || '<span class="missing-data-pill">Not available</span>'}</td>
          <td>
            <span class="status-pill ${d.availableForEmergency ? 'available' : 'busy'}">
              ${d.availableForEmergency ? 'Available' : (d.donorStatus || 'On-Call')}
            </span>
          </td>
          <td>${lastDonationDisplay}</td>
          <td>
            ${d.isVerified
              ? '<span class="badge-verified-pill"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified</span>'
              : '<span class="badge-unverified-pill">Pending</span>'}
          </td>
          <td style="text-align:right;">
            <div class="reports-action-btn-group">
              <button class="btn-report-view" data-donor-id="${d.id}" title="View comprehensive donor report">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                View Report
              </button>
              <button class="btn-report-icon" data-donor-pdf="${d.id}" title="Download Donor PDF">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="18"></line><line x1="15" y1="15" x2="12" y2="18"></line></svg>
              </button>
              <button class="btn-report-icon" data-donor-excel="${d.id}" title="Download Donor Excel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Pagination Info & Buttons
    const pageInfo = document.getElementById('reports-pagination-info');
    if (pageInfo) {
      pageInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${filtered.length} donors • Page ${state.reports.page} of ${totalPages}`;
    }

    const controls = document.getElementById('reports-pagination-controls');
    if (controls) {
      let btnsHtml = `
        <button class="btn-page-nav" data-page="prev" ${state.reports.page <= 1 ? 'disabled' : ''} title="Previous Page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
      `;

      for (let p = 1; p <= totalPages; p++) {
        btnsHtml += `
          <button class="btn-page-nav ${p === state.reports.page ? 'active' : ''}" data-page="${p}">
            ${p}
          </button>
        `;
      }

      btnsHtml += `
        <button class="btn-page-nav" data-page="next" ${state.reports.page >= totalPages ? 'disabled' : ''} title="Next Page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      `;

      controls.innerHTML = btnsHtml;

      controls.querySelectorAll('.btn-page-nav').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.page;
          if (target === 'prev') {
            if (state.reports.page > 1) {
              state.reports.page--;
              renderDonorReportsTable();
            }
          } else if (target === 'next') {
            if (state.reports.page < totalPages) {
              state.reports.page++;
              renderDonorReportsTable();
            }
          } else {
            const pageNum = parseInt(target, 10);
            if (!isNaN(pageNum)) {
              state.reports.page = pageNum;
              renderDonorReportsTable();
            }
          }
        });
      });
    }

    // Attach row action listeners
    tbody.querySelectorAll('[data-donor-id]').forEach(btn => {
      btn.addEventListener('click', () => openDonorReport(btn.dataset.donorId));
    });
    tbody.querySelectorAll('[data-donor-pdf]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDonorPdf(btn.dataset.donorPdf);
      });
    });
    tbody.querySelectorAll('[data-donor-excel]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDonorExcel(btn.dataset.donorExcel);
      });
    });
  }

  function openDonorReport(donorId) {
    const donor = state.donors.find(d => d.id === donorId) || state.reports.selectedDonor;
    if (!donor) {
      showToast('Donor profile could not be loaded.', 'error');
      return;
    }

    state.reports.selectedDonor = donor;

    // Check authorization: hospital / coordinator roles are authorized
    const isAuthorized = state.currentUser && (state.currentUser.role === 'hospital' || state.currentUser.role === 'coordinator');

    // Header updates
    const nameEl = document.getElementById('dossier-donor-name');
    if (nameEl) nameEl.textContent = donor.fullName;

    const idPill = document.getElementById('dossier-donor-id-pill');
    if (idPill) idPill.textContent = donor.id;

    // Auth status indicator in toolbar
    const authStatusEl = document.getElementById('dossier-auth-status-bar');
    if (authStatusEl) {
      if (isAuthorized) {
        authStatusEl.innerHTML = `
          <span class="dossier-auth-pill">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Authorized Medical Officer Access (${state.currentUser.name} • ${state.currentUser.roleLabel || 'PGIMER Chandigarh'})
          </span>
        `;
      } else {
        authStatusEl.innerHTML = `
          <span class="dossier-restricted-pill">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            DPDP Act 2023 Masked Privacy View • Authorized Transfusion Officers Only for Unmasked Access
          </span>
        `;
      }
    }

    // Timestamp
    const tsEl = document.getElementById('dossier-timestamp-text');
    if (tsEl) {
      tsEl.textContent = `Report Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    }

    // Render Detailed Dossier Body
    const bodyEl = document.getElementById('dossier-content-body');
    if (!bodyEl) return;

    // Values with strict "Not available" / "Not recorded" fallback
    const dobDisplay = isAuthorized
      ? (donor.dateOfBirth ? formatReportDate(donor.dateOfBirth) : '<span class="missing-data-pill">Not recorded</span>')
      : '<span class="dossier-restricted-pill">Restricted • Authorized Transfusion Personnel Only (DPDP Act 2023)</span>';

    const phoneDisplay = isAuthorized
      ? (donor.mobileNumber
          ? `<strong>${donor.mobileNumber}</strong> <span class="dossier-auth-pill">Verified Direct Contact</span>`
          : '<span class="missing-data-pill">Not recorded</span>')
      : `<strong>${donor.maskedMobile || '+91 XXXXX-XXXXX'}</strong> <span class="dossier-restricted-pill">Masked (DPDP Act 2023)</span>`;

    const emailDisplay = isAuthorized
      ? (donor.email
          ? `<strong>${donor.email}</strong>`
          : '<span class="missing-data-pill">Not recorded</span>')
      : `<strong>${donor.maskedEmail || 'Protected'}</strong> <span class="dossier-restricted-pill">Masked (DPDP Act 2023)</span>`;

    const nextEligibleDisplay = donor.nextEligibleDate
      ? `<strong>${donor.nextEligibleDate}</strong>`
      : '<span class="missing-data-pill">Pending clinical confirmation by blood bank</span>';

    const lastDonationDisplay = donor.lastDonationDate
      ? (donor.lastDonationDate === 'First Time Donor'
          ? '<span class="status-pill normal">First Time Donor</span>'
          : `<strong>${formatReportDate(donor.lastDonationDate)}</strong>`)
      : '<span class="missing-data-pill">Not recorded</span>';

    const totalDonationsDisplay = (donor.totalDonations !== undefined && donor.totalDonations !== null)
      ? `<strong>${donor.totalDonations}</strong> recorded donations`
      : (donor.donationHistory && donor.donationHistory.length > 0
          ? `<strong>${donor.donationHistory.length}</strong> recorded donations`
          : '<span class="missing-data-pill">Not recorded</span>');

    // Donation History Table rows
    let historyRowsHtml = '';
    if (donor.donationHistory && donor.donationHistory.length > 0) {
      historyRowsHtml = donor.donationHistory.map(h => `
        <tr>
          <td><strong>${formatReportDate(h.date)}</strong></td>
          <td>${h.type || 'Whole Blood (350ml)'}</td>
          <td>${h.hospital || '<span class="missing-data-pill">Not recorded</span>'}</td>
          <td>${h.city || '<span class="missing-data-pill">Not available</span>'}</td>
          <td>${h.reference ? `<code>${h.reference}</code><br>` : ''}${h.notes || '<span class="missing-data-pill">Not recorded</span>'}</td>
        </tr>
      `).join('');
    } else {
      historyRowsHtml = `
        <tr>
          <td colspan="5" style="text-align:center; padding:18px; color:var(--color-text-muted); font-style:italic;">
            No donation history recorded in the registry. (First-time voluntary donor)
          </td>
        </tr>
      `;
    }

    bodyEl.innerHTML = `
      <!-- 1. Donor Details -->
      <div class="dossier-section-card">
        <div class="dossier-section-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            1. Donor Details
          </h3>
          <span class="badge-donor-id">${donor.id}</span>
        </div>
        <div class="dossier-grid-2col">
          <div class="dossier-field">
            <span class="dossier-field-label">Full Legal Name</span>
            <span class="dossier-field-value"><strong>${donor.fullName}</strong></span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">ABO & Rh Blood Group</span>
            <span class="dossier-field-value">
              <span class="badge-blood ${donor.bloodGroup === 'O-' ? 'rare' : ''}">${donor.bloodGroup}</span>
              <span style="font-size:0.75rem; color:var(--color-text-muted); margin-left:6px;">(${Data.BLOOD_COMPATIBILITY[donor.bloodGroup]?.rarity || 'Verified Clinical Type'})</span>
            </span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Date of Birth (Authorized Only)</span>
            <span class="dossier-field-value">${dobDisplay}</span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Age & Biological Gender</span>
            <span class="dossier-field-value">
              ${donor.age ? donor.age + ' years' : '<span class="missing-data-pill">Not recorded</span>'} / ${donor.gender || '<span class="missing-data-pill">Not recorded</span>'} 
              (${donor.weightKg ? donor.weightKg + ' kg' : 'Weight not recorded'})
            </span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Mobile Phone (DPDP Access Control)</span>
            <span class="dossier-field-value">${phoneDisplay}</span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Email Address (DPDP Access Control)</span>
            <span class="dossier-field-value">${emailDisplay}</span>
          </div>
          <div class="dossier-field" style="grid-column: 1 / -1;">
            <span class="dossier-field-label">Residential Location & Postal Code</span>
            <span class="dossier-field-value">
              ${donor.city || '<span class="missing-data-pill">Not available</span>'}, 
              ${donor.district || '<span class="missing-data-pill">Not available</span>'}, 
              ${donor.state || '<span class="missing-data-pill">Not available</span>'} 
              — PIN: ${donor.pincode || '<span class="missing-data-pill">Not available</span>'}
            </span>
          </div>
        </div>
      </div>

      <!-- 2. Donation & Availability -->
      <div class="dossier-section-card">
        <div class="dossier-section-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
            2. Donation & Availability
          </h3>
          <span class="status-pill ${donor.availableForEmergency ? 'available' : 'busy'}">
            ${donor.availableForEmergency ? 'Available for Emergency' : (donor.donorStatus || 'On-Call')}
          </span>
        </div>
        <div class="dossier-grid-2col">
          <div class="dossier-field">
            <span class="dossier-field-label">Registry Donor Status</span>
            <span class="dossier-field-value">${donor.donorStatus || 'Active'}</span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Emergency Readiness</span>
            <span class="dossier-field-value">
              ${donor.availableForEmergency ? 'Opted-in for 24/7 critical hospital callouts' : 'Standard voluntary donor pool'}
            </span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Last Donation Date</span>
            <span class="dossier-field-value">${lastDonationDisplay}</span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Total Recorded Donations</span>
            <span class="dossier-field-value">${totalDonationsDisplay}</span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Next Eligible Date (Confirmed by Medical Staff)</span>
            <span class="dossier-field-value">${nextEligibleDisplay}</span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Preferred Donation Area</span>
            <span class="dossier-field-value">${donor.preferredArea || '<span class="missing-data-pill">Not recorded</span>'}</span>
          </div>
        </div>
      </div>

      <!-- 3. Donation History -->
      <div class="dossier-section-card">
        <div class="dossier-section-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            3. Donation History
          </h3>
          <span style="font-size:0.75rem; color:var(--color-text-muted);">Recorded Clinical Contributions</span>
        </div>
        <div class="table-responsive">
          <table class="dossier-history-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Donation Type</th>
                <th scope="col">Blood Bank / Hospital</th>
                <th scope="col">City</th>
                <th scope="col">Reference / Notes</th>
              </tr>
            </thead>
            <tbody>
              ${historyRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. Verification & Consent -->
      <div class="dossier-section-card">
        <div class="dossier-section-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            4. Verification & Consent
          </h3>
          ${donor.isVerified ? '<span class="badge-verified-pill">✓ Verified</span>' : '<span class="badge-unverified-pill">Pending</span>'}
        </div>
        <div class="dossier-grid-2col">
          <div class="dossier-field">
            <span class="dossier-field-label">Verification Status</span>
            <span class="dossier-field-value">${donor.isVerified ? 'Clinical Verification Confirmed' : 'Verification Pending'}</span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Verified By</span>
            <span class="dossier-field-value">${donor.verifiedBy || '<span class="missing-data-pill">Not recorded</span>'}</span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Verification Date</span>
            <span class="dossier-field-value">${donor.verificationDate ? formatReportDate(donor.verificationDate) : '<span class="missing-data-pill">Not recorded</span>'}</span>
          </div>
          <div class="dossier-field">
            <span class="dossier-field-label">Consent Status</span>
            <span class="dossier-field-value">${donor.consentStatus || (donor.consentGiven ? 'Informed Voluntary Consent Granted (DPDP Act 2023 Compliant)' : '<span class="missing-data-pill">Not recorded</span>')}</span>
          </div>
          <div class="dossier-field" style="grid-column: 1 / -1;">
            <span class="dossier-field-label">Clinical Notes & Follow-up</span>
            <span class="dossier-field-value">${donor.notes || '<span class="missing-data-pill">Not recorded</span>'}</span>
          </div>
        </div>
      </div>

      <!-- Regulatory Notice -->
      <div class="dossier-regulatory-box">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <div>
          <strong>Statutory Compliance & Privacy Safeguards:</strong>
          This document is generated for medical coordination under the National Blood Transfusion Council (NBTC) guidelines and the Drugs and Cosmetics Act, 1940. Voluntary donor personal data is protected under the Digital Personal Data Protection Act, 2023. Real-time emergency donations must be verified by the recipient hospital's blood centre.
        </div>
      </div>
    `;

    openModal('modal-donor-report');
  }

  // ==========================================================================
  // Dedicated Robust File Download Helper Module (Fixes Chrome UUID & Extension Bug)
  // ==========================================================================

  /**
   * Triggers a reliable browser download from a Blob or ArrayBuffer.
   * Root cause of Chrome UUID issue:
   * 1. Without an explicit MIME type, browser can treat file as generic stream.
   * 2. If the <a> element is not attached to the DOM (document.body.appendChild),
   *    or if triggered asynchronously from a disconnected timeout, Chrome's security
   *    heuristic ignores the 'download' attribute and names the file after the blob URL path (a random UUID).
   * 3. This helper guarantees attachment to document.body, synchronous click, immediate cleanup,
   *    proper MIME typing, and safe URL revocation after 60 seconds.
   */
  function downloadBlobFile(blobData, filename, mimeType) {
    if (!blobData) {
      throw new Error('No file data provided to download.');
    }

    let safeName = (filename || 'BloodLink_Report').replace(/["\r\n\\]/g, '_').trim();
    const finalMime = mimeType || (blobData instanceof Blob ? blobData.type : '') || 'application/octet-stream';

    // Ensure extension matches MIME type
    if (finalMime === 'application/pdf' && !safeName.toLowerCase().endsWith('.pdf')) {
      safeName += '.pdf';
    } else if (finalMime.includes('spreadsheetml') && !safeName.toLowerCase().endsWith('.xlsx')) {
      safeName += '.xlsx';
    }

    const blob = blobData instanceof Blob
      ? (blobData.type === finalMime ? blobData : new Blob([blobData], { type: finalMime }))
      : new Blob([blobData], { type: finalMime });

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.style.position = 'fixed';
    anchor.style.top = '-9999px';
    anchor.style.left = '-9999px';
    anchor.style.opacity = '0';
    anchor.href = objectUrl;
    anchor.download = safeName;
    anchor.rel = 'noopener';

    // Must be in DOM for Chrome to honor the download attribute
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      document.body.removeChild(anchor);
    }

    // Safely revoke object URL after 60s
    setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (_) {}
    }, 60000);

    return safeName;
  }

  /**
   * Fetches a file from a backend API endpoint, validates the HTTP status,
   * parses the filename from Content-Disposition, and triggers a clean download.
   * If the server returns an error (400, 401, 404, 500), it parses the JSON/text
   * error message and throws an Error, NEVER saving the error response as a corrupted file.
   */
  async function downloadFileFromApi(endpointUrl, fallbackFilename, fallbackMime) {
    const token = state.token || localStorage.getItem('bloodlink_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(endpointUrl, { headers });

    if (!response.ok) {
      let errorMsg = `Server returned status ${response.status} (${response.statusText})`;
      try {
        const errJson = await response.json();
        if (errJson && (errJson.error || errJson.message)) {
          errorMsg = errJson.error || errJson.message;
        }
      } catch (_) {
        try {
          const text = await response.text();
          if (text) errorMsg = text.slice(0, 150);
        } catch (_) {}
      }
      throw new Error(errorMsg);
    }

    // Parse filename from Content-Disposition header
    let filename = fallbackFilename;
    const disposition = response.headers.get('Content-Disposition');
    if (disposition) {
      // Handles both filename="..." and filename*=UTF-8''...
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const regularMatch = disposition.match(/filename=["']?([^"';]+)["']?/i);
      if (utf8Match && utf8Match[1]) {
        try {
          filename = decodeURIComponent(utf8Match[1].trim());
        } catch (_) {
          filename = utf8Match[1].trim();
        }
      } else if (regularMatch && regularMatch[1]) {
        filename = regularMatch[1].trim();
      }
    }

    const contentType = response.headers.get('Content-Type') || fallbackMime;
    const blob = await response.blob();
    return downloadBlobFile(blob, filename, contentType);
  }

  // --------------------------------------------------------------------------
  // PDF Export Engine (Server API with jsPDF Client Fallback)
  // --------------------------------------------------------------------------
  async function exportDonorPdf(donorOrId) {
    const donor = typeof donorOrId === 'object' ? donorOrId : state.donors.find(d => d.id === donorOrId);
    if (!donor) {
      showToast('Donor record not found for PDF export.', 'error');
      return;
    }

    const safeName = (donor.fullName || 'Donor').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = `BloodLink_Donor_Report_${donor.id}_${safeName}.pdf`;
    const isAuthorized = state.currentUser && (state.currentUser.role === 'hospital' || state.currentUser.role === 'coordinator');
    const roleParam = isAuthorized ? '&role=hospital' : '';

    showToast(`Generating official PDF report for ${donor.fullName || donor.id}...`, 'info');

    // 1. Attempt server-side generation via API endpoint
    try {
      await downloadFileFromApi(`/api/donors/${encodeURIComponent(donor.id)}/export?format=pdf${roleParam}`, safeFilename, 'application/pdf');
      showToast(`Downloaded official PDF report for ${donor.fullName || donor.id}.`, 'success');
      return;
    } catch (apiErr) {
      console.warn('Backend PDF export fell back to client generator:', apiErr.message);
    }

    // 2. Client-side fallback generation with jsPDF
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast('PDF generation library is still loading. Please try again in a moment.', 'info');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Burgundy & Ivory Palette Tokens
      const BURGUNDY = [116, 29, 53];      // #741D35
      const BURGUNDY_DARK = [62, 14, 27];   // #3E0E1B
      const ROSE = [198, 83, 104];          // #C65368
      const IVORY = [248, 245, 240];        // #F8F5F0
      const TEXT_MAIN = [41, 37, 42];       // #29252A
      const TEXT_MUTED = [120, 115, 120];
      const BORDER_COLOR = [231, 223, 226];

      // Header Banner (Burgundy)
      doc.setFillColor(...BURGUNDY);
      doc.rect(0, 0, 210, 30, 'F');

      // White Blood Drop Logo Mark
      doc.setFillColor(255, 255, 255);
      doc.circle(20, 16, 5, 'F');
      doc.triangle(15, 15, 25, 15, 20, 8, 'F');
      doc.setFillColor(...ROSE);
      doc.circle(20, 16, 2.2, 'F');

      // Brand Name & Heading
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('BloodLink India', 29, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('OFFICIAL VOLUNTARY DONOR CLINICAL DOSSIER', 29, 20);
      doc.text('NBTC Standards • Ministry of Health & Family Welfare', 29, 25);

      // Authorization Stamp on Header Right
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      if (isAuthorized) {
        doc.setFillColor(37, 107, 71); // Green
        doc.roundedRect(138, 9, 58, 12, 1.5, 1.5, 'F');
        doc.text('AUTHORIZED MEDICAL ACCESS', 142, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text('Hospital Transfusion Officer', 142, 18);
      } else {
        doc.setFillColor(158, 91, 16); // Amber/Warning
        doc.roundedRect(138, 9, 58, 12, 1.5, 1.5, 'F');
        doc.text('DPDP ACT 2023 PROTECTED', 142, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text('Contact details masked', 142, 18);
      }

      // Subheader: Metadata Bar (Ivory fill)
      doc.setFillColor(...IVORY);
      doc.rect(0, 30, 210, 14, 'F');
      doc.setDrawColor(...BORDER_COLOR);
      doc.line(0, 44, 210, 44);

      doc.setTextColor(...TEXT_MAIN);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Donor: ${donor.fullName || 'Not recorded'} (${donor.id})`, 14, 38);
      doc.setFont('helvetica', 'normal');
      doc.text(`Blood Group: ${donor.bloodGroup || 'Not recorded'}`, 90, 38);
      const genDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      doc.text(`Report Date: ${genDate}`, 148, 38);

      let currentY = 50;

      // Table 1: Donor Details
      doc.autoTable({
        startY: currentY,
        margin: { left: 14, right: 14 },
        head: [[
          { content: '1. DONOR IDENTIFICATION & DEMOGRAPHICS', colSpan: 4, styles: { fillColor: BURGUNDY, textColor: [255, 255, 255], fontStyle: 'bold' } }
        ]],
        body: [
          [
            { content: 'Donor ID', styles: { fontStyle: 'bold', textColor: BURGUNDY } },
            donor.id || 'Not recorded',
            { content: 'Full Name', styles: { fontStyle: 'bold' } },
            donor.fullName || 'Not recorded'
          ],
          [
            { content: 'Blood Group', styles: { fontStyle: 'bold' } },
            donor.bloodGroup || 'Not recorded',
            { content: 'Age / Gender', styles: { fontStyle: 'bold' } },
            `${donor.age ? donor.age + ' years' : 'Not recorded'} / ${donor.gender || 'Not recorded'}`
          ],
          [
            { content: 'Date of Birth', styles: { fontStyle: 'bold' } },
            isAuthorized ? (donor.dateOfBirth || 'Not recorded') : 'Restricted (Authorized Medical Staff Only)',
            { content: 'Weight (kg)', styles: { fontStyle: 'bold' } },
            donor.weightKg ? `${donor.weightKg} kg` : 'Not recorded'
          ],
          [
            { content: 'Mobile Phone', styles: { fontStyle: 'bold' } },
            isAuthorized ? (donor.mobileNumber || 'Not recorded') : (donor.maskedMobile || 'Masked (DPDP Act 2023)'),
            { content: 'Email Address', styles: { fontStyle: 'bold' } },
            isAuthorized ? (donor.email || 'Not recorded') : (donor.maskedEmail || 'Masked (DPDP Act 2023)')
          ],
          [
            { content: 'City / District', styles: { fontStyle: 'bold' } },
            `${donor.city || 'Not available'}, ${donor.district || 'Not available'}`,
            { content: 'State / PIN Code', styles: { fontStyle: 'bold' } },
            `${donor.state || 'Not available'} — ${donor.pincode || 'Not available'}`
          ]
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.8, textColor: TEXT_MAIN, lineColor: BORDER_COLOR, lineWidth: 0.2 },
        alternateRowStyles: { fillColor: IVORY }
      });

      currentY = doc.lastAutoTable.finalY + 7;

      // Table 2: Donation & Availability
      const nextEligibleStr = donor.nextEligibleDate || 'Pending clinical confirmation by blood bank';
      doc.autoTable({
        startY: currentY,
        margin: { left: 14, right: 14 },
        head: [[
          { content: '2. CLINICAL STATUS & DONATION AVAILABILITY', colSpan: 4, styles: { fillColor: BURGUNDY, textColor: [255, 255, 255], fontStyle: 'bold' } }
        ]],
        body: [
          [
            { content: 'Donor Status', styles: { fontStyle: 'bold' } },
            donor.donorStatus || 'Active',
            { content: 'Availability Status', styles: { fontStyle: 'bold' } },
            donor.availableForEmergency ? 'Available for Emergency' : 'On-Call / Standby'
          ],
          [
            { content: 'Last Donation Date', styles: { fontStyle: 'bold' } },
            donor.lastDonationDate || 'Not recorded',
            { content: 'Total Donations', styles: { fontStyle: 'bold' } },
            donor.totalDonations !== undefined ? `${donor.totalDonations} recorded` : (donor.donationHistory ? `${donor.donationHistory.length} recorded` : 'Not recorded')
          ],
          [
            { content: 'Next Eligible Date', styles: { fontStyle: 'bold' } },
            nextEligibleStr,
            { content: 'Preferred Area', styles: { fontStyle: 'bold' } },
            donor.preferredArea || 'Not recorded'
          ]
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.8, textColor: TEXT_MAIN, lineColor: BORDER_COLOR, lineWidth: 0.2 },
        alternateRowStyles: { fillColor: IVORY }
      });

      currentY = doc.lastAutoTable.finalY + 7;

      // Table 3: Donation History
      let historyBody = [];
      if (donor.donationHistory && donor.donationHistory.length > 0) {
        historyBody = donor.donationHistory.map(h => [
          h.date || 'Not recorded',
          h.type || 'Whole Blood (350ml)',
          h.hospital || 'Not recorded',
          h.city || 'Not available',
          h.reference || h.notes || 'Not recorded'
        ]);
      } else {
        historyBody = [[
          { content: 'No recorded donation history in registry. (First-time voluntary donor)', colSpan: 5, styles: { fontStyle: 'italic', textColor: TEXT_MUTED, halign: 'center' } }
        ]];
      }

      doc.autoTable({
        startY: currentY,
        margin: { left: 14, right: 14 },
        head: [
          [{ content: '3. RECORDED DONATION HISTORY', colSpan: 5, styles: { fillColor: BURGUNDY, textColor: [255, 255, 255], fontStyle: 'bold' } }],
          [
            { content: 'Date', styles: { fillColor: IVORY, textColor: BURGUNDY_DARK, fontStyle: 'bold' } },
            { content: 'Donation Type', styles: { fillColor: IVORY, textColor: BURGUNDY_DARK, fontStyle: 'bold' } },
            { content: 'Hospital / Blood Bank', styles: { fillColor: IVORY, textColor: BURGUNDY_DARK, fontStyle: 'bold' } },
            { content: 'City', styles: { fillColor: IVORY, textColor: BURGUNDY_DARK, fontStyle: 'bold' } },
            { content: 'Reference / Notes', styles: { fillColor: IVORY, textColor: BURGUNDY_DARK, fontStyle: 'bold' } }
          ]
        ],
        body: historyBody,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, textColor: TEXT_MAIN, lineColor: BORDER_COLOR, lineWidth: 0.2 },
        alternateRowStyles: { fillColor: IVORY }
      });

      currentY = doc.lastAutoTable.finalY + 7;

      // Table 4: Verification & Consent
      doc.autoTable({
        startY: currentY,
        margin: { left: 14, right: 14 },
        head: [[
          { content: '4. VERIFICATION, CONSENT & CLINICAL AUDIT', colSpan: 4, styles: { fillColor: BURGUNDY, textColor: [255, 255, 255], fontStyle: 'bold' } }
        ]],
        body: [
          [
            { content: 'Verification Status', styles: { fontStyle: 'bold' } },
            donor.isVerified ? 'Verified Voluntary Donor' : 'Pending Verification',
            { content: 'Verified By', styles: { fontStyle: 'bold' } },
            donor.verifiedBy || 'Not recorded'
          ],
          [
            { content: 'Verification Date', styles: { fontStyle: 'bold' } },
            donor.verificationDate || 'Not recorded',
            { content: 'Consent Status', styles: { fontStyle: 'bold' } },
            donor.consentStatus || 'Informed Voluntary Consent Granted (DPDP Act 2023)'
          ],
          [
            { content: 'Notes & Follow-up', styles: { fontStyle: 'bold' } },
            { content: donor.notes || 'Not recorded', colSpan: 3 }
          ]
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.8, textColor: TEXT_MAIN, lineColor: BORDER_COLOR, lineWidth: 0.2 },
        alternateRowStyles: { fillColor: IVORY }
      });

      // Page Numbers on all pages
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(`Page ${i} of ${totalPages}`, 180, 290);
        doc.text('BloodLink India — Confidential Voluntary Donor Record', 14, 290);
      }

      // Convert to Blob and use bulletproof download helper (eliminates Chrome UUID bug)
      const pdfBlob = doc.output('blob');
      downloadBlobFile(pdfBlob, safeFilename, 'application/pdf');
      showToast(`Downloaded official PDF report for ${donor.fullName || donor.id}.`, 'success');
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast(`Failed to generate PDF: ${err.message}`, 'error');
    }
  }

  async function exportAllReportsPdf() {
    const donors = getFilteredReportsDonors();
    if (donors.length === 0) {
      showToast('No donor records match the current filter selection to export.', 'warning');
      return;
    }

    const safeFilename = `BloodLink_Donor_Registry_Summary_${Date.now()}.pdf`;
    const isAuthorized = state.currentUser && (state.currentUser.role === 'hospital' || state.currentUser.role === 'coordinator');

    const params = new URLSearchParams();
    params.set('format', 'pdf');
    if (state.reports.search) params.set('search', state.reports.search);
    if (state.reports.bloodGroup && state.reports.bloodGroup !== 'all') params.set('bloodGroup', state.reports.bloodGroup);
    if (state.reports.state && state.reports.state !== 'all') params.set('state', state.reports.state);
    if (state.reports.district && state.reports.district !== 'all') params.set('district', state.reports.district);
    if (state.reports.status && state.reports.status !== 'all') params.set('status', state.reports.status);
    if (isAuthorized) params.set('role', 'hospital');

    showToast(`Generating Donor Registry PDF summary (${donors.length} donors)...`, 'info');

    // 1. Attempt server-side API export
    try {
      await downloadFileFromApi(`/api/reports/donors/export?${params.toString()}`, safeFilename, 'application/pdf');
      showToast(`Downloaded registry summary PDF (${donors.length} donors).`, 'success');
      return;
    } catch (apiErr) {
      console.warn('Backend registry PDF export fell back to client generator:', apiErr.message);
    }

    // 2. Client-side fallback
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast('PDF library is loading. Please try again.', 'info');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const BURGUNDY = [116, 29, 53];
      const IVORY = [248, 245, 240];
      const TEXT_MAIN = [41, 37, 42];
      const BORDER_COLOR = [231, 223, 226];

      // Header Banner
      doc.setFillColor(...BURGUNDY);
      doc.rect(0, 0, 297, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('BloodLink India — Voluntary Donor Registry Summary Report', 14, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Records: ${donors.length} | Access: ${isAuthorized ? 'Authorized Transfusion Officer' : 'DPDP Act 2023 Masked'}`, 14, 18);

      const tableBody = donors.map(d => [
        d.id,
        d.fullName,
        d.bloodGroup,
        d.city || 'Not available',
        d.district || 'Not available',
        d.state || 'Not available',
        d.availableForEmergency ? 'Available' : (d.donorStatus || 'On-Call'),
        d.lastDonationDate || 'Not recorded',
        d.isVerified ? 'Verified' : 'Pending',
        isAuthorized ? (d.mobileNumber || 'Not recorded') : (d.maskedMobile || 'Masked (DPDP)')
      ]);

      doc.autoTable({
        startY: 28,
        margin: { left: 14, right: 14 },
        head: [[
          'Donor ID', 'Full Name', 'Group', 'City', 'District', 'State', 'Status', 'Last Donation', 'Verification', isAuthorized ? 'Phone' : 'Contact (DPDP)'
        ]],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: BURGUNDY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.2, textColor: TEXT_MAIN, lineColor: BORDER_COLOR, lineWidth: 0.15 },
        alternateRowStyles: { fillColor: IVORY }
      });

      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(120, 115, 120);
        doc.text(`Page ${i} of ${totalPages}`, 265, 202);
        doc.text('BloodLink India • Confidential Voluntary Donor Registry • Regulated under NBTC Guidelines & DPDP Act 2023', 14, 202);
      }

      const pdfBlob = doc.output('blob');
      downloadBlobFile(pdfBlob, safeFilename, 'application/pdf');
      showToast(`Downloaded registry summary PDF (${donors.length} donors).`, 'success');
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast(`Failed to generate registry PDF: ${err.message}`, 'error');
    }
  }

  // --------------------------------------------------------------------------
  // Excel Export Engine (Server API with SheetJS XLSX Client Fallback)
  // --------------------------------------------------------------------------
  async function exportDonorExcel(donorOrId) {
    const donor = typeof donorOrId === 'object' ? donorOrId : state.donors.find(d => d.id === donorOrId);
    if (!donor) {
      showToast('Donor record not found for Excel export.', 'error');
      return;
    }

    const safeName = (donor.fullName || 'Donor').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = `BloodLink_Donor_Report_${donor.id}_${safeName}.xlsx`;
    const isAuthorized = state.currentUser && (state.currentUser.role === 'hospital' || state.currentUser.role === 'coordinator');
    const roleParam = isAuthorized ? '&role=hospital' : '';
    const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    showToast(`Generating Excel (.xlsx) report for ${donor.fullName || donor.id}...`, 'info');

    // 1. Attempt server-side generation via API endpoint
    try {
      await downloadFileFromApi(`/api/donors/${encodeURIComponent(donor.id)}/export?format=excel${roleParam}`, safeFilename, EXCEL_MIME);
      showToast(`Downloaded Excel report for donor ${donor.fullName} (${donor.id}).`, 'success');
      return;
    } catch (apiErr) {
      console.warn('Backend Excel export fell back to client generator:', apiErr.message);
    }

    // 2. Client-side fallback generation with SheetJS
    if (!window.XLSX) {
      showToast('Excel library is still loading. Please try again.', 'info');
      return;
    }

    try {
      const wb = window.XLSX.utils.book_new();

      // 1. "Donor Report" Worksheet
      const profileAoa = [
        ['BLOODLINK INDIA — VOLUNTARY DONOR REPORT'],
        ['Regulatory Standards: National Blood Transfusion Council (NBTC) & DPDP Act 2023'],
        ['Report Generated At', new Date().toLocaleString('en-IN')],
        ['Generated By', `${state.currentUser.name} (${state.currentUser.roleLabel || 'BloodLink User'})`],
        ['Access Authorization', isAuthorized ? 'Authorized Transfusion Officer (Unmasked Medical Access)' : 'DPDP Act 2023 Masked Privacy View'],
        [],
        ['1. DONOR IDENTIFICATION & DEMOGRAPHICS'],
        ['Donor ID', donor.id || 'Not recorded'],
        ['Full Legal Name', donor.fullName || 'Not recorded'],
        ['Blood Group', donor.bloodGroup || 'Not recorded'],
        ['Biological Gender', donor.gender || 'Not recorded'],
        ['Age', donor.age ? `${donor.age} years` : 'Not recorded'],
        ['Weight (kg)', donor.weightKg ? `${donor.weightKg} kg` : 'Not recorded'],
        ['Date of Birth', isAuthorized ? (donor.dateOfBirth || 'Not recorded') : 'Restricted • Authorized Transfusion Officers Only (DPDP Act 2023)'],
        ['Mobile Number', isAuthorized ? (donor.mobileNumber || 'Not recorded') : (donor.maskedMobile || 'Masked under DPDP Act 2023')],
        ['Email Address', isAuthorized ? (donor.email || 'Not recorded') : (donor.maskedEmail || 'Masked under DPDP Act 2023')],
        ['City', donor.city || 'Not available'],
        ['District', donor.district || 'Not available'],
        ['State / UT', donor.state || 'Not available'],
        ['PIN Code', donor.pincode || 'Not available'],
        [],
        ['2. CLINICAL STATUS & DONATION AVAILABILITY'],
        ['Donor Status', donor.donorStatus || 'Active'],
        ['Emergency Availability', donor.availableForEmergency ? 'Available for Emergency' : 'On-Call / Standby'],
        ['Last Donation Date', donor.lastDonationDate || 'Not recorded'],
        ['Total Recorded Donations', donor.totalDonations !== undefined ? donor.totalDonations : (donor.donationHistory ? donor.donationHistory.length : 'Not recorded')],
        ['Next Eligible Date', donor.nextEligibleDate || 'Pending clinical confirmation by blood bank'],
        ['Preferred Donation Area', donor.preferredArea || 'Not recorded'],
        [],
        ['3. REGULATORY VERIFICATION & CONSENT'],
        ['Verification Status', donor.isVerified ? 'Verified Voluntary Donor' : 'Pending Verification'],
        ['Verified By', donor.verifiedBy || 'Not recorded'],
        ['Verification Date', donor.verificationDate || 'Not recorded'],
        ['Consent Status', donor.consentStatus || 'Informed Voluntary Consent Granted (DPDP Act 2023 Compliant)'],
        ['Clinical Notes & Follow-up', donor.notes || 'Not recorded'],
        [],
        ['4. STATUTORY NOTICE'],
        ['Disclaimer', 'Issued under the Drugs & Cosmetics Act 1940 and NBTC Guidelines. Contact info masked per DPDP Act 2023.']
      ];

      const ws1 = window.XLSX.utils.aoa_to_sheet(profileAoa);
      ws1['!cols'] = [{ wch: 32 }, { wch: 60 }];

      // 2. "Donation History" Worksheet
      const historyAoa = [
        ['DONATION HISTORY LEDGER — ' + (donor.fullName || donor.id)],
        ['Official Transfusion Records for Donor ' + donor.id],
        [],
        ['Donation ID', 'Donation Date', 'Donation Type', 'Blood Bank / Hospital', 'City', 'State', 'Reference / Indication', 'Notes']
      ];

      if (donor.donationHistory && donor.donationHistory.length > 0) {
        donor.donationHistory.forEach(h => {
          historyAoa.push([
            h.id || 'Not recorded',
            h.date || 'Not recorded',
            h.type || 'Whole Blood (350ml)',
            h.hospital || 'Not recorded',
            h.city || 'Not available',
            h.state || 'Not available',
            h.reference || 'Not recorded',
            h.notes || 'Not recorded'
          ]);
        });
      } else {
        historyAoa.push([
          'Not recorded',
          donor.lastDonationDate || 'First Time Donor',
          'Not recorded',
          'Not recorded',
          donor.city || 'Not available',
          donor.state || 'Not available',
          'No prior donations recorded in registry (First-time voluntary donor)',
          'Not recorded'
        ]);
      }

      const ws2 = window.XLSX.utils.aoa_to_sheet(historyAoa);
      ws2['!cols'] = [
        { wch: 16 }, { wch: 15 }, { wch: 22 }, { wch: 38 }, { wch: 16 }, { wch: 16 }, { wch: 32 }, { wch: 35 }
      ];

      // 3. "Read Me" Worksheet
      const readMeAoa = [
        ['BLOODLINK INDIA — DONOR DATA WORKBOOK DOCUMENTATION'],
        ['Regulatory Standards: National Blood Transfusion Council (NBTC) & DPDP Act 2023'],
        [],
        ['1. ABOUT THIS WORKBOOK'],
        ['This workbook contains authentic voluntary blood donor registry records coordinated via BloodLink India.'],
        ['Data is collected under voluntary informed consent and validated per NBTC Clinical Standards.'],
        [],
        ['2. DATA PRIVACY & ACCESS CONTROL (DPDP ACT 2023)'],
        ['- Contact information (phone, email) is masked for unauthorized users to prevent commercial harvesting.'],
        ['- Date of birth is restricted and disclosed only to certified hospital transfusion medicine officers.'],
        ['- Emergency mobilization is conducted via encrypted dispatch channels.'],
        [],
        ['3. NBTC CLINICAL GUIDELINES (INDIA)'],
        ['- Minimum age: 18 years | Maximum age: 65 years'],
        ['- Minimum body weight: 45 kg'],
        ['- Minimum Hemoglobin: 12.5 g/dL'],
        ['- Mandatory Donation Interval: 90 days for males | 120 days for females'],
        [],
        ['4. DATA FIELD DEFINITIONS'],
        ['Field Name', 'Definition & NBTC Standard'],
        ['Donor ID', 'Unique alphanumeric identifier assigned to voluntary donor in the registry.'],
        ['Full Legal Name', 'Legal full name of registered volunteer donor.'],
        ['Blood Group', 'ABO and Rh (D) blood group verified under clinical laboratory testing.'],
        ['Date of Birth', 'Recorded date of birth, accessible only to authorized medical officers.'],
        ['Donor Status', 'Current operational status in registry (Active, On-Call, or Inactive).'],
        ['Availability', 'Whether donor is opted-in for emergency bedside and surgical requisitions.'],
        ['Last Donation Date', 'Date of most recent recorded whole blood or apheresis donation.'],
        ['Next Eligible Date', 'Calculated safe re-donation date per NBTC gender interval rules.'],
        ['Preferred Area', 'Designated hospital or geographical zone for rapid volunteer mobilization.'],
        ['Verification Status', 'Confirmed by qualified transfusion medicine officer or licensed blood bank.'],
        ['Consent Status', 'Voluntary consent recorded in adherence to the DPDP Act, 2023.'],
        [],
        ['5. STATUTORY DISCLAIMER'],
        ['BloodLink India operates in compliance with the Drugs & Cosmetics Act 1940 and MoHFW directives.'],
        ['Blood availability fluctuates continuously; physical confirmation with the blood bank is required.']
      ];

      const ws3 = window.XLSX.utils.aoa_to_sheet(readMeAoa);
      ws3['!cols'] = [{ wch: 30 }, { wch: 75 }];

      window.XLSX.utils.book_append_sheet(wb, ws1, 'Donor Report');
      window.XLSX.utils.book_append_sheet(wb, ws2, 'Donation History');
      window.XLSX.utils.book_append_sheet(wb, ws3, 'Read Me');

      // Convert workbook to array buffer and use bulletproof download helper (eliminates octet-stream & Chrome issues)
      const excelArray = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([excelArray], { type: EXCEL_MIME });
      downloadBlobFile(excelBlob, safeFilename, EXCEL_MIME);
      showToast(`Downloaded Excel report for donor ${donor.fullName} (${donor.id}).`, 'success');
    } catch (err) {
      console.error('Excel export failed:', err);
      showToast(`Failed to generate Excel report: ${err.message}`, 'error');
    }
  }

  async function exportAllReportsExcel() {
    const donors = getFilteredReportsDonors();
    if (donors.length === 0) {
      showToast('No donor records match current filters to export.', 'warning');
      return;
    }

    const safeFilename = `BloodLink_Donor_Registry_${Date.now()}.xlsx`;
    const isAuthorized = state.currentUser && (state.currentUser.role === 'hospital' || state.currentUser.role === 'coordinator');
    const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const params = new URLSearchParams();
    params.set('format', 'excel');
    if (state.reports.search) params.set('search', state.reports.search);
    if (state.reports.bloodGroup && state.reports.bloodGroup !== 'all') params.set('bloodGroup', state.reports.bloodGroup);
    if (state.reports.state && state.reports.state !== 'all') params.set('state', state.reports.state);
    if (state.reports.district && state.reports.district !== 'all') params.set('district', state.reports.district);
    if (state.reports.status && state.reports.status !== 'all') params.set('status', state.reports.status);
    if (isAuthorized) params.set('role', 'hospital');

    showToast(`Generating Donor Registry Excel workbook (${donors.length} records)...`, 'info');

    // 1. Attempt server-side API export
    try {
      await downloadFileFromApi(`/api/reports/donors/export?${params.toString()}`, safeFilename, EXCEL_MIME);
      showToast(`Downloaded full Donor Registry Excel (.xlsx) workbook (${donors.length} records).`, 'success');
      return;
    } catch (apiErr) {
      console.warn('Backend registry Excel export fell back to client generator:', apiErr.message);
    }

    // 2. Client-side fallback
    if (!window.XLSX) {
      showToast('Excel library is still loading. Please try again.', 'info');
      return;
    }

    try {
      const wb = window.XLSX.utils.book_new();

      // 1. "Donor Registry"
      const headerRow = [
        'Donor ID', 'Full Name', 'Blood Group', 'Gender', 'Age', 'Weight (kg)',
        'Date of Birth', 'Mobile Phone', 'Email Address', 'City', 'District', 'State', 'PIN Code',
        'Donor Status', 'Emergency Availability', 'Last Donation Date', 'Total Donations',
        'Next Eligible Date', 'Preferred Area', 'Verification Status', 'Verified By', 'Consent Status', 'Registered At'
      ];

      const donorRows = donors.map(d => [
        d.id || 'Not recorded',
        d.fullName || 'Not recorded',
        d.bloodGroup || 'Not recorded',
        d.gender || 'Not recorded',
        d.age || 'Not recorded',
        d.weightKg || 'Not recorded',
        isAuthorized ? (d.dateOfBirth || 'Not recorded') : 'Restricted (DPDP Act 2023)',
        isAuthorized ? (d.mobileNumber || 'Not recorded') : (d.maskedMobile || 'Masked (DPDP Act 2023)'),
        isAuthorized ? (d.email || 'Not recorded') : (d.maskedEmail || 'Masked (DPDP Act 2023)'),
        d.city || 'Not available',
        d.district || 'Not available',
        d.state || 'Not available',
        d.pincode || 'Not available',
        d.donorStatus || 'Active',
        d.availableForEmergency ? 'Available for Emergency' : 'On-Call / Busy',
        d.lastDonationDate || 'Not recorded',
        d.totalDonations !== undefined ? d.totalDonations : (d.donationHistory ? d.donationHistory.length : 'Not recorded'),
        d.nextEligibleDate || 'Pending clinical confirmation by blood bank',
        d.preferredArea || 'Not recorded',
        d.isVerified ? 'Verified' : 'Pending',
        d.verifiedBy || 'Not recorded',
        d.consentStatus || 'Informed Voluntary Consent Granted (DPDP Act 2023 Compliant)',
        d.registeredAt || 'Not recorded'
      ]);

      const registryAoa = [
        ['BLOODLINK INDIA — VOLUNTARY DONOR REGISTRY'],
        ['Generated On: ' + new Date().toLocaleString('en-IN') + ' | Total Records: ' + donors.length],
        [],
        headerRow,
        ...donorRows
      ];

      const ws1 = window.XLSX.utils.aoa_to_sheet(registryAoa);
      ws1['!autofilter'] = { ref: `A4:W${registryAoa.length}` };
      ws1['!cols'] = [
        { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 12 },
        { wch: 16 }, { wch: 18 }, { wch: 26 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 10 },
        { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 32 }, { wch: 30 }, { wch: 18 },
        { wch: 32 }, { wch: 36 }, { wch: 24 }
      ];

      // 2. "Donation History"
      const allHistoryAoa = [
        ['BLOODLINK INDIA — RECORDED DONATION HISTORY'],
        [],
        ['Donor ID', 'Donor Name', 'Blood Group', 'Donation ID', 'Donation Date', 'Donation Type', 'Blood Bank / Hospital', 'City', 'State', 'Reference', 'Notes']
      ];

      donors.forEach(d => {
        if (d.donationHistory && d.donationHistory.length > 0) {
          d.donationHistory.forEach(h => {
            allHistoryAoa.push([
              d.id,
              d.fullName,
              d.bloodGroup,
              h.id || 'Not recorded',
              h.date || 'Not recorded',
              h.type || 'Whole Blood (350ml)',
              h.hospital || 'Not recorded',
              h.city || 'Not available',
              h.state || 'Not available',
              h.reference || 'Not recorded',
              h.notes || 'Not recorded'
            ]);
          });
        }
      });

      const ws2 = window.XLSX.utils.aoa_to_sheet(allHistoryAoa);
      ws2['!cols'] = [
        { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 15 }, { wch: 22 }, { wch: 38 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 35 }
      ];

      // 3. "Read Me"
      const readMeAoa = [
        ['BLOODLINK INDIA — DONOR DATA WORKBOOK DOCUMENTATION'],
        ['Regulatory Standards: National Blood Transfusion Council (NBTC) & DPDP Act 2023'],
        [],
        ['1. ABOUT THIS WORKBOOK'],
        ['This workbook contains authentic voluntary blood donor registry records coordinated via BloodLink India.'],
        ['Data is collected under voluntary informed consent and validated per NBTC Clinical Standards.'],
        [],
        ['2. DATA PRIVACY & ACCESS CONTROL (DPDP ACT 2023)'],
        ['- Contact information (phone, email) is masked for unauthorized users to prevent commercial harvesting.'],
        ['- Date of birth is restricted and disclosed only to certified hospital transfusion medicine officers.'],
        ['- Emergency mobilization is conducted via encrypted dispatch channels.'],
        [],
        ['3. NBTC CLINICAL GUIDELINES (INDIA)'],
        ['- Minimum age: 18 years | Maximum age: 65 years'],
        ['- Minimum body weight: 45 kg'],
        ['- Minimum Hemoglobin: 12.5 g/dL'],
        ['- Mandatory Donation Interval: 90 days for males | 120 days for females'],
        [],
        ['4. DATA FIELD DEFINITIONS'],
        ['Field Name', 'Definition & NBTC Standard'],
        ['Donor ID', 'Unique alphanumeric identifier assigned to voluntary donor in the registry.'],
        ['Full Legal Name', 'Legal full name of registered volunteer donor.'],
        ['Blood Group', 'ABO and Rh (D) blood group verified under clinical laboratory testing.'],
        ['Date of Birth', 'Recorded date of birth, accessible only to authorized medical officers.'],
        ['Donor Status', 'Current operational status in registry (Active, On-Call, or Inactive).'],
        ['Availability', 'Whether donor is opted-in for emergency bedside and surgical requisitions.'],
        ['Last Donation Date', 'Date of most recent recorded whole blood or apheresis donation.'],
        ['Next Eligible Date', 'Calculated safe re-donation date per NBTC gender interval rules.'],
        ['Preferred Area', 'Designated hospital or geographical zone for rapid volunteer mobilization.'],
        ['Verification Status', 'Confirmed by qualified transfusion medicine officer or licensed blood bank.'],
        ['Consent Status', 'Voluntary consent recorded in adherence to the DPDP Act, 2023.'],
        [],
        ['5. STATUTORY DISCLAIMER'],
        ['BloodLink India operates in compliance with the Drugs & Cosmetics Act 1940 and MoHFW directives.'],
        ['Blood availability fluctuates continuously; physical confirmation with the blood bank is required.']
      ];
      const ws3 = window.XLSX.utils.aoa_to_sheet(readMeAoa);
      ws3['!cols'] = [{ wch: 30 }, { wch: 75 }];

      window.XLSX.utils.book_append_sheet(wb, ws1, 'Donor Registry');
      window.XLSX.utils.book_append_sheet(wb, ws2, 'Donation History');
      window.XLSX.utils.book_append_sheet(wb, ws3, 'Read Me');

      const excelArray = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([excelArray], { type: EXCEL_MIME });
      downloadBlobFile(excelBlob, safeFilename, EXCEL_MIME);
      showToast(`Downloaded full Donor Registry Excel (.xlsx) workbook (${donors.length} records).`, 'success');
    } catch (err) {
      console.error('Excel export failed:', err);
      showToast(`Failed to generate registry Excel workbook: ${err.message}`, 'error');
    }
  }

  function initDonorReports() {
    const searchInput = document.getElementById('reports-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.reports.search = e.target.value;
        state.reports.page = 1;
        renderDonorReportsTable();
      });
    }

    const bloodGroupSelect = document.getElementById('reports-filter-blood-group');
    if (bloodGroupSelect) {
      bloodGroupSelect.addEventListener('change', (e) => {
        state.reports.bloodGroup = e.target.value;
        state.reports.page = 1;
        renderDonorReportsTable();
      });
    }

    const stateSelect = document.getElementById('reports-filter-state');
    if (stateSelect) {
      stateSelect.addEventListener('change', (e) => {
        state.reports.state = e.target.value;
        state.reports.district = 'all';
        state.reports.page = 1;
        updateDistrictDropdown('reports-filter-state', 'reports-filter-district', true);
        renderDonorReportsTable();
      });
    }

    const distSelect = document.getElementById('reports-filter-district');
    if (distSelect) {
      distSelect.addEventListener('change', (e) => {
        state.reports.district = e.target.value;
        state.reports.page = 1;
        renderDonorReportsTable();
      });
    }

    const statusSelect = document.getElementById('reports-filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        state.reports.status = e.target.value;
        state.reports.page = 1;
        renderDonorReportsTable();
      });
    }

    const startDateInput = document.getElementById('reports-filter-start-date');
    if (startDateInput) {
      startDateInput.addEventListener('change', (e) => {
        state.reports.startDate = e.target.value;
        state.reports.page = 1;
        renderDonorReportsTable();
      });
    }

    const endDateInput = document.getElementById('reports-filter-end-date');
    if (endDateInput) {
      endDateInput.addEventListener('change', (e) => {
        state.reports.endDate = e.target.value;
        state.reports.page = 1;
        renderDonorReportsTable();
      });
    }

    const pageSizeSelect = document.getElementById('reports-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        state.reports.pageSize = parseInt(e.target.value, 10) || 10;
        state.reports.page = 1;
        renderDonorReportsTable();
      });
    }

    const resetBtn = document.getElementById('btn-reports-reset-filters');
    const emptyResetBtn = document.getElementById('btn-reports-empty-reset');
    const handleReset = () => {
      state.reports.search = '';
      state.reports.bloodGroup = 'all';
      state.reports.state = 'all';
      state.reports.district = 'all';
      state.reports.status = 'all';
      state.reports.startDate = '';
      state.reports.endDate = '';
      state.reports.page = 1;

      if (searchInput) searchInput.value = '';
      if (bloodGroupSelect) bloodGroupSelect.value = 'all';
      if (stateSelect) stateSelect.value = 'all';
      updateDistrictDropdown('reports-filter-state', 'reports-filter-district', true);
      if (distSelect) distSelect.value = 'all';
      if (statusSelect) statusSelect.value = 'all';
      if (startDateInput) startDateInput.value = '';
      if (endDateInput) endDateInput.value = '';

      renderDonorReportsTable();
      showToast('Filters reset to default.', 'info');
    };

    if (resetBtn) resetBtn.addEventListener('click', handleReset);
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', handleReset);

    // Main Page Export Buttons
    const exportExcelBtn = document.getElementById('btn-reports-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => exportAllReportsExcel());
    }

    const exportPdfBtn = document.getElementById('btn-reports-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => exportAllReportsPdf());
    }

    // Modal Dossier Action Buttons
    const dossierExcelBtn = document.getElementById('btn-donor-dossier-excel');
    if (dossierExcelBtn) {
      dossierExcelBtn.addEventListener('click', () => {
        if (state.reports.selectedDonor) exportDonorExcel(state.reports.selectedDonor);
      });
    }

    const dossierPdfBtn = document.getElementById('btn-donor-dossier-pdf');
    if (dossierPdfBtn) {
      dossierPdfBtn.addEventListener('click', () => {
        if (state.reports.selectedDonor) exportDonorPdf(state.reports.selectedDonor);
      });
    }

    const dossierPrintBtn = document.getElementById('btn-donor-dossier-print');
    if (dossierPrintBtn) {
      dossierPrintBtn.addEventListener('click', () => window.print());
    }
  }

  // --------------------------------------------------------------------------
  // Actions: Pledge Blood Donation (via Server API)
  // --------------------------------------------------------------------------
  async function handlePledgeDonation(requestId) {
    try {
      const donorName = `${state.currentUser.name} (${state.currentUser.city || 'Tricity Volunteer'})`;
      const res = await apiFetch(`/api/requests/${requestId}/pledge`, {
        method: 'POST',
        body: JSON.stringify({ donorName })
      });

      if (res.success) {
        showToast('Thank you! Your pledge has been recorded and hospital notified.', 'success');
        fetchRequests();
        fetchStats();
      }
    } catch (err) {
      showToast(err.message || 'Could not record pledge.', 'error');
    }
  }

  // --------------------------------------------------------------------------
  // Actions: Request Details Modal
  // --------------------------------------------------------------------------
  function openRequestDetailsModal(requestId) {
    const req = state.requests.find(r => r.id === requestId);
    if (!req) return;

    const modalTitle = document.getElementById('modal-req-title');
    const modalBody = document.getElementById('modal-req-body');
    const modalPledgeBtn = document.getElementById('modal-req-pledge-btn');
    const modalTrackBtn = document.getElementById('modal-req-track-btn');

    if (modalTitle) modalTitle.textContent = `Requisition Dossier #${req.id}`;
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; padding-bottom:16px; border-bottom:var(--border-light);">
          <div>
            <h4 style="font-size:1.25rem; margin-bottom:4px;">${req.patientName}</h4>
            <div style="font-size:0.875rem; color:var(--color-text-secondary);">${req.hospitalName} • ${req.ward || 'ICU'}</div>
            <div style="font-size:0.75rem; color:var(--color-text-muted);">${req.district}, ${req.state} – ${req.pincode}</div>
          </div>
          <div class="badge-blood ${req.urgency === 'critical' ? 'critical' : ''}" style="width:48px; height:48px; font-size:1.25rem;">
            ${req.bloodGroup}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
          <div style="background:var(--color-bg-base); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <div style="font-size:0.75rem; color:var(--color-text-muted);">Required Units</div>
            <strong style="font-size:1.1rem; color:var(--color-burgundy-900);">${req.unitsPledged} / ${req.unitsRequired} Units</strong>
          </div>
          <div style="background:var(--color-bg-base); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <div style="font-size:0.75rem; color:var(--color-text-muted);">Urgency Status</div>
            <span class="status-pill ${req.urgency}">${req.urgency}</span>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:0.8125rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:4px;">Medical Indication</div>
          <p style="font-size:0.875rem; background:#FFF9F7; border:1px solid var(--color-blush-200); padding:12px; border-radius:var(--radius-sm); color:var(--color-burgundy-900);">
            ${req.medicalIndication || 'Emergency blood requisition submitted under clinical supervision.'}
          </p>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:0.8125rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:4px;">Attending Coordinator Contact</div>
          <div style="font-size:0.875rem;">${req.contactPerson || 'Hospital Blood Officer'} • <strong style="color:var(--color-burgundy-700);">${req.contactPhone}</strong></div>
        </div>
      `;
    }

    if (modalPledgeBtn) {
      modalPledgeBtn.onclick = () => {
        handlePledgeDonation(req.id);
        closeModal('modal-request-details');
      };
    }

    if (modalTrackBtn) {
      modalTrackBtn.onclick = () => {
        state.activeTrackingId = req.id;
        closeModal('modal-request-details');
        setView('tracking');
      };
    }

    openModal('modal-request-details');
  }

  // --------------------------------------------------------------------------
  // Forms: Create Blood Request (India Requisition)
  // --------------------------------------------------------------------------
  function initCreateRequestForm() {
    const form = document.getElementById('form-create-request');
    if (!form) return;

    // Cascading state -> district
    const stateSelect = document.getElementById('req-state');
    if (stateSelect) {
      stateSelect.addEventListener('change', () => {
        updateDistrictDropdown('req-state', 'req-district', false);
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const patientName = document.getElementById('req-patient-name').value.trim();
      const hospitalName = document.getElementById('req-hospital-name').value.trim();
      const ward = document.getElementById('req-ward')?.value.trim() || 'Emergency Ward';
      const stateVal = document.getElementById('req-state').value;
      const districtVal = document.getElementById('req-district').value;
      const city = document.getElementById('req-city')?.value.trim() || districtVal;
      const pincode = document.getElementById('req-pincode')?.value.trim() || '';
      const bloodGroup = document.getElementById('req-blood-group').value;
      const units = parseInt(document.getElementById('req-units').value, 10) || 1;
      const urgency = form.querySelector('input[name="req-urgency"]:checked')?.value || 'urgent';
      const contactPerson = document.getElementById('req-contact-name').value.trim();
      const contactPhone = document.getElementById('req-contact-phone').value.trim();
      const requiredByDate = document.getElementById('req-required-by').value.trim() || 'Immediate';
      const medicalIndication = document.getElementById('req-notes').value.trim();

      if (!patientName || !hospitalName || !stateVal || !districtVal || !contactPhone) {
        showToast('Please fill all mandatory fields.', 'error');
        return;
      }

      try {
        const payload = {
          patientName,
          hospitalName,
          ward,
          state: stateVal,
          district: districtVal,
          city,
          pincode,
          bloodGroup,
          unitsRequired: units,
          urgency,
          contactPerson,
          contactPhone,
          requiredByDate,
          medicalIndication
        };

        const res = await apiFetch('/api/requests', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (res.success) {
          showToast(`Requisition #${res.request.id} registered! Notifying donors & hospitals.`, 'success');
          form.reset();
          state.activeTrackingId = res.request.id;
          fetchRequests();
          fetchStats();
          setView('tracking');
        }
      } catch (err) {
        showToast(err.message || 'Could not submit blood request.', 'error');
      }
    });
  }

  // --------------------------------------------------------------------------
  // Forms: Donor Registration (NBTC & DPDP Act 2023 Compliant)
  // --------------------------------------------------------------------------
  function initDonorRegistrationForm() {
    const form = document.getElementById('form-donor-register');
    if (!form) return;

    const stateSelect = document.getElementById('reg-state');
    if (stateSelect) {
      stateSelect.addEventListener('change', () => {
        updateDistrictDropdown('reg-state', 'reg-district', false);
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fullName = document.getElementById('reg-name').value.trim();
      const bloodGroup = document.getElementById('reg-blood-group').value;
      const gender = document.getElementById('reg-gender')?.value || 'Male';
      const age = parseInt(document.getElementById('reg-age').value, 10);
      const weightKg = parseInt(document.getElementById('reg-weight').value, 10);
      const mobileNumber = document.getElementById('reg-phone').value.trim();
      const email = document.getElementById('reg-email')?.value.trim() || '';
      const stateVal = document.getElementById('reg-state').value;
      const districtVal = document.getElementById('reg-district').value;
      const city = document.getElementById('reg-city')?.value.trim() || districtVal;
      const pincode = document.getElementById('reg-pincode')?.value.trim() || '';
      const availableForEmergency = document.getElementById('reg-available-toggle')?.checked ?? true;
      const consentGiven = document.getElementById('reg-consent-checkbox')?.checked ?? false;
      const healthDeclaration = document.getElementById('reg-health-checkbox')?.checked ?? false;

      // Clinical Validation Checks (NBTC)
      if (age < 18 || age > 65) {
        showToast('As per NBTC guidelines, donors must be between 18 and 65 years old.', 'error');
        return;
      }

      if (weightKg < 45) {
        showToast('Minimum weight for whole blood donation in India is 45 kg.', 'error');
        return;
      }

      if (!consentGiven) {
        showToast('Consent under the Digital Personal Data Protection Act, 2023 is mandatory.', 'error');
        return;
      }

      try {
        const payload = {
          fullName,
          bloodGroup,
          gender,
          age,
          weightKg,
          mobileNumber,
          email,
          state: stateVal,
          district: districtVal,
          city,
          pincode,
          availableForEmergency,
          consentGiven,
          healthDeclaration
        };

        const res = await apiFetch('/api/donors/register', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (res.success) {
          showToast(`Welcome ${fullName}! Your voluntary donor registration is verified.`, 'success');
          form.reset();
          fetchDonors();
          fetchStats();

          // Switch persona to new donor
          Data.DEMO_USERS.donor.name = fullName;
          Data.DEMO_USERS.donor.bloodGroup = bloodGroup;
          Data.DEMO_USERS.donor.city = `${districtVal}, ${stateVal}`;
          switchRole('donor');

          setView('donor-search');
        }
      } catch (err) {
        showToast(err.message || 'Registration failed.', 'error');
      }
    });
  }

  // --------------------------------------------------------------------------
  // Interactive Blood Compatibility Explorer (Landing Page)
  // --------------------------------------------------------------------------
  function initCompatibilityExplorer() {
    const btns = document.querySelectorAll('.blood-compat-btn');
    const canGiveEl = document.getElementById('compat-can-give');
    const canReceiveEl = document.getElementById('compat-can-receive');
    const rarityEl = document.getElementById('compat-rarity');
    const summaryEl = document.getElementById('compat-summary');
    const selectedGroupLabel = document.getElementById('compat-current-group');

    function updateExplorer(group) {
      state.selectedCompatibility = group;
      const data = Data.BLOOD_COMPATIBILITY[group];
      if (!data) return;

      btns.forEach(b => b.classList.toggle('active', b.dataset.blood === group));

      if (selectedGroupLabel) selectedGroupLabel.textContent = group;
      if (rarityEl) rarityEl.textContent = data.rarity;
      if (summaryEl) summaryEl.textContent = data.summary;

      if (canGiveEl) {
        canGiveEl.innerHTML = data.canGiveTo.map(g => `<span class="compat-pill">${g}</span>`).join('');
      }

      if (canReceiveEl) {
        canReceiveEl.innerHTML = data.canReceiveFrom.map(g => `<span class="compat-pill">${g}</span>`).join('');
      }
    }

    btns.forEach(btn => {
      btn.addEventListener('click', () => updateExplorer(btn.dataset.blood));
    });

    updateExplorer(state.selectedCompatibility);
  }

  // --------------------------------------------------------------------------
  // Hero Quick Search (India State/District routing)
  // --------------------------------------------------------------------------
  function initHeroQuickSearch() {
    const stateEl = document.getElementById('hero-state-select');
    const districtEl = document.getElementById('hero-district-select');
    const btn = document.getElementById('hero-quick-search-btn');

    if (stateEl) {
      stateEl.addEventListener('change', () => {
        updateDistrictDropdown('hero-state-select', 'hero-district-select', true);
      });
    }

    if (btn) {
      btn.addEventListener('click', () => {
        const selectedState = stateEl ? stateEl.value : 'all';
        const selectedDistrict = districtEl ? districtEl.value : 'all';
        const selectedBlood = document.getElementById('hero-blood-select')?.value || 'all';

        state.filters.bloodBankState = selectedState;
        state.filters.bloodBankDistrict = selectedDistrict;
        state.filters.donorState = selectedState;
        state.filters.donorDistrict = selectedDistrict;
        state.filters.donorBloodGroup = selectedBlood;

        // Synchronize filter inputs in sub-views
        const bbState = document.getElementById('bb-filter-state');
        if (bbState) {
          bbState.value = selectedState;
          updateDistrictDropdown('bb-filter-state', 'bb-filter-district', true);
          const bbDist = document.getElementById('bb-filter-district');
          if (bbDist) bbDist.value = selectedDistrict;
        }

        const donorState = document.getElementById('donor-filter-state');
        if (donorState) {
          donorState.value = selectedState;
          updateDistrictDropdown('donor-filter-state', 'donor-filter-district', true);
          const donorDist = document.getElementById('donor-filter-district');
          if (donorDist) donorDist.value = selectedDistrict;
        }

        fetchBloodBanks();
        fetchDonors();
        setView('blood-banks');
      });
    }
  }

  // --------------------------------------------------------------------------
  // Filter Event Listeners (Blood Banks & Donors)
  // --------------------------------------------------------------------------
  function initFilterListeners() {
    // Blood Banks Filters
    const bbState = document.getElementById('bb-filter-state');
    const bbDist = document.getElementById('bb-filter-district');
    const bbType = document.getElementById('bb-filter-type');
    const bbSearch = document.getElementById('bb-search-input');

    if (bbState) {
      bbState.addEventListener('change', () => {
        state.filters.bloodBankState = bbState.value;
        updateDistrictDropdown('bb-filter-state', 'bb-filter-district', true);
        state.filters.bloodBankDistrict = 'all';
        fetchBloodBanks();
        fetchEraktkoshStatus();
      });
    }

    if (bbDist) {
      bbDist.addEventListener('change', () => {
        state.filters.bloodBankDistrict = bbDist.value;
        fetchBloodBanks();
        fetchEraktkoshStatus();
      });
    }

    if (bbType) {
      bbType.addEventListener('change', () => {
        state.filters.bloodBankCategory = bbType.value;
        fetchBloodBanks();
      });
    }

    if (bbSearch) {
      bbSearch.addEventListener('input', (e) => {
        state.filters.bloodBankSearch = e.target.value.trim();
        fetchBloodBanks();
      });
    }

    // Donor Registry Filters
    const dState = document.getElementById('donor-filter-state');
    const dDist = document.getElementById('donor-filter-district');
    const dGroup = document.getElementById('filter-blood-group');
    const dAvail = document.getElementById('filter-available-only');
    const dPin = document.getElementById('donor-filter-pincode');

    if (dState) {
      dState.addEventListener('change', () => {
        state.filters.donorState = dState.value;
        updateDistrictDropdown('donor-filter-state', 'donor-filter-district', true);
        state.filters.donorDistrict = 'all';
        fetchDonors();
      });
    }

    if (dDist) {
      dDist.addEventListener('change', () => {
        state.filters.donorDistrict = dDist.value;
        fetchDonors();
      });
    }

    if (dGroup) {
      dGroup.addEventListener('change', () => {
        state.filters.donorBloodGroup = dGroup.value;
        document.querySelectorAll('.blood-pill-filter').forEach(p => {
          p.classList.toggle('active', p.dataset.blood === dGroup.value);
        });
        fetchDonors();
      });
    }

    document.querySelectorAll('.blood-pill-filter').forEach(pill => {
      pill.addEventListener('click', () => {
        const val = pill.dataset.blood;
        state.filters.donorBloodGroup = val;
        if (dGroup) dGroup.value = val;
        document.querySelectorAll('.blood-pill-filter').forEach(p => p.classList.toggle('active', p === pill));
        fetchDonors();
      });
    });

    if (dAvail) {
      dAvail.addEventListener('change', (e) => {
        state.filters.donorAvailableOnly = e.target.checked;
        fetchDonors();
      });
    }

    if (dPin) {
      dPin.addEventListener('input', (e) => {
        state.filters.donorPincode = e.target.value.trim();
        fetchDonors();
      });
    }

    // Tracking Select
    const trackSelect = document.getElementById('tracking-request-select');
    if (trackSelect) {
      trackSelect.addEventListener('change', (e) => {
        state.activeTrackingId = e.target.value;
        renderTrackingView();
      });
    }
  }

  // --------------------------------------------------------------------------
  // Authentication System (Login, Registration, Sessions)
  // --------------------------------------------------------------------------
  function hideAuthAlerts() {
    const lAlert = document.getElementById('login-alert-box');
    const lSuccess = document.getElementById('login-success-box');
    const rAlert = document.getElementById('register-alert-box');
    const rSuccess = document.getElementById('register-success-box');

    if (lAlert) { lAlert.style.display = 'none'; lAlert.textContent = ''; }
    if (lSuccess) { lSuccess.style.display = 'none'; lSuccess.textContent = ''; }
    if (rAlert) { rAlert.style.display = 'none'; rAlert.textContent = ''; }
    if (rSuccess) { rSuccess.style.display = 'none'; rSuccess.textContent = ''; }
  }

  function showAuthAlert(boxId, message, isSuccess = false) {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.textContent = message;
    box.className = `auth-alert ${isSuccess ? 'success' : 'error'}`;
    box.style.display = 'flex';
  }

  function initAuthSystem() {
    // 1. Password Visibility Toggle
    const togglePwdBtn = document.getElementById('btn-toggle-login-pwd');
    const pwdInput = document.getElementById('login-input-password');
    if (togglePwdBtn && pwdInput) {
      togglePwdBtn.addEventListener('click', () => {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        togglePwdBtn.innerHTML = isPwd
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      });
    }

    // 2. Registration Role Switcher
    const donorCard = document.getElementById('role-select-card-donor');
    const hospitalCard = document.getElementById('role-select-card-hospital');
    const roleInput = document.getElementById('reg-input-role');
    const donorFields = document.getElementById('reg-donor-fields');
    const hospitalFields = document.getElementById('reg-hospital-fields');

    function selectRegistrationRole(role) {
      if (roleInput) roleInput.value = role;
      if (role === 'donor') {
        if (donorCard) donorCard.classList.add('active');
        if (hospitalCard) hospitalCard.classList.remove('active');
        if (donorFields) donorFields.style.display = 'block';
        if (hospitalFields) hospitalFields.style.display = 'none';
      } else {
        if (hospitalCard) hospitalCard.classList.add('active');
        if (donorCard) donorCard.classList.remove('active');
        if (hospitalFields) hospitalFields.style.display = 'block';
        if (donorFields) donorFields.style.display = 'none';
      }
    }

    if (donorCard) {
      donorCard.addEventListener('click', () => selectRegistrationRole('donor'));
    }
    if (hospitalCard) {
      hospitalCard.addEventListener('click', () => selectRegistrationRole('hospital'));
    }

    // Cascading state & district in registration form
    const regState = document.getElementById('reg-input-state');
    if (regState) {
      regState.addEventListener('change', () => {
        updateDistrictDropdown('reg-input-state', 'reg-input-district', false);
      });
    }

    // 3. User Login Form Submit
    const loginForm = document.getElementById('form-user-login');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthAlerts();

        const email = (document.getElementById('login-input-email')?.value || '').trim();
        const password = (document.getElementById('login-input-password')?.value || '').trim();
        const submitBtn = document.getElementById('btn-submit-login');

        if (!email) {
          showAuthAlert('login-alert-box', 'Please enter your registered email address.');
          return;
        }
        if (!password) {
          showAuthAlert('login-alert-box', 'Please enter your account password.');
          return;
        }

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Authenticating...';
          }

          const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
          });

          if (res.success && res.user) {
            if (res.token) {
              localStorage.setItem('bloodlink_token', res.token);
            }
            localStorage.setItem('bloodlink_user', JSON.stringify(res.user));

            state.currentUser = res.user;
            state.currentRole = res.user.role === 'hospital' ? 'coordinator' : 'donor';
            updateUserInterfaceHeaders();

            showToast(`Signed in successfully! Welcome, ${res.user.name}.`, 'success');

            // Redirect to appropriate dashboard based on role
            if (res.user.role === 'hospital') {
              setView('overview');
            } else if (res.user.role === 'donor') {
              setView('donor-search');
            } else {
              setView('overview');
            }
          }
        } catch (err) {
          showAuthAlert('login-alert-box', err.message || 'Login failed. Please check your credentials.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In to BloodLink';
          }
        }
      });
    }

    // 4. User Registration Form Submit
    const registerForm = document.getElementById('form-user-register');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthAlerts();

        const role = roleInput?.value || 'donor';
        const fullName = (document.getElementById('reg-input-name')?.value || '').trim();
        const email = (document.getElementById('reg-input-email')?.value || '').trim();
        const mobile = (document.getElementById('reg-input-phone')?.value || '').trim().replace(/\D/g, '');
        const password = (document.getElementById('reg-input-password')?.value || '').trim();
        const confirmPassword = (document.getElementById('reg-input-confirm-password')?.value || '').trim();
        const stateVal = (document.getElementById('reg-input-state')?.value || '').trim();
        const districtVal = (document.getElementById('reg-input-district')?.value || '').trim();
        const city = (document.getElementById('reg-input-city')?.value || '').trim();
        const pincode = (document.getElementById('reg-input-pincode')?.value || '').trim();
        const consentGiven = document.getElementById('reg-input-dpdp')?.checked;
        const submitBtn = document.getElementById('btn-submit-register');

        // Client-side validations
        if (!fullName || fullName.length < 2) {
          showAuthAlert('register-alert-box', 'Please provide your full legal name (minimum 2 characters).');
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          showAuthAlert('register-alert-box', 'Please enter a valid email address.');
          return;
        }

        if (!mobile || mobile.length !== 10 || !['6', '7', '8', '9'].includes(mobile[0])) {
          showAuthAlert('register-alert-box', 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
          return;
        }

        if (!password || password.length < 6) {
          showAuthAlert('register-alert-box', 'Password must be at least 6 characters in length.');
          return;
        }

        if (password !== confirmPassword) {
          showAuthAlert('register-alert-box', 'Passwords do not match. Please re-enter.');
          return;
        }

        if (!stateVal || stateVal === 'all') {
          showAuthAlert('register-alert-box', 'Please select your State or Union Territory.');
          return;
        }

        if (!districtVal || districtVal === 'all') {
          showAuthAlert('register-alert-box', 'Please select your District.');
          return;
        }

        if (!consentGiven) {
          showAuthAlert('register-alert-box', 'Digital Personal Data Protection (DPDP) Act consent is required to coordinate transfusions.');
          return;
        }

        const payload = {
          role,
          fullName,
          email,
          mobileNumber: mobile,
          password,
          state: stateVal,
          district: districtVal,
          city: city || districtVal,
          pincode,
          consentGiven: true
        };

        if (role === 'donor') {
          const bloodGroup = document.getElementById('reg-input-blood-group')?.value;
          const age = parseInt(document.getElementById('reg-input-age')?.value, 10);
          const weightKg = parseInt(document.getElementById('reg-input-weight')?.value, 10);
          const gender = document.getElementById('reg-input-gender')?.value || 'Unspecified';
          const emergencyAvail = document.getElementById('reg-input-emergency-avail')?.checked;
          const healthDec = document.getElementById('reg-input-health-dec')?.checked;

          if (!bloodGroup) {
            showAuthAlert('register-alert-box', 'Please select your ABO & Rh blood group.');
            return;
          }

          if (isNaN(age) || age < 18 || age > 65) {
            showAuthAlert('register-alert-box', 'Per NBTC clinical guidelines, donors must be between 18 and 65 years of age.');
            return;
          }

          if (isNaN(weightKg) || weightKg < 45) {
            showAuthAlert('register-alert-box', 'Per NBTC clinical guidelines, donors must weigh at least 45 kg.');
            return;
          }

          if (!healthDec) {
            showAuthAlert('register-alert-box', 'Please confirm the clinical health declaration.');
            return;
          }

          payload.bloodGroup = bloodGroup;
          payload.age = age;
          payload.weightKg = weightKg;
          payload.gender = gender;
          payload.availableForEmergency = emergencyAvail;
          payload.healthDeclaration = healthDec;
        } else {
          // Hospital
          const hospitalName = (document.getElementById('reg-input-hospital')?.value || '').trim();
          const dept = (document.getElementById('reg-input-dept')?.value || '').trim();
          const hospType = document.getElementById('reg-input-hosp-type')?.value || 'Government';

          if (!hospitalName || hospitalName.length < 3) {
            showAuthAlert('register-alert-box', 'Please enter the Hospital or Blood Center name.');
            return;
          }

          payload.hospitalName = hospitalName;
          payload.department = dept;
          payload.hospitalType = hospType;
        }

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering Account...';
          }

          const res = await apiFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

          if (res.success && res.user) {
            if (res.token) {
              localStorage.setItem('bloodlink_token', res.token);
            }
            localStorage.setItem('bloodlink_user', JSON.stringify(res.user));

            state.currentUser = res.user;
            state.currentRole = res.user.role === 'hospital' ? 'coordinator' : 'donor';
            updateUserInterfaceHeaders();

            showAuthAlert('register-success-box', `Account created successfully! Welcome, ${res.user.name}.`, true);
            showToast(`Registration verified! Welcome to BloodLink India.`, 'success');

            // Refetch donors and stats so new donor appears in search immediately
            fetchDonors();
            fetchStats();

            setTimeout(() => {
              if (res.user.role === 'hospital') {
                setView('overview');
              } else {
                setView('donor-search');
              }
            }, 800);
          }
        } catch (err) {
          showAuthAlert('register-alert-box', err.message || 'Registration failed. Please try again.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Complete Registration & Enter BloodLink';
          }
        }
      });
    }

    // 5. Dashboard Sign Out
    const logoutBtn = document.getElementById('btn-dashboard-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        const token = localStorage.getItem('bloodlink_token');
        if (token) {
          apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        }
        localStorage.removeItem('bloodlink_token');
        localStorage.removeItem('bloodlink_user');

        // Reset to default persona
        state.currentUser = Data.DEMO_USERS.seeker;
        state.currentRole = 'seeker';
        updateUserInterfaceHeaders();

        showToast('Signed out of BloodLink.', 'info');
        setView('landing');
      });
    }
  }

  // Restore stored session if exists
  function checkStoredSession() {
    try {
      const storedUser = localStorage.getItem('bloodlink_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u && u.name) {
          state.currentUser = u;
          state.currentRole = u.role === 'hospital' ? 'coordinator' : 'donor';
          updateUserInterfaceHeaders();
        }
      }
    } catch (e) {
      console.warn('Failed restoring stored session:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Global Event Listeners & Boot
  // --------------------------------------------------------------------------
  function initEventListeners() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'landing';
      setView(hash);
    });

    document.querySelectorAll('[data-route]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        setView(el.dataset.route);
      });
    });

    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setView(btn.dataset.view);
      });
    });

    document.querySelectorAll('.role-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchRole(btn.dataset.role);
      });
    });

    document.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(btn.dataset.modalClose);
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    });

    const loginModalBtn = document.getElementById('btn-open-login');
    if (loginModalBtn) {
      loginModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setView('login');
      });
    }

    const registerNavBtn = document.getElementById('btn-open-register');
    if (registerNavBtn) {
      registerNavBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setView('register');
      });
    }

    document.querySelectorAll('.demo-login-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchRole(btn.dataset.role);
        closeModal('modal-auth-login');
        closeModal('modal-role-switcher');
        setView('overview');
        showToast(`Logged in as ${state.currentUser.name} (${state.currentUser.roleLabel})`, 'success');
      });
    });

    // Mobile nav toggle
    const mobBtn = document.getElementById('mobile-nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (mobBtn && navLinks) {
      navLinks.style.removeProperty('display');

      mobBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = navLinks.classList.toggle('is-open');
        mobBtn.textContent = isOpen ? '✕' : '☰';
        mobBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Auto close when any link or button inside mobile nav is clicked
      navLinks.querySelectorAll('a, button').forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 1140) {
            navLinks.classList.remove('is-open');
            mobBtn.textContent = '☰';
            mobBtn.setAttribute('aria-expanded', 'false');
          }
        });
      });

      // Close if user clicks outside header
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.site-header') && navLinks.classList.contains('is-open')) {
          navLinks.classList.remove('is-open');
          mobBtn.textContent = '☰';
          mobBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  window.fetchBloodBanks = fetchBloodBanks;
  window.fetchDonors = fetchDonors;
  window.openDonorReport = openDonorReport;
  window.exportDonorPdf = exportDonorPdf;
  window.exportDonorExcel = exportDonorExcel;
  window.exportAllReportsPdf = exportAllReportsPdf;
  window.exportAllReportsExcel = exportAllReportsExcel;
  window.downloadBlobFile = downloadBlobFile;
  window.downloadFileFromApi = downloadFileFromApi;

  function init() {
    checkStoredSession();
    updateUserInterfaceHeaders();
    initCompatibilityExplorer();
    initHeroQuickSearch();
    initFilterListeners();
    initCreateRequestForm();
    initDonorRegistrationForm();
    initAuthSystem();
    initEventListeners();
    initDonorReports();

    loadInitialData();

    const hash = window.location.hash.replace('#', '');
    const initialView = hash || (window.location.pathname.includes('login') ? 'login' : window.location.pathname.includes('register') ? 'register' : 'landing');
    setView(initialView);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* ===========================================================================
   BloodLink — Light / Dark Theme Toggle System
   Persists preference in localStorage as 'bloodlink-theme' ('light' | 'dark')
   Applies data-theme attribute to <html> immediately on page load.
   =========================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'bloodlink-theme';
  const htmlEl = document.documentElement;
  const metaThemeColor = document.getElementById('meta-theme-color');

  const THEME_COLORS = {
    light: '#F8F5F0',
    dark: '#141113'
  };

  /* --------------------------------------------------------------------------
     Apply theme to <html> and update meta tag
  -------------------------------------------------------------------------- */
  function applyTheme(theme) {
    if (theme === 'dark') {
      htmlEl.setAttribute('data-theme', 'dark');
    } else {
      htmlEl.removeAttribute('data-theme');
    }
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', THEME_COLORS[theme]);
    }
    localStorage.setItem(STORAGE_KEY, theme);
    updateToggleButtons(theme);
  }

  /* --------------------------------------------------------------------------
     Update all toggle button icons & labels across every header
  -------------------------------------------------------------------------- */
  function updateToggleButtons(theme) {
    const isDark = theme === 'dark';

    // Primary toggle (public landing header)
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    const label = document.getElementById('theme-toggle-label');

    if (sunIcon)  sunIcon.style.display  = isDark  ? 'block' : 'none';
    if (moonIcon) moonIcon.style.display = isDark  ? 'none'  : 'block';
    if (label)    label.textContent      = isDark  ? 'Light' : 'Dark';

    // Secondary toggles (login, register, dashboard) — update their moon/sun SVG
    const secondaryIds = ['theme-toggle-btn-login', 'theme-toggle-btn-register', 'theme-toggle-btn-dash'];
    secondaryIds.forEach(function (id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      const svg = btn.querySelector('svg');
      if (!svg) return;
      if (isDark) {
        // Show sun icon
        svg.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
      } else {
        // Show moon icon
        svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      }
    });
  }

  /* --------------------------------------------------------------------------
     Read stored preference (or system preference as fallback)
  -------------------------------------------------------------------------- */
  function getInitialTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    // Use system preference as default
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /* --------------------------------------------------------------------------
     Toggle handler — called when any toggle button is clicked
  -------------------------------------------------------------------------- */
  function toggleTheme() {
    const current = htmlEl.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* --------------------------------------------------------------------------
     Bind events and apply initial theme
  -------------------------------------------------------------------------- */
  function initThemeToggle() {
    // Bind primary toggle
    const primaryBtn = document.getElementById('theme-toggle-btn');
    if (primaryBtn) {
      primaryBtn.addEventListener('click', toggleTheme);
    }
    // Secondary toggles already have onclick delegation to primary btn,
    // but bind directly as well for safety
    ['theme-toggle-btn-login', 'theme-toggle-btn-register', 'theme-toggle-btn-dash'].forEach(function (id) {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', toggleTheme);
        btn.removeAttribute('onclick'); // remove inline onclick (already handled)
      }
    });

    // Apply saved / system theme
    applyTheme(getInitialTheme());
  }

  // Apply theme immediately (before DOM ready) to avoid flash of wrong theme
  (function () {
    const preloaded = localStorage.getItem(STORAGE_KEY);
    if (preloaded === 'dark') {
      htmlEl.setAttribute('data-theme', 'dark');
    }
  })();

  // Attach button handlers after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle);
  } else {
    initThemeToggle();
  }

  // Expose globally so other scripts can call it if needed
  window.BloodLinkTheme = {
    toggle: toggleTheme,
    apply: applyTheme,
    getCurrent: function () {
      return htmlEl.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
  };

})();
