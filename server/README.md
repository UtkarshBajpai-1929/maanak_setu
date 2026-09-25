# MaanakSetu - Online Verification System for Weighing and Measuring Instruments

Smart India Hackathon (SIH) Problem Statement: 26036  
Department: Department of Legal Metrology, Government of India  
Regulatory Basis: Legal Metrology Act, 2009 & Legal Metrology (General) Rules, 2011

---

## 1. Overview

MaanakSetu is an enterprise-grade digital backend designed to digitize the verification, certification, and lifecycle management of legal metrology instruments across India. It eliminates manual paper workflows, enables verifiable digital certificates with tamper-proof QR codes, maintains instrument re-verification history chains, calculates statutory validity intervals, and automates expiry alerts.

The system is configured around two roles:
- **USER**: The instrument owner / business proprietor.
- **OFFICER**: The designated Legal Metrology verification officer.

---

## 2. Architecture & The 7-Model Core

The entire backend strictly revolves around 7 canonical Mongoose models without redundant entity tables:

```
User (Owner / Officer)
  │
  ▼
Shop (Establishment / Commercial premises)
  │
  ▼
Instrument (Weighing / Measuring equipment)
  │
  ▼
Application (Verification / Re-verification request)
  ├──────► Schedule (Verification appointment)
  ├──────► Certificate (Verification / Rejection record with QR & PDF)
  └──────► Notification (Alerts & expiry reminders)
```

### Models Summary

1. **User**: Supports roles `USER` and `OFFICER`. Secure password hashing via `bcryptjs`, JWT-based authentication, and Aadhaar identifier validation.
2. **Shop**: Belongs to a User (`owner`). Tracks business license number, physical address, operational timings, and active status.
3. **Instrument**: Belongs to a Shop. Tracks statutory categories (`WEIGHING_SCALE`, `WEIGHBRIDGE`, `WATER_METER`, `FUEL_DISPENSER`, `TANK_LORRY`, `LOAD_CELL`, etc.), serial numbers, capacity, installation type (`FIXED` vs `MOVABLE`), model approval certificate numbers, documents, and status.
4. **Application**: Central lifecycle hub linking User, Shop, and Instrument. Supports `FRESH` and `RE_VERIFICATION` applications (with reasons `ROUTINE_EXPIRY`, `REPAIR`, `DISMANTLING`, `REINSTALLATION`). Embeds inspection observations, test readings, photographs, defect description, repairable status, and verification outcomes (`PASS`, `FAIL`, `REJECTED`).
5. **Schedule**: Represents field or office verification appointments with scheduled date, assigned officer, location, reschedule reasoning, and status.
6. **Certificate**: Digital certificate with unique number, valid from/until dates, official stamp code, previous certificate linkage (for re-verification history chains), digital HMAC signature, embedded QR code data, and auto-generated PDF download link.
7. **Notification**: User notification log supporting `EXPIRY_REMINDER`, `APPLICATION_UPDATE`, `SCHEDULED`, `CERTIFICATE_ISSUED`, and `REJECTED` alert types with read tracking.

---

## 3. Statutory Verification Intervals & Validity Rules

Validity is computed dynamically by `src/services/validityService.js` in accordance with the Legal Metrology (General) Rules, 2011:

- **24 Months**: Weights, capacity measures, length measures, tape measures, beam scales, counter machines.
- **60 Months**: Storage tanks.
- **12 Months**: All other commercial instruments, including weighbridges, flow meters, fuel dispensers, and tank lorries.
- **Immediate Re-verification**: Required whenever an instrument undergoes repair, dismantling, or reinstallation prior to returning to commercial use.

---

## 4. API Endpoints

### 4.1 Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a new User or Officer |
| POST | `/api/auth/login` | Public | Authenticate and obtain JWT token |
| POST | `/api/auth/logout` | Authenticated | Clear session cookie |
| GET | `/api/auth/me` | Authenticated | Retrieve current user profile |

### 4.2 Users (`/api/users`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/users/me` | Authenticated | Get logged-in user profile |
| PATCH | `/api/users/me` | Authenticated | Update user profile details |

### 4.3 Shops (`/api/shops`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/shops` | USER | Register a new shop/establishment |
| GET | `/api/shops` | Authenticated | List shops (own shops for USER, all for OFFICER) |
| GET | `/api/shops/:id` | Authenticated | Get shop details by ID |
| PATCH | `/api/shops/:id` | Owner / OFFICER | Update shop information |
| DELETE | `/api/shops/:id` | Owner / OFFICER | Soft-deactivate shop |

### 4.4 Instruments (`/api/instruments`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/instruments` | Owner | Register instrument (supports document upload) |
| GET | `/api/instruments` | Authenticated | List instruments with filters (`category`, `status`, `serialNumber`) |
| GET | `/api/instruments/:id` | Authenticated | Get instrument details |
| PATCH | `/api/instruments/:id` | Owner / OFFICER | Update instrument details or attach documents |
| DELETE | `/api/instruments/:id` | Owner | Remove instrument |

### 4.5 Applications (`/api/applications`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/applications` | USER | Submit Fresh or Re-verification application |
| GET | `/api/applications` | Authenticated | Search & retrieve applications (role-scoped, paginated) |
| GET | `/api/applications/:id` | Authenticated | Get full application details with populated history |
| PATCH | `/api/applications/:id` | Owner | Update application remarks or attach documents |
| PATCH | `/api/applications/:id/assign` | OFFICER | Allocate application to an officer |
| PATCH | `/api/applications/:id/status` | OFFICER | Controlled workflow transition |
| PATCH | `/api/applications/:id/verify` | Assigned OFFICER | Record inspection readings, outcome (`PASS`/`FAIL`/`REJECTED`), auto-issue certificate on `PASS` |
| PATCH | `/api/applications/:id/reject` | OFFICER | Reject application with reason |

### 4.6 Schedules (`/api/schedules`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/schedules` | OFFICER | Create field or office verification schedule |
| GET | `/api/schedules` | Authenticated | List verification schedules (paginated) |
| GET | `/api/schedules/:id` | Authenticated | Get schedule details |
| PATCH | `/api/schedules/:id` | OFFICER | Update schedule remarks or location |
| PATCH | `/api/schedules/:id/reschedule` | OFFICER | Reschedule date with reason, notify applicant |
| PATCH | `/api/schedules/:id/cancel` | OFFICER | Cancel schedule, notify applicant |

### 4.7 Certificates (`/api/certificates`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/certificates/verify/:certificateNumber` | **Public (No Auth)** | Validate authenticity via QR code scan (safe public data) |
| GET | `/api/certificates` | Authenticated | List certificates (own certificates for USER, all for OFFICER) |
| GET | `/api/certificates/:id` | Authenticated | Get certificate details |
| GET | `/api/certificates/:id/download` | Authenticated | Stream / download PDF verification certificate |

### 4.8 Notifications (`/api/notifications`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/notifications` | Authenticated | List notifications with unread count |
| GET | `/api/notifications/unread` | Authenticated | Get unread count and latest unread alerts |
| PATCH | `/api/notifications/:id/read` | Authenticated | Mark individual notification as read |
| PATCH | `/api/notifications/read-all` | Authenticated | Mark all notifications as read |
| POST | `/api/notifications/trigger-reminders` | OFFICER | Trigger statutory 30/15/7-day expiry scan |

### 4.9 Cloudinary Direct Mobile Upload (`/api/cloudinary`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/cloudinary/signature` | Authenticated | Generate signed parameters (`timestamp`, `signature`, `apiKey`, `uploadUrl`) for direct mobile-to-CDN media uploads |

---

## 5. Mobile-First Architecture & Direct Cloudinary Uploads

To deliver an optimal experience for native mobile apps (React Native / Flutter / Android / iOS):
- **Stateless Bearer JWT Authentication**: The authorization token is issued directly in response JSON (`token`, `tokenType: "Bearer"`) and received via `Authorization: Bearer <token>` headers without requiring browser cookie state.
- **Frontend Direct Cloudinary Upload**: Mobile clients upload images (invoices, challans, inspection photos, defect stamps) directly to Cloudinary CDN using HMAC-SHA1 signatures from `GET /api/cloudinary/signature`. This bypasses heavy multipart payload bottlenecks on backend application servers and allows seamless retries and background uploading on mobile devices.
- **Direct Cloudinary URLs in Payloads**: All resource creation and verification endpoints (`/api/instruments`, `/api/applications`, `/api/applications/:id/verify`) natively accept `https://res.cloudinary.com/...` strings in request bodies (`documentUrl`, `documents`, `photographs`, `defectPhotographs`).

---

## 6. Getting Started

### Prerequisites
- Node.js >= 18.0.0
- MongoDB instance (or automated in-memory server during tests)

### Installation
```bash
cd server
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key variables:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/maanak_setu
JWT_SECRET=super_secret_jwt_key_for_maanak_setu_2026
JWT_EXPIRES_IN=7d
BASE_URL=http://localhost:5000
```

### Running the Server
```bash
npm start
# or
node server.js
```

### Running Automated End-to-End Tests
The project includes an integration test suite covering the full two-role verification flow:
```bash
npm test
```

---

## 7. Postman Collection
Import `postman_collection.json` located in the `server` folder into Postman for instant access to pre-configured requests, environment variables, headers, and request bodies for USER and OFFICER.
