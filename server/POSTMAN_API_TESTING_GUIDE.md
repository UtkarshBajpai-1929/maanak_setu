# MaanakSetu - Complete Postman API Testing Guide & Reference

This guide provides the complete end-to-end API specification for testing **MaanakSetu** on Postman. Follow the recommended sequential execution order so that entity IDs (`shopId`, `instrumentId`, `applicationId`, `certificateNumber`) flow logically into subsequent requests.

---

## Postman Environment Setup

Configure these collection variables in Postman:

| Variable | Description | Initial Value |
|---|---|---|
| `baseUrl` | Backend API base URL | `http://localhost:5000/api` |
| `userToken` | Bearer token for applicant | *(Set from Step 1.2)* |
| `officerToken` | Bearer token for LMO | *(Set from Step 1.3)* |
| `shopId` | ID of registered shop | *(Set from Step 3.1)* |
| `instrumentId` | ID of registered instrument | *(Set from Step 4.1)* |
| `applicationId` | ID of submitted application | *(Set from Step 5.1)* |
| `scheduleId` | ID of verification schedule | *(Set from Step 6.1)* |
| `certificateId` | ID of issued certificate | *(Set from Step 5.4)* |
| `certificateNumber` | Statutory certificate code | *(Set from Step 5.4)* |
| `notificationId` | ID of received notification | *(Set from Step 8.1)* |

---

## Recommended Execution Order

```
[1. Auth] Register USER & OFFICER ──► Login
   │
   ▼
[2. Shop] Register Shop (USER)
   │
   ▼
[3. Cloudinary Upload (Direct from Mobile)]
   GET /api/cloudinary/signature ──► Upload direct to Cloudinary CDN ──► Obtain secure_url
   │
   ▼
[4. Instrument] Register Weighing Scale with Cloudinary documentUrl (USER)
   │
   ▼
[5. Application] Submit Fresh Verification with Cloudinary documentUrl (USER)
   │
   ▼
[6. Allocation & Schedule] Assign Officer ──► Schedule Appointment (OFFICER)
   │
   ▼
[7. Inspection & Verification] Record Readings, Photos & PASS (OFFICER)
   │
   ├──────► Digital Certificate Auto-Issued
   ├──────► Embeds QR Code & Generates PDF
   │
   ▼
[8. Public Verification] Scan/Query QR Verification Endpoint (Public / No Auth)
   │
   ▼
[9. Download Certificate] Stream Official PDF (USER / OFFICER)
   │
   ▼
[10. Re-Verification Flow] Submit Re-verification with Previous Cert Link (USER)
   │
   ▼
[11. Rejection Workflow] Record Inspection with FAIL & Defect Photos (OFFICER)
   │
   ▼
[12. Notifications] Check Alerts & Mark Read (USER)
```

---

## 1. Authentication (`/api/auth`)

### 1.1 Register Applicant User
- **Method**: `POST`
- **URL**: `{{baseUrl}}/auth/register`
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "name": "Ramesh Kumar",
    "email": "ramesh.kumar@example.com",
    "phone": "9876543210",
    "password": "Password123!",
    "aadhar_no": "123456789012",
    "pin_code": "110001",
    "address": {
      "street": "14 Connaught Place",
      "city": "New Delhi",
      "district": "Central Delhi",
      "state": "Delhi"
    },
    "role": "USER"
  }
  ```
- **Expected Status**: `201 Created`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "expiresIn": "7d",
      "user": {
        "_id": "6741b2c34a9e5f0012ab1001",
        "name": "Ramesh Kumar",
        "email": "ramesh.kumar@example.com",
        "phone": "9876543210",
        "role": "USER",
        "aadhar_no": "123456789012",
        "pin_code": "110001",
        "isActive": true,
        "createdAt": "2026-09-25T01:00:00.000Z"
      }
    }
  }
  ```
  *(Save `data.token` as `userToken`)*

---

### 1.2 Register Verification Officer
- **Method**: `POST`
- **URL**: `{{baseUrl}}/auth/register`
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "name": "Officer Vikram Singh",
    "email": "vikram.singh@gov.in",
    "phone": "9811223344",
    "password": "OfficerPass123!",
    "aadhar_no": "998877665544",
    "pin_code": "110001",
    "role": "OFFICER"
  }
  ```
- **Expected Status**: `201 Created`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "_id": "6741b2c34a9e5f0012ab1002",
        "name": "Officer Vikram Singh",
        "email": "vikram.singh@gov.in",
        "phone": "9811223344",
        "role": "OFFICER",
        "aadhar_no": "998877665544",
        "isActive": true
      }
    }
  }
  ```
  *(Save `data.token` as `officerToken`)*

---

### 1.3 Login (User or Officer)
- **Method**: `POST`
- **URL**: `{{baseUrl}}/auth/login`
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "ramesh.kumar@example.com",
    "password": "Password123!"
  }
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Logged in successfully",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "_id": "6741b2c34a9e5f0012ab1001",
        "name": "Ramesh Kumar",
        "email": "ramesh.kumar@example.com",
        "role": "USER"
      }
    }
  }
  ```

---

### 1.4 Get Current Logged-in User Profile
- **Method**: `GET`
- **URL**: `{{baseUrl}}/auth/me`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Current user profile retrieved",
    "data": {
      "user": {
        "_id": "6741b2c34a9e5f0012ab1001",
        "name": "Ramesh Kumar",
        "email": "ramesh.kumar@example.com",
        "phone": "9876543210",
        "role": "USER",
        "aadhar_no": "123456789012"
      }
    }
  }
  ```

---

### 1.5 Logout
- **Method**: `POST`
- **URL**: `{{baseUrl}}/auth/logout`
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

---

## 2. User Profile Management (`/api/users`)

### 2.1 Update My Profile
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/users/me`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "name": "Ramesh Kumar Gupta",
    "phone": "9876543219",
    "pin_code": "110002"
  }
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Profile updated successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab1001",
      "name": "Ramesh Kumar Gupta",
      "phone": "9876543219",
      "pin_code": "110002"
    }
  }
  ```

---

## 3. Shop Registration & Management (`/api/shops`)

### 3.1 Create / Register Shop
- **Method**: `POST`
- **URL**: `{{baseUrl}}/shops`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "shopName": "Ramesh Kirana & Provisions",
    "licenseNumber": "LIC-DEL-2026-9001",
    "address": {
      "street": "Shop 12, Main Bazaar",
      "city": "New Delhi",
      "district": "Central Delhi",
      "state": "Delhi",
      "pincode": "110001"
    },
    "operational_time": {
      "opening": "08:00 AM",
      "closing": "09:00 PM"
    }
  }
  ```
- **Expected Status**: `201 Created`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Shop created successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab2001",
      "owner": "6741b2c34a9e5f0012ab1001",
      "shopName": "Ramesh Kirana & Provisions",
      "licenseNumber": "LIC-DEL-2026-9001",
      "address": {
        "street": "Shop 12, Main Bazaar",
        "city": "New Delhi",
        "district": "Central Delhi",
        "state": "Delhi",
        "pincode": "110001"
      },
      "isActive": true,
      "operational_time": {
        "opening": "08:00 AM",
        "closing": "09:00 PM"
      },
      "createdAt": "2026-09-25T01:05:00.000Z"
    }
  }
  ```
  *(Save `data._id` as `shopId`)*

---

### 3.2 List Shops (Paginated & Filtered)
- **Method**: `GET`
- **URL**: `{{baseUrl}}/shops?page=1&limit=10&search=Kirana`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Shops retrieved successfully",
    "data": [
      {
        "_id": "6741b2c34a9e5f0012ab2001",
        "shopName": "Ramesh Kirana & Provisions",
        "licenseNumber": "LIC-DEL-2026-9001",
        "isActive": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
  ```

---

### 3.3 Get Shop Details By ID
- **Method**: `GET`
- **URL**: `{{baseUrl}}/shops/{{shopId}}`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Shop retrieved successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab2001",
      "owner": {
        "_id": "6741b2c34a9e5f0012ab1001",
        "name": "Ramesh Kumar Gupta",
        "email": "ramesh.kumar@example.com"
      },
      "shopName": "Ramesh Kirana & Provisions"
    }
  }
  ```

---

## 4. Instrument Registration (`/api/instruments`)

### 4.1 Register Instrument Under Shop
- **Method**: `POST`
- **URL**: `{{baseUrl}}/instruments`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "shop": "{{shopId}}",
    "category": "WEIGHING_SCALE",
    "serialNumber": "SN-WS-2026-1001",
    "capacity": "30 kg",
    "installationType": "MOVABLE",
    "modelApprovalCertificateNumber": "IND/09/2023/123",
    "purchaseDate": "2024-01-15T00:00:00.000Z",
    "manufacturingDate": "2023-11-20T00:00:00.000Z",
    "documentUrl": "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/instruments/scale_invoice.pdf",
    "documentType": "INVOICE",
    "documentName": "scale_invoice.pdf"
  }
  ```
- **Expected Status**: `201 Created`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Instrument registered successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab3001",
      "shop": "6741b2c34a9e5f0012ab2001",
      "category": "WEIGHING_SCALE",
      "serialNumber": "SN-WS-2026-1001",
      "capacity": "30 kg",
      "installationType": "MOVABLE",
      "modelApprovalCertificateNumber": "IND/09/2023/123",
      "status": "PENDING_VERIFICATION",
      "documents": [
        {
          "name": "scale_invoice.pdf",
          "url": "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/instruments/scale_invoice.pdf",
          "type": "INVOICE",
          "uploadedAt": "2026-09-25T01:10:00.000Z"
        }
      ],
      "createdAt": "2026-09-25T01:10:00.000Z"
    }
  }
  ```
  *(Save `data._id` as `instrumentId`)*

---

### 4.2 List Instruments
- **Method**: `GET`
- **URL**: `{{baseUrl}}/instruments?category=WEIGHING_SCALE&status=PENDING_VERIFICATION`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Instruments retrieved successfully",
    "data": [
      {
        "_id": "6741b2c34a9e5f0012ab3001",
        "category": "WEIGHING_SCALE",
        "serialNumber": "SN-WS-2026-1001",
        "capacity": "30 kg",
        "status": "PENDING_VERIFICATION"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
  ```

---

## 5. Verification Application Workflow (`/api/applications`)

### 5.1 Submit Fresh Verification Application
- **Method**: `POST`
- **URL**: `{{baseUrl}}/applications`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "shop": "{{shopId}}",
    "instrument": "{{instrumentId}}",
    "applicationType": "FRESH",
    "remarks": "Initial verification of newly acquired electronic counter scale",
    "documentUrl": "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/applications/verification_challan.pdf",
    "documentType": "OTHER",
    "documentName": "verification_challan.pdf"
  }
  ```
- **Expected Status**: `201 Created`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Application submitted successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab4001",
      "applicationNumber": "APP-20260925-A1B2C3",
      "applicant": "6741b2c34a9e5f0012ab1001",
      "shop": "6741b2c34a9e5f0012ab2001",
      "instrument": "6741b2c34a9e5f0012ab3001",
      "applicationType": "FRESH",
      "status": "SUBMITTED",
      "remarks": "Initial verification of newly acquired electronic counter scale",
      "documents": [
        {
          "name": "verification_challan.pdf",
          "url": "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/applications/verification_challan.pdf",
          "type": "OTHER",
          "uploadedAt": "2026-09-25T01:15:00.000Z"
        }
      ],
      "createdAt": "2026-09-25T01:15:00.000Z"
    }
  }
  ```
  *(Save `data._id` as `applicationId`)*

---

### 5.2 Officer Allocation (Officer self-assigns or assigns to an officer)
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/applications/{{applicationId}}/assign`
- **Headers**:
  ```http
  Authorization: Bearer {{officerToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "officerId": "6741b2c34a9e5f0012ab1002"
  }
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Application assigned successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab4001",
      "applicationNumber": "APP-20260925-A1B2C3",
      "assignedOfficer": "6741b2c34a9e5f0012ab1002",
      "status": "UNDER_REVIEW"
    }
  }
  ```

---

### 5.3 Progress Application Status
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/applications/{{applicationId}}/status`
- **Headers**:
  ```http
  Authorization: Bearer {{officerToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "status": "VERIFICATION_PENDING",
    "remarks": "Documents reviewed and verified. Scale ready for physical accuracy tests."
  }
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "6741b2c34a9e5f0012ab4001",
      "status": "VERIFICATION_PENDING"
    }
  }
  ```

---

### 5.4 Submit Verification Result (PASS) & Auto-Issue Certificate
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/applications/{{applicationId}}/verify`
- **Headers**:
  ```http
  Authorization: Bearer {{officerToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "outcome": "PASS",
    "instrumentCondition": "GOOD",
    "testReadings": [
      {
        "parameter": "Repeatability test at 5kg",
        "standardValue": "5.000 kg",
        "observedValue": "5.001 kg",
        "error": "+0.001 kg",
        "pass": true
      },
      {
        "parameter": "Eccentricity test at 15kg",
        "standardValue": "15.000 kg",
        "observedValue": "15.000 kg",
        "error": "0.000 kg",
        "pass": true
      }
    ],
    "stampCode": "LM-DEL-26-904",
    "remarks": "Instrument tested within statutory maximum permissible error limits.",
    "photographs": [
      "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/verification/field_test_reading.jpg",
      "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/verification/lead_seal_applied.jpg"
    ]
  }
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Verification passed and certificate issued successfully",
    "data": {
      "application": {
        "_id": "6741b2c34a9e5f0012ab4001",
        "applicationNumber": "APP-20260925-A1B2C3",
        "status": "COMPLETED",
        "verificationDetails": {
          "outcome": "PASS",
          "instrumentCondition": "GOOD",
          "stampCode": "LM-DEL-26-904",
          "photographs": [
            "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/verification/field_test_reading.jpg",
            "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/verification/lead_seal_applied.jpg"
          ]
        }
      },
      "certificate": {
        "_id": "6741b2c34a9e5f0012ab5001",
        "certificateNumber": "CERT-20260925-D4E5F6",
        "application": "6741b2c34a9e5f0012ab4001",
        "instrument": "6741b2c34a9e5f0012ab3001",
        "issueDate": "2026-09-25T01:25:00.000Z",
        "validFrom": "2026-09-25T01:25:00.000Z",
        "validUntil": "2028-09-24T23:59:59.999Z",
        "stampCode": "LM-DEL-26-904",
        "certificateType": "VERIFICATION",
        "status": "ACTIVE",
        "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "pdfUrl": "/uploads/certificates/CERT-20260925-D4E5F6.pdf",
        "digitalSignature": "a7c8e9f012b3c4d5e6f7a8b9c0d1e2f3..."
      }
    }
  }
  ```
  *(Save `certificate.certificateNumber` as `certificateNumber` and `certificate._id` as `certificateId`)*

---

### 5.5 Submit Verification Result (FAIL / REJECTION Workflow)
*(Used when an instrument fails calibration)*
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/applications/{{applicationId}}/verify`
- **Headers**:
  ```http
  Authorization: Bearer {{officerToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "outcome": "FAIL",
    "instrumentCondition": "DEFECTIVE",
    "defectDescription": "Excessive load cell zero-drift (+18g at 10kg test load)",
    "repairableStatus": "REPAIRABLE",
    "resubmissionDeadline": "2026-10-15T00:00:00.000Z",
    "remarks": "Must be serviced and calibrated by authorized technician before re-test.",
    "defectPhotographs": [
      "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/verification/tampered_seal_defect.jpg"
    ]
  }
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Verification result recorded as REJECTED",
    "data": {
      "application": {
        "_id": "6741b2c34a9e5f0012ab4001",
        "status": "REJECTED",
        "rejectionReason": "Excessive load cell zero-drift (+18g at 10kg test load)",
        "verificationDetails": {
          "outcome": "FAIL",
          "instrumentCondition": "DEFECTIVE",
          "defectDescription": "Excessive load cell zero-drift (+18g at 10kg test load)",
          "defectPhotographs": [
            "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/verification/tampered_seal_defect.jpg"
          ]
        }
      }
    }
  }
  ```

---

## 6. Schedules (`/api/schedules`)

### 6.1 Create Verification Schedule
- **Method**: `POST`
- **URL**: `{{baseUrl}}/schedules`
- **Headers**:
  ```http
  Authorization: Bearer {{officerToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "application": "{{applicationId}}",
    "scheduledDate": "2026-10-02T10:30:00.000Z",
    "verificationType": "FIELD",
    "remarks": "On-site verification scheduled at store premises"
  }
  ```
- **Expected Status**: `201 Created`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Verification schedule created successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab6001",
      "application": "6741b2c34a9e5f0012ab4001",
      "officer": "6741b2c34a9e5f0012ab1002",
      "scheduledDate": "2026-10-02T10:30:00.000Z",
      "verificationType": "FIELD",
      "status": "SCHEDULED",
      "remarks": "On-site verification scheduled at store premises"
    }
  }
  ```
  *(Save `data._id` as `scheduleId`)*

---

### 6.2 Reschedule Appointment
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/schedules/{{scheduleId}}/reschedule`
- **Headers**:
  ```http
  Authorization: Bearer {{officerToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "scheduledDate": "2026-10-05T11:00:00.000Z",
    "rescheduleReason": "Officer assigned to urgent regulatory enforcement check"
  }
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Verification rescheduled successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab6001",
      "scheduledDate": "2026-10-05T11:00:00.000Z",
      "status": "RESCHEDULED",
      "rescheduleReason": "Officer assigned to urgent regulatory enforcement check"
    }
  }
  ```

---

### 6.3 Cancel Schedule
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/schedules/{{scheduleId}}/cancel`
- **Headers**:
  ```http
  Authorization: Bearer {{officerToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "remarks": "Cancelled due to establishment temporary closure"
  }
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Schedule cancelled successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab6001",
      "status": "CANCELLED"
    }
  }
  ```

---

## 7. Digital Certificates & QR Verification (`/api/certificates`)

### 7.1 Public QR Code Verification Endpoint *(No Authentication Required)*
*(This is the URL encoded into the Certificate's QR code. Anyone scanning the QR code accesses this endpoint)*
- **Method**: `GET`
- **URL**: `{{baseUrl}}/certificates/verify/{{certificateNumber}}`
- **Headers**: None
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Certificate authenticity verified",
    "data": {
      "certificateNumber": "CERT-20260925-D4E5F6",
      "certificateType": "VERIFICATION",
      "status": "ACTIVE",
      "isCurrentlyValid": true,
      "issueDate": "2026-09-25T01:25:00.000Z",
      "validFrom": "2026-09-25T01:25:00.000Z",
      "validUntil": "2028-09-24T23:59:59.999Z",
      "stampCode": "LM-DEL-26-904",
      "issuingAuthority": "Department of Legal Metrology, Government of India",
      "instrument": {
        "category": "WEIGHING_SCALE",
        "serialNumber": "SN-WS-2026-1001",
        "capacity": "30 kg",
        "installationType": "MOVABLE"
      },
      "establishment": {
        "shopName": "Ramesh Kirana & Provisions",
        "district": "Central Delhi",
        "state": "Delhi"
      },
      "verificationResult": "PASS"
    }
  }
  ```

---

### 7.2 Get Certificate Details
- **Method**: `GET`
- **URL**: `{{baseUrl}}/certificates/{{certificateId}}`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Certificate retrieved successfully",
    "data": {
      "_id": "6741b2c34a9e5f0012ab5001",
      "certificateNumber": "CERT-20260925-D4E5F6",
      "status": "ACTIVE",
      "pdfUrl": "/uploads/certificates/CERT-20260925-D4E5F6.pdf",
      "qrCode": "data:image/png;base64,iVBOR..."
    }
  }
  ```

---

### 7.3 Download Certificate PDF
- **Method**: `GET`
- **URL**: `{{baseUrl}}/certificates/{{certificateId}}/download`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Response Headers**:
  ```http
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="CERT-20260925-D4E5F6.pdf"
  ```
- **Expected Output**: Binary PDF file containing the official Government of India Legal Metrology Verification Certificate with embedded QR code, stamp code, and digital verification seal.

---

## 8. Notifications & Alerts (`/api/notifications`)

### 8.1 Get Notifications List
- **Method**: `GET`
- **URL**: `{{baseUrl}}/notifications?page=1&limit=20`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Notifications retrieved successfully",
    "data": {
      "notifications": [
        {
          "_id": "6741b2c34a9e5f0012ab7001",
          "user": "6741b2c34a9e5f0012ab1001",
          "type": "CERTIFICATE_ISSUED",
          "title": "Verification Certificate Issued",
          "message": "Digital Verification Certificate CERT-20260925-D4E5F6 has been issued for instrument SN-WS-2026-1001.",
          "isRead": false,
          "createdAt": "2026-09-25T01:25:01.000Z"
        }
      ],
      "unreadCount": 1
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
  ```
  *(Save `notifications[0]._id` as `notificationId`)*

---

### 8.2 Get Unread Notifications & Count
- **Method**: `GET`
- **URL**: `{{baseUrl}}/notifications/unread`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Unread notifications count and recent items retrieved",
    "data": {
      "unreadCount": 1,
      "notifications": [
        {
          "_id": "6741b2c34a9e5f0012ab7001",
          "title": "Verification Certificate Issued",
          "isRead": false
        }
      ]
    }
  }
  ```

---

### 8.3 Mark Single Notification as Read
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/notifications/{{notificationId}}/read`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Notification marked as read",
    "data": {
      "_id": "6741b2c34a9e5f0012ab7001",
      "isRead": true
    }
  }
  ```

---

### 8.4 Mark All Notifications as Read
- **Method**: `PATCH`
- **URL**: `{{baseUrl}}/notifications/read-all`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "All notifications marked as read",
    "data": {
      "modifiedCount": 1
    }
  }
  ```

---

### 8.5 Trigger Statutory Expiry Reminder Scan *(Officer Only)*
- **Method**: `POST`
- **URL**: `{{baseUrl}}/notifications/trigger-reminders`
- **Headers**:
  ```http
  Authorization: Bearer {{officerToken}}
  ```
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Expiry reminders processed successfully",
    "data": {
      "generatedCount": 0,
      "markedExpiredCount": 0
    }
  }
  ```

---

## 9. Mobile Direct Cloudinary Upload Integration (`/api/cloudinary`)

To ensure optimal performance, battery efficiency, and network resilience on mobile devices, all media files (instrument invoices, verification challans, physical inspection photos, defect stamps) are uploaded **directly from the mobile frontend to Cloudinary CDN**.

### Architecture:
1. **Request Signature**: Mobile app calls `GET /api/cloudinary/signature?folder=maanaksetu/instruments` with Bearer token.
2. **Backend Signs**: Backend computes HMAC-SHA1 signature using API secret and returns `{ cloudName, apiKey, timestamp, signature, folder, uploadUrl }`.
3. **Direct Upload**: Mobile app directly POSTs file to Cloudinary CDN (`https://api.cloudinary.com/v1_1/<cloudName>/auto/upload`).
4. **Obtain CDN URL**: Cloudinary returns `{ "secure_url": "https://res.cloudinary.com/..." }`.
5. **Attach in JSON**: Mobile app sends the `secure_url` in standard JSON payloads to `/api/instruments`, `/api/applications`, or `/api/applications/:id/verify`.

---

### 9.1 Get Upload Signature (Signed Mobile Direct Upload)
- **Method**: `GET`
- **URL**: `{{baseUrl}}/cloudinary/signature?folder=maanaksetu/instruments`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  ```
- **Query Parameters**:
  - `folder` *(Optional)*: Cloudinary subfolder path (e.g. `maanaksetu/instruments`, `maanaksetu/verification`)
- **Expected Status**: `200 OK`
- **Expected Response (when Cloudinary credentials configured in .env)**:
  ```json
  {
    "success": true,
    "message": "Cloudinary upload signature generated successfully",
    "data": {
      "cloudName": "demo",
      "apiKey": "123456789012345",
      "timestamp": 1727221234,
      "signature": "8a6b4c2d0e1f7a8b9c...",
      "folder": "maanaksetu/instruments",
      "isConfigured": true,
      "uploadUrl": "https://api.cloudinary.com/v1_1/demo/auto/upload"
    }
  }
  ```
- **Expected Response (Unsigned fallback / Local development)**:
  ```json
  {
    "success": true,
    "message": "Cloudinary upload configuration (Unsigned mode)",
    "data": {
      "cloudName": null,
      "folder": "maanaksetu/instruments",
      "isConfigured": false,
      "note": "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend .env for signed uploads"
    }
  }
  ```

---

### 9.2 Mobile Direct Upload to Cloudinary (External Request)
- **Method**: `POST`
- **URL**: `https://api.cloudinary.com/v1_1/{{cloudName}}/auto/upload`
- **Form Data (Multipart)**:
  - `file`: *(Binary file from camera or gallery)*
  - `api_key`: `{{apiKey}}`
  - `timestamp`: `{{timestamp}}`
  - `signature`: `{{signature}}`
  - `folder`: `{{folder}}`
- **Expected Status**: `200 OK`
- **Cloudinary Response**:
  ```json
  {
    "secure_url": "https://res.cloudinary.com/demo/image/upload/v1234567890/maanaksetu/instruments/scale_invoice.pdf",
    "public_id": "maanaksetu/instruments/scale_invoice",
    "format": "pdf",
    "bytes": 245100
  }
  ```

---

## 10. Re-Verification History Workflow

When an instrument's certificate approaches expiry (or after repair/dismantling), the user submits a `RE_VERIFICATION` application linking the previous certificate.

### 10.1 Submit Re-verification Request
- **Method**: `POST`
- **URL**: `{{baseUrl}}/applications`
- **Headers**:
  ```http
  Authorization: Bearer {{userToken}}
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "shop": "{{shopId}}",
    "instrument": "{{instrumentId}}",
    "applicationType": "RE_VERIFICATION",
    "reason": "ROUTINE_EXPIRY",
    "previousCertificate": "{{certificateId}}",
    "remarks": "Submitting biennial re-verification application prior to certificate expiry"
  }
  ```
- **Expected Status**: `201 Created`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "Application submitted successfully",
    "data": {
      "applicationNumber": "APP-20260925-F7E8D9",
      "applicationType": "RE_VERIFICATION",
      "reason": "ROUTINE_EXPIRY",
      "previousCertificate": "6741b2c34a9e5f0012ab5001",
      "status": "SUBMITTED"
    }
  }
  ```

---

## 11. System Health

### 11.1 Health Check
- **Method**: `GET`
- **URL**: `{{baseUrl}}/health`
- **Headers**: None
- **Expected Status**: `200 OK`
- **Expected Response**:
  ```json
  {
    "success": true,
    "message": "MaanakSetu Legal Metrology Verification System API is operational",
    "timestamp": "2026-09-25T01:30:00.000Z",
    "uptime": 120.45
  }
  ```

---

## 12. Error Scenarios to Test

### 11.1 Unauthorized Access (401)
- Try requesting `GET {{baseUrl}}/auth/me` without the `Authorization` header.
- **Expected Response**:
  ```json
  {
    "success": false,
    "message": "Authentication token is required"
  }
  ```

### 11.2 Role Forbidden (403)
- Try creating a schedule (`POST {{baseUrl}}/schedules`) using `{{userToken}}` instead of `{{officerToken}}`.
- **Expected Response**:
  ```json
  {
    "success": false,
    "message": "Access denied. Role 'USER' is not authorized to access this resource"
  }
  ```

### 11.3 Invalid ObjectId Format (400)
- Try requesting `GET {{baseUrl}}/shops/invalid-id-123`.
- **Expected Response**:
  ```json
  {
    "success": false,
    "message": "Invalid id parameter format"
  }
  ```

### 11.4 Duplicate Key Collision (409)
- Register an instrument with an existing `serialNumber`.
- **Expected Response**:
  ```json
  {
    "success": false,
    "message": "Instrument with this serial number already exists"
  }
  ```
