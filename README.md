# MaanakSetu - Online Verification System for Weighing and Measuring Instruments

Smart India Hackathon (SIH) Problem Statement: 26036  
Department: Department of Legal Metrology, Government of India  
Regulatory Basis: Legal Metrology Act, 2009 & Legal Metrology (General) Rules, 2011

---

## 1. Overview

MaanakSetu is an enterprise-grade digital backend designed to digitize the verification, certification, and lifecycle management of legal metrology instruments across India. It eliminates manual paper workflows, enables verifiable digital certificates with tamper-proof QR codes, maintains instrument re-verification history chains, calculates statutory validity intervals, and automates expiry alerts.

Roles:
- **USER**: Instrument owners / business proprietors.
- **OFFICER**: Designated Legal Metrology verification officers.

Mobile Architecture:
- Built specifically for native mobile clients (React Native, Flutter, Kotlin/Java, Swift) with stateless Bearer JWT authentication.
- Media files (invoices, verification challans, physical inspection photos, defect stamps) are uploaded directly from the mobile frontend to Cloudinary CDN via `/api/cloudinary/signature`, keeping backend API payloads lightweight and fast.

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

---

## 3. Quick Start

```bash
cd server
npm install
npm test
npm start
```

A complete Postman collection is provided at `server/postman_collection.json`, with a complete testing guide in `server/POSTMAN_API_TESTING_GUIDE.md` and full API documentation in `server/README.md`.
