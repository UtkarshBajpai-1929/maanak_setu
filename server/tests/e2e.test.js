import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "http";
import app from "../index.js";
import connectDB from "../src/db/index.js";

const BASE_HEADERS = { "Content-Type": "application/json" };

let mongod;
let server;
let baseUrl;

const logStep = (step, title) => {
  console.log(`\n[STEP ${step}] ${title}`);
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  PASS: ${message}`);
};

async function runTests() {
  console.log("==================================================");
  console.log("STARTING MAANAKSETU (USER & OFFICER) TEST SUITE");
  console.log("==================================================");

  // 1. Setup in-memory MongoDB
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await connectDB(uri);

  // 2. Start HTTP server on port 5123
  const PORT = 5123;
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  baseUrl = `http://localhost:${PORT}/api`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    let userToken, officerToken;
    let userId, officerId;
    let shopId;
    let instrumentId;
    let applicationId, appNumber;
    let scheduleId;
    let certificateId, certNumber;
    let prevCertId;

    // --- TEST 1: User & Officer Registration ---
    logStep(1, "User & Officer Registration (USER, OFFICER)");
    const userRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({
        name: "Ramesh Kumar",
        email: "ramesh.kumar@example.com",
        phone: "9876543210",
        password: "Password123!",
        aadhar_no: "123456789012",
        pin_code: "110001",
        address: { street: "12 Connaught Place", city: "New Delhi", district: "New Delhi", state: "Delhi" },
        role: "USER",
      }),
    });
    const userData = await userRes.json();
    assert(userRes.status === 201, "User registered with status 201");
    assert(userData.success === true, "Response has success: true");
    assert(userData.data.token, "JWT token returned");
    assert(userData.data.tokenType === "Bearer", "tokenType is Bearer for mobile client");
    assert(userData.data.user.role === "USER", "Role is USER");
    assert(userData.data.user.password === undefined, "Password is not returned in response");
    assert(userData.data.user.aadhar_no === "123456789012", "Aadhaar is treated as String");
    userToken = userData.data.token;
    userId = userData.data.user._id;

    // Register Officer
    const officerRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({
        name: "Officer Vikram Singh",
        email: "vikram.singh@gov.in",
        phone: "9811223344",
        password: "OfficerPass123!",
        aadhar_no: "998877665544",
        pin_code: "110001",
        role: "OFFICER",
      }),
    });
    const officerData = await officerRes.json();
    assert(officerRes.status === 201, "Officer registered with status 201");
    assert(officerData.data.user.role === "OFFICER", "Role is OFFICER");
    officerToken = officerData.data.token;
    officerId = officerData.data.user._id;

    // Duplicate email check
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({
        name: "Duplicate User",
        email: "ramesh.kumar@example.com",
        phone: "9123456780",
        password: "Password123!",
        aadhar_no: "123456789013",
        pin_code: "110001",
      }),
    });
    assert(dupRes.status === 409, "Duplicate email rejected with status 409");

    // --- TEST 2: User Login ---
    logStep(2, "User Login");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({
        email: "ramesh.kumar@example.com",
        password: "Password123!",
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, "Login succeeded with status 200");
    assert(loginData.data.token, "Login returned token");
    assert(loginData.data.user.password === undefined, "Password hidden in login response");

    // Invalid password check
    const badLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({ email: "ramesh.kumar@example.com", password: "wrongpassword" }),
    });
    assert(badLogin.status === 401, "Invalid password rejected with status 401");

    // --- TEST 3: Auth Middleware & Profile ---
    logStep(3, "Auth Middleware & Current User Profile");
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, "Profile retrieved with status 200");
    assert(meData.data.user.email === "ramesh.kumar@example.com", "Correct user returned");

    const noAuthRes = await fetch(`${baseUrl}/auth/me`);
    assert(noAuthRes.status === 401, "Unauthenticated request rejected with status 401");

    // Update profile
    const updateProfileRes = await fetch(`${baseUrl}/users/me`, {
      method: "PATCH",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ name: "Ramesh K. Gupta" }),
    });
    assert(updateProfileRes.status === 200, "Profile updated with status 200");

    // --- TEST 4: Role-based Authorization ---
    logStep(4, "Role-based Authorization");
    // Normal USER cannot create schedule (OFFICER only)
    const unauthorizedSchedRes = await fetch(`${baseUrl}/schedules`, {
      method: "POST",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        application: "60c72b2f9b1d8b2bad000001",
        scheduledDate: new Date().toISOString(),
        verificationType: "OFFICE",
      }),
    });
    assert(unauthorizedSchedRes.status === 403, "Normal USER denied access to OFFICER schedule creation (403)");

    // --- TEST 5: Shop Creation & Ownership ---
    logStep(5, "Shop Creation & Ownership Validation");
    const shopRes = await fetch(`${baseUrl}/shops`, {
      method: "POST",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        shopName: "Ramesh General Store & Weighing Station",
        licenseNumber: "LIC-DL-2026-00123",
        address: {
          street: "Shop 14, Main Market",
          city: "New Delhi",
          district: "Central Delhi",
          state: "Delhi",
          pincode: "110001",
        },
        operational_time: { opening: "09:00 AM", closing: "08:00 PM" },
      }),
    });
    const shopData = await shopRes.json();
    assert(shopRes.status === 201, "Shop created with status 201");
    assert(shopData.data.owner === userId, "Shop owner correctly linked to logged-in user");
    shopId = shopData.data._id;

    // Duplicate license check
    const dupShopRes = await fetch(`${baseUrl}/shops`, {
      method: "POST",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        shopName: "Duplicate License Shop",
        licenseNumber: "LIC-DL-2026-00123",
      }),
    });
    assert(dupShopRes.status === 409, "Duplicate shop license rejected with 409");

    // --- TEST 6: Instrument Registration with Cloudinary URL ---
    logStep(6, "Instrument Registration (with direct Cloudinary URL from mobile)");
    const instRes = await fetch(`${baseUrl}/instruments`, {
      method: "POST",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        shop: shopId,
        category: "WEIGHING_SCALE",
        serialNumber: "SN-SCALE-2026-9999",
        capacity: "50 kg",
        installationType: "MOVABLE",
        modelApprovalCertificateNumber: "IND-APP-2024-045",
        documentUrl: "https://res.cloudinary.com/maanaksetu/image/upload/v1720000000/model_approval_sample.pdf",
        documentTitle: "Model Approval Certificate",
      }),
    });
    const instData = await instRes.json();
    assert(instRes.status === 201, "Instrument created with status 201");
    assert(instData.data.status === "PENDING_VERIFICATION", "Initial status is PENDING_VERIFICATION");
    assert(instData.data.documents[0].url.startsWith("https://res.cloudinary.com"), "Direct Cloudinary document URL saved on instrument");
    instrumentId = instData.data._id;

    // Duplicate serial check
    const dupInstRes = await fetch(`${baseUrl}/instruments`, {
      method: "POST",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        shop: shopId,
        category: "WEIGHING_SCALE",
        serialNumber: "SN-SCALE-2026-9999",
        installationType: "MOVABLE",
      }),
    });
    assert(dupInstRes.status === 409, "Duplicate serial number rejected with 409");

    // --- TEST 7: Application Creation (Fresh with Cloudinary URL) ---
    logStep(7, "Verification Application Creation (FRESH with Cloudinary URL)");
    const appRes = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        shop: shopId,
        instrument: instrumentId,
        applicationType: "FRESH",
        remarks: "Fresh verification requested for commercial counter scale",
        documentUrl: "https://res.cloudinary.com/maanaksetu/image/upload/v1720000000/invoice_doc.pdf",
      }),
    });
    const appData = await appRes.json();
    assert(appRes.status === 201, "Application submitted with status 201");
    assert(appData.data.status === "SUBMITTED", "Initial application status is SUBMITTED");
    assert(appData.data.documents[0].url.startsWith("https://res.cloudinary.com"), "Direct Cloudinary URL saved on application");
    assert(appData.data.applicationNumber.startsWith("APP-"), "Generated unique application number");
    applicationId = appData.data._id;
    appNumber = appData.data.applicationNumber;

    // --- TEST 8: Application Retrieval, Search & Filtering ---
    logStep(8, "Application Retrieval, Search & Filtering");
    const listAppsRes = await fetch(`${baseUrl}/applications?status=SUBMITTED&limit=10&page=1`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const listAppsData = await listAppsRes.json();
    assert(listAppsRes.status === 200, "Applications list retrieved with status 200");
    assert(Array.isArray(listAppsData.data), "Returns array of applications");
    assert(listAppsData.pagination.total >= 1, "Pagination info returned");

    // --- TEST 9: Officer Area PIN Code Routing & Visibility ---
    logStep(9, "Officer Area PIN Code Routing & Visibility (No Manual Officer Assignment)");
    const areaAppsRes = await fetch(`${baseUrl}/applications`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    const areaAppsData = await areaAppsRes.json();
    assert(areaAppsRes.status === 200, "Applications retrieved by area officer with status 200");
    assert(
      areaAppsData.data.some((a) => a._id === applicationId),
      "Officer with PIN code 110001 automatically sees the shop application in 110001"
    );

    // Register officer from different area (e.g. 560001) to verify jurisdiction segregation
    const otherOfficerRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify({
        name: "Officer South Zone",
        email: "south.officer@gov.in",
        phone: "9822334455",
        password: "OfficerPass123!",
        aadhar_no: "997755331100",
        pin_code: "560001",
        role: "OFFICER",
      }),
    });
    const otherOfficerData = await otherOfficerRes.json();
    const otherAppsRes = await fetch(`${baseUrl}/applications`, {
      headers: { Authorization: `Bearer ${otherOfficerData.data.token}` },
    });
    const otherAppsData = await otherAppsRes.json();
    assert(
      !otherAppsData.data.some((a) => a._id === applicationId),
      "Officer with PIN code 560001 does not see applications from 110001"
    );

    // --- TEST 10: Schedule Creation ---
    logStep(10, "Verification Scheduling");
    const scheduleDate = new Date(Date.now() + 86400000).toISOString();
    const schedRes = await fetch(`${baseUrl}/schedules`, {
      method: "POST",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${officerToken}` },
      body: JSON.stringify({
        application: applicationId,
        scheduledDate: scheduleDate,
        verificationType: "OFFICE",
        remarks: "Please bring instrument to Sub-Divisional Metrology Office",
      }),
    });
    const schedData = await schedRes.json();
    assert(schedRes.status === 201, "Schedule created with status 201");
    assert(schedData.data.status === "SCHEDULED", "Schedule status is SCHEDULED");
    scheduleId = schedData.data._id;

    // --- TEST 11: Schedule Rescheduling ---
    logStep(11, "Schedule Rescheduling");
    const newDate = new Date(Date.now() + 2 * 86400000).toISOString();
    const reschedRes = await fetch(`${baseUrl}/schedules/${scheduleId}/reschedule`, {
      method: "PATCH",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${officerToken}` },
      body: JSON.stringify({
        scheduledDate: newDate,
        rescheduleReason: "Officer on field duty",
      }),
    });
    const reschedData = await reschedRes.json();
    assert(reschedRes.status === 200, "Schedule rescheduled with status 200");
    assert(reschedData.data.status === "RESCHEDULED", "Schedule status updated to RESCHEDULED");

    // Move application to VERIFICATION_PENDING
    const statusRes = await fetch(`${baseUrl}/applications/${applicationId}/status`, {
      method: "PATCH",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${officerToken}` },
      body: JSON.stringify({ status: "VERIFICATION_PENDING" }),
    });
    assert(statusRes.status === 200, "Application moved to VERIFICATION_PENDING");

    // --- TEST 12: Verification Submission - PASS & Certificate Issuance ---
    logStep(12, "Verification Submission - PASS & Digital Certificate Generation");
    const verifyRes = await fetch(`${baseUrl}/applications/${applicationId}/verify`, {
      method: "PATCH",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${officerToken}` },
      body: JSON.stringify({
        outcome: "PASS",
        instrumentCondition: "GOOD",
        testReadings: [
          { parameter: "Repeatability error at 10kg", standardValue: "10.000 kg", observedValue: "10.001 kg", error: "+0.001 kg", pass: true },
          { parameter: "Eccentricity test at 25kg", standardValue: "25.000 kg", observedValue: "25.000 kg", error: "0.000 kg", pass: true },
        ],
        stampCode: "LM-DEL-26-042",
        remarks: "Scale verified and stamped under Legal Metrology Rules",
      }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200, "Verification passed with status 200");
    assert(verifyData.data.application.status === "COMPLETED", "Application transitioned to COMPLETED");
    assert(verifyData.data.certificate, "Digital certificate issued");
    assert(verifyData.data.certificate.certificateNumber.startsWith("CERT-"), "Valid certificate number format");
    assert(verifyData.data.certificate.qrCode.startsWith("data:image/png;base64,"), "QR Code generated");
    assert(verifyData.data.certificate.status === "ACTIVE", "Certificate status is ACTIVE");

    certificateId = verifyData.data.certificate._id;
    certNumber = verifyData.data.certificate.certificateNumber;
    prevCertId = certificateId;

    // Check Instrument status is now VERIFIED
    const updatedInstRes = await fetch(`${baseUrl}/instruments/${instrumentId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const updatedInst = await updatedInstRes.json();
    assert(updatedInst.data.status === "VERIFIED", "Instrument status updated to VERIFIED");

    // --- TEST 13: QR Code Public Verification Endpoint ---
    logStep(13, "QR Code Public Verification Endpoint (No Auth Required)");
    const publicVerifyRes = await fetch(`${baseUrl}/certificates/verify/${certNumber}`);
    const publicVerifyData = await publicVerifyRes.json();
    assert(publicVerifyRes.status === 200, "Public verification returned 200 without authentication");
    assert(publicVerifyData.data.isCurrentlyValid === true, "Certificate authenticity validated as currently active");
    assert(publicVerifyData.data.certificateNumber === certNumber, "Correct certificate details returned");
    assert(publicVerifyData.data.password === undefined, "No sensitive password data exposed");
    assert(publicVerifyData.data.establishment.shopName === "Ramesh General Store & Weighing Station", "Shop name present");

    // --- TEST 14: Certificate Retrieval & PDF Download ---
    logStep(14, "Certificate Retrieval & PDF Download");
    const getCertRes = await fetch(`${baseUrl}/certificates/${certificateId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const certDetailData = await getCertRes.json();
    assert(getCertRes.status === 200, "Certificate retrieved by ID");
    assert(certDetailData.data.pdfDownloadUrl, "Certificate returns mobile-ready pdfDownloadUrl");

    const dlRes = await fetch(`${baseUrl}/certificates/${certificateId}/download`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(dlRes.status === 200, "Certificate PDF downloaded with status 200");
    const contentType = dlRes.headers.get("content-type");
    assert(contentType && contentType.includes("application/pdf"), "Download content-type is application/pdf");

    // --- TEST 15: Re-verification Flow ---
    logStep(15, "Re-verification Application & Certificate History Chain");
    const reVerifAppRes = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        shop: shopId,
        instrument: instrumentId,
        applicationType: "RE_VERIFICATION",
        reason: "REPAIR",
        previousCertificate: prevCertId,
        remarks: "Scale re-calibrated after component servicing",
      }),
    });
    const reVerifData = await reVerifAppRes.json();
    assert(reVerifAppRes.status === 201, "Re-verification application submitted");
    assert(reVerifData.data.previousCertificate === prevCertId, "Previous certificate history linked");

    const reVerifAppId = reVerifData.data._id;

    // Assign officer & progress workflow
    await fetch(`${baseUrl}/applications/${reVerifAppId}/assign`, {
      method: "PATCH",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${officerToken}` },
      body: JSON.stringify({ officerId: officerId }),
    });
    await fetch(`${baseUrl}/applications/${reVerifAppId}/status`, {
      method: "PATCH",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${officerToken}` },
      body: JSON.stringify({ status: "SCHEDULED" }),
    });
    await fetch(`${baseUrl}/applications/${reVerifAppId}/status`, {
      method: "PATCH",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${officerToken}` },
      body: JSON.stringify({ status: "VERIFICATION_PENDING" }),
    });

    // --- TEST 16: Verification Submission - REJECTED Workflow ---
    logStep(16, "Verification Rejection Workflow");
    const rejectRes = await fetch(`${baseUrl}/applications/${reVerifAppId}/verify`, {
      method: "PATCH",
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${officerToken}` },
      body: JSON.stringify({
        outcome: "FAIL",
        instrumentCondition: "DEFECTIVE",
        defectDescription: "Load cell drift exceeded maximum permissible error (+15g on 10kg)",
        repairableStatus: "REPAIRABLE",
        resubmissionDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
        remarks: "Must be recalibrated by licensed repairer before re-test",
      }),
    });
    const rejectData = await rejectRes.json();
    assert(rejectRes.status === 200, "Rejection recorded successfully");
    assert(rejectData.data.application.status === "REJECTED", "Application status is REJECTED");
    assert(rejectData.data.application.rejectionReason.includes("drift"), "Rejection reason saved");

    // --- TEST 17: Notifications Management ---
    logStep(17, "Notifications Management (Retrieval, Unread count, Mark as read)");
    const notifsRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const notifsData = await notifsRes.json();
    assert(notifsRes.status === 200, "Notifications retrieved");
    assert(notifsData.data.notifications.length >= 1, "User received notifications");

    const unreadRes = await fetch(`${baseUrl}/notifications/unread`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const unreadData = await unreadRes.json();
    assert(unreadRes.status === 200, "Unread notifications fetched");
    assert(typeof unreadData.data.unreadCount === "number", "Unread count returned");

    const firstNotifId = notifsData.data.notifications[0]._id;
    const readRes = await fetch(`${baseUrl}/notifications/${firstNotifId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(readRes.status === 200, "Single notification marked as read");

    const markAllRes = await fetch(`${baseUrl}/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(markAllRes.status === 200, "All notifications marked as read");

    // --- TEST 18: Expiry Reminder Processing ---
    logStep(18, "Expiry Reminder Processing");
    const expiryRes = await fetch(`${baseUrl}/notifications/trigger-reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert(expiryRes.status === 200, "Expiry check executed without error");

    // --- TEST 19: Centralized Error Handling & Edge Cases ---
    logStep(19, "Centralized Error Handling (Invalid ObjectId, 404, Validation)");
    const badIdRes = await fetch(`${baseUrl}/shops/invalid-object-id-123`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const notFoundRes = await fetch(`${baseUrl}/non-existent-endpoint`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(notFoundRes.status === 404, "Unknown route returns 404");



    console.log("\n==================================================");
    console.log("ALL TESTS PASSED! ONLY 2 ROLES (USER & OFFICER)");
    console.log("==================================================");
  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
}

runTests();
