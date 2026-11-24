# BloodLink India — Connected Blood Bank Directory & Emergency Donor Coordination Network

BloodLink India is a modern, responsive web application connecting people in urgent need of blood with licensed blood banks and voluntary donors across India.

The platform is strictly bounded to **India**, with priority focus on **Chandigarh**, **Mohali (SAS Nagar)**, **Panchkula**, **Punjab**, and **Haryana**, while supporting all 28 States and 8 Union Territories.

---

## 🏛 Regulatory Compliance & Healthcare Standards

1. **National Blood Transfusion Council (NBTC) & Drugs and Cosmetics Act, 1940**:
   - All donor eligibility parameters strictly enforce clinical standards: Age 18–65, weight $\ge 45\text{ kg}$, minimum donation interval of 90 days for men and 120 days for women, and pre-screening health declarations.
   - Statutory health advisory banner is displayed across all pages reminding patients and families that blood bank stock availability fluctuates continuously and must be confirmed directly before travel.

2. **Digital Personal Data Protection (DPDP) Act, 2023**:
   - Volunteer donor registration requires explicit informed consent.
   - Contact numbers are masked on public endpoints and UI (`+91 98XXX-X4321`) to protect private citizens against unauthorized web scraping and unsolicited calls. Real-time emergency coordination occurs via secure hospital broadcast.

3. **Data Integrity & Zero Fake Records Policy**:
   - BloodLink never generates synthetic fake donor profiles or invented stock numbers.
   - All blood banks are licensed institutions cataloged from official **Ministry of Health & Family Welfare (MoHFW)** and **Open Government Data (OGD) data.gov.in** datasets.
   - Voluntary donors are populated solely through authentic, voluntary user signups. When a district has no registered volunteer donors yet, the application displays an honest zero-state card with immediate links and phone numbers to local licensed blood banks.

---

## 🔌 API Integrations & External Data Sources

### 1. e-RaktKosh Integration (MoHFW / C-DAC)
- **Investigation & Policy**: The centralized Indian national blood platform ([eraktkosh.mohfw.gov.in](https://eraktkosh.mohfw.gov.in/)) manages real-time stock inventories and hospital syncs. Official programmatic integration requires an authorized institutional MoU with MoHFW / C-DAC (`eraktkosh@cdac.in`). In accordance with ethical data practices, BloodLink does not scrape the e-RaktKosh portal.
- **Server Gateway**: The backend server supports `ERAKTKOSH_API_KEY` and `ERAKTKOSH_CLIENT_ID` environment variables for authorized institutional deployments.
- **Direct Citizen Verification**: Each blood bank profile and search filter provides direct links to the official e-RaktKosh stock verification portal (`https://eraktkosh.mohfw.gov.in/BLDA/bloodbank/stockAvailability.html`), pre-filtered by state and district.

### 2. Open Government Data (OGD Platform India - data.gov.in)
- Source of licensed blood bank directory records, licensing details, nodal contacts, and geo-coordinates under the Government Open Data License - India (GODL).
- Configurable via `DATA_GOV_IN_API_KEY` on the backend.

### 3. OpenStreetMap Nominatim & Leaflet Mapping
- Server-side geocoding proxy (`/api/geocode`) with a 24-hour in-memory cache and 1 req/sec rate-limiting compliant with the OpenStreetMap usage policy.
- Interactive Leaflet map displaying licensed blood banks in Chandigarh Tricity, Punjab, Haryana, and across India with custom hospital pins, contact cards, and directions.

---

## 📂 Project Architecture

```
blood-donor/
├── .env.example                      # Environment variables template
├── .env                              # Local configuration (API keys, ports)
├── server.js                         # Secure Node.js backend REST API & static server
├── package.json                      # Project metadata & npm scripts
├── README.md                         # Project documentation & compliance specs
├── data/
│   ├── indian_states_districts.json  # Master dataset of 36 Indian states/UTs & districts
│   ├── verified_blood_banks_india.json # Licensed blood banks (PGIMER, GMCH, Mohali, etc.)
│   └── bloodlink_db.json             # Persistent DB (real voluntary donors & requisitions)
├── assets/
│   ├── css/
│   │   └── style.css                 # Warm Ivory, Burgundy & Coral master design system
│   ├── js/
│   │   ├── data.js                   # Clinical compatibility engine & NBTC guidelines
│   │   └── app.js                    # SPA hash router, Leaflet map, API client & filters
│   └── images/
│       └── bloodlink_network_hero.jpg # Bespoke constellation network artwork
└── index.html                        # Semantic HTML5 landing page, dashboard & modals
```

---

## 🚀 Backend API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check, active external integrations, and catalog counts |
| `/api/stats` | `GET` | Derived counts (verified blood banks, real voluntary donors, active requests) |
| `/api/states-districts` | `GET` | Master list of all 36 Indian States & UTs with districts (Tricity prioritized) |
| `/api/blood-banks` | `GET` | Filter licensed blood banks by `state`, `district`, `city`, `pincode`, `hospitalType` |
| `/api/blood-banks/:id` | `GET` | Single blood bank profile with component facilities and contact numbers |
| `/api/eraktkosh/status` | `GET` | e-RaktKosh integration status and direct verification URLs |
| `/api/geocode` | `GET` | Server-cached Indian geocoding via OpenStreetMap Nominatim (`q=...`) |
| `/api/donors` | `GET` | Real voluntary donors with DPDP Act 2023 masked phone numbers |
| `/api/donors/register` | `POST` | NBTC & DPDP compliant voluntary donor onboarding with validation |
| `/api/requests` | `GET` | Active hospital emergency blood requisitions |
| `/api/requests` | `POST` | Create verified hospital requisition (`patientName`, `hospital`, `units`, `urgency`) |
| `/api/requests/:id/pledge` | `POST` | Record a voluntary donor pledge for an urgent request |

---

## ⚙️ Setup & Local Execution

### 1. Requirements
- Node.js v18+ (tested on Node v24.14.1)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your API keys (optional for local testing; default fallback serves verified datasets and OpenStreetMap geocoding):

```bash
cp .env.example .env
```

### 3. Start the Server
```bash
# Direct Node execution
node server.js

# Or via npm
npm start
```

Open **`http://localhost:3000/`** in your browser.

---

## 🏥 Focus Coverage in Northern India

- **Chandigarh**:
  - PGIMER (Department of Transfusion Medicine, Sector 12) — 24x7 Emergency Service
  - GMCH-32 (Government Medical College & Hospital, Sector 32)
  - GMSH-16 (Government Multi-Specialty Hospital, Sector 16)
  - Rotary Blood Bank Resource Centre (Sector 37-A)
- **Mohali (SAS Nagar), Punjab**:
  - Civil Hospital / District Hospital Blood Bank (Phase 6, Sector 56)
  - Max Super Speciality Hospital (Phase 6, Sector 56A)
  - Fortis Hospital Mohali (Sector 62, Phase 8)
  - Indus Super Speciality Hospital (Phase 1)
- **Panchkula, Haryana**:
  - General Hospital / Civil Hospital (Sector 6)
  - Alchemist Hospital (Sector 21)
  - Command Hospital Western Command (Chandimandir)
- **Punjab & Haryana State Medical Hubs**:
  - Ludhiana (CMC, Hero DMC Heart Institute), Jalandhar (Civil Hospital), Amritsar (GNDH / GMC), Patiala (Rajindra Hospital), Bathinda (AIIMS Bathinda)
  - Gurugram (Medanta The Medicity, FMRI, Artemis), Rohtak (PGIMS), Faridabad (ESIC Medical College), Ambala (Civil Hospital)
- **National Apex Centers**: AIIMS New Delhi, Safdarjung Hospital, Red Cross National HQ, KGMU Lucknow.
