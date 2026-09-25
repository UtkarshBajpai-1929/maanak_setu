import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import connectDB from "../src/db/index.js";
import {
  createTransporter,
  setTransporter,
  resetTransporter,
  verifyEmailTransport,
  resolveRecipient,
  sendVerificationSuccessEmail,
} from "../src/services/emailService.js";
import { issueCertificateForApplication } from "../src/services/certificateService.js";
import User from "../src/models/user.js";
import Shop from "../src/models/shop.js";
import Instrument from "../src/models/instrument.js";
import Application from "../src/models/application.js";
import Certificate from "../src/models/certificate.js";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  PASS: ${message}`);
};

const logStep = (step, title) => {
  console.log(`\n[TEST ${step}] ${title}`);
};

async function runTests() {
  console.log("==================================================");
  console.log("STARTING MAANAKSETU EMAIL NOTIFICATION TEST SUITE");
  console.log("==================================================");

  let mongod;

  try {
    // Setup in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await connectDB(uri);

    // ----------------------------------------------------
    // TEST 1: SMTP Transporter Creation from Environment Variables
    // ----------------------------------------------------
    logStep(1, "SMTP Transporter Creation from Environment Variables");
    process.env.SMTP_HOST = "smtp.mailtrap.io";
    process.env.SMTP_PORT = "2525";
    process.env.SMTP_USER = "test_user_123";
    process.env.SMTP_PASSWORD = "test_password_456";
    process.env.SMTP_FROM = "MaanakSetu <no-reply@maanaksetu.gov.in>";

    resetTransporter();
    const transporter = createTransporter();
    assert(transporter !== null, "Transporter successfully instantiated with env vars");
    assert(typeof transporter.sendMail === "function", "Transporter has sendMail function");
    assert(typeof transporter.verify === "function", "Transporter has verify function");

    // ----------------------------------------------------
    // TEST 2: SMTP Configuration Verification
    // ----------------------------------------------------
    logStep(2, "SMTP Configuration Verification");
    // Mock successful verification
    const mockSuccessTransporter = {
      verify: async () => true,
      sendMail: async () => ({ messageId: "<msg-test-123@maanaksetu.gov.in>" }),
    };
    const verifySuccess = await verifyEmailTransport(mockSuccessTransporter);
    assert(verifySuccess.isConnected === true, "verifyEmailTransport returns isConnected: true for valid connection");

    // Mock failed verification (does not crash application)
    const mockFailingTransporter = {
      verify: async () => {
        throw new Error("Connection refused: 535 Authentication failed");
      },
      sendMail: async () => {
        throw new Error("Connection refused: 535 Authentication failed");
      },
    };
    const verifyFailure = await verifyEmailTransport(mockFailingTransporter);
    assert(verifyFailure.isConnected === false, "verifyEmailTransport returns isConnected: false on failure");
    assert(verifyFailure.error.includes("Authentication failed"), "Error message captured and reported without crashing");

    // Transporter not configured case
    const unconfiguredVerify = await verifyEmailTransport({
      verify: async () => true,
      sendMail: async () => {},
    });
    assert(unconfiguredVerify.isConnected === true, "verifyEmailTransport runs verify on supplied transporter");

    // ----------------------------------------------------
    // TEST 3: Successful Verification Email Content & Structure
    // ----------------------------------------------------
    logStep(3, "Successful Verification Email Content & Structure");
    let sentMails = [];
    const testTransporter = {
      verify: async () => true,
      sendMail: async (mailOptions) => {
        sentMails.push(mailOptions);
        return { messageId: `<mock-msg-${Date.now()}@maanaksetu.gov.in>` };
      },
    };

    const mockApplication = {
      _id: new mongoose.Types.ObjectId(),
      applicationNumber: "APP-DL-2026-0001",
      verificationDetails: {
        verificationDate: new Date("2026-10-10"),
        outcome: "PASS",
      },
    };

    const mockCertificate = {
      _id: new mongoose.Types.ObjectId(),
      certificateNumber: "CERT-DL-2026-9999",
      issueDate: new Date("2026-10-10"),
      validUntil: new Date("2028-10-09"),
      status: "ACTIVE",
    };

    const mockInstrument = {
      _id: new mongoose.Types.ObjectId(),
      serialNumber: "WM-12345",
      category: "WEIGHING_SCALE",
    };

    const mockShop = {
      _id: new mongoose.Types.ObjectId(),
      shopName: "Sharma Supermarket",
      owner: {
        _id: new mongoose.Types.ObjectId(),
        name: "Rajesh Sharma",
        email: "rajesh.sharma@example.com",
      },
    };

    const emailResult = await sendVerificationSuccessEmail({
      application: mockApplication,
      certificate: mockCertificate,
      instrument: mockInstrument,
      shop: mockShop,
      transporterOverride: testTransporter,
    });

    assert(emailResult.success === true, "Email sending returned success: true");
    assert(sentMails.length === 1, "Exactly one email dispatched");
    assert(sentMails[0].to === "rajesh.sharma@example.com", "Sent to correct shop owner email");
    assert(sentMails[0].subject === "Verification Successful - WM-12345", "Subject matches requirement");
    assert(sentMails[0].text.includes("Rajesh Sharma"), "Text body greets shop owner by name");
    assert(sentMails[0].text.includes("WM-12345"), "Text body contains instrument machine number");
    assert(sentMails[0].text.includes("CERT-DL-2026-9999"), "Text body contains certificate number");
    assert(sentMails[0].text.includes("WEIGHING_SCALE"), "Text body contains instrument type");
    assert(sentMails[0].html.includes("Sharma Supermarket") || sentMails[0].html.includes("WM-12345"), "HTML contains details");

    // ----------------------------------------------------
    // TEST 4: Certificate Attachment Handling
    // ----------------------------------------------------
    logStep(4, "Certificate Attachment Handling");
    const certDir = path.resolve(process.cwd(), "uploads", "certificates");
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }
    const dummyPdfPath = path.join(certDir, `${mockCertificate.certificateNumber}.pdf`);
    fs.writeFileSync(dummyPdfPath, "%PDF-1.4 test certificate content");

    sentMails = [];
    const attachResult = await sendVerificationSuccessEmail({
      application: mockApplication,
      certificate: mockCertificate,
      instrument: mockInstrument,
      shop: mockShop,
      transporterOverride: testTransporter,
    });

    assert(attachResult.success === true, "Email sent with attachment");
    assert(sentMails[0].attachments.length === 1, "Email has 1 attachment");
    assert(
      sentMails[0].attachments[0].filename === "Verification_Certificate_WM-12345.pdf",
      "Attachment named Verification_Certificate_WM-12345.pdf"
    );
    assert(sentMails[0].attachments[0].contentType === "application/pdf", "Content type is application/pdf");
    assert(fs.existsSync(sentMails[0].attachments[0].path), "Attachment points to existing file on disk");

    // Cleanup dummy file
    if (fs.existsSync(dummyPdfPath)) {
      fs.unlinkSync(dummyPdfPath);
    }

    // ----------------------------------------------------
    // TEST 5: Missing Recipient Email Handling
    // ----------------------------------------------------
    logStep(5, "Missing Recipient Email Handling");
    const mockShopNoEmail = {
      _id: new mongoose.Types.ObjectId(),
      shopName: "Store Without Email",
      owner: {
        _id: new mongoose.Types.ObjectId(),
        name: "No Email User",
        email: "",
      },
    };

    sentMails = [];
    const missingEmailResult = await sendVerificationSuccessEmail({
      application: { ...mockApplication, applicant: null },
      certificate: mockCertificate,
      instrument: mockInstrument,
      shop: mockShopNoEmail,
      transporterOverride: testTransporter,
    });

    assert(missingEmailResult.success === false, "Returns success: false for missing email");
    assert(missingEmailResult.reason === "MISSING_RECIPIENT_EMAIL", "Reason is MISSING_RECIPIENT_EMAIL");
    assert(sentMails.length === 0, "No email was sent");

    // ----------------------------------------------------
    // TEST 6: SMTP Failure (Does Not Throw / Does Not Fail Verification)
    // ----------------------------------------------------
    logStep(6, "SMTP Failure Error Handling");
    const failingTransporter = {
      verify: async () => true,
      sendMail: async () => {
        throw new Error("SMTP server response: 421 4.7.0 Try again later, closing transmission channel");
      },
    };

    const smtpFailResult = await sendVerificationSuccessEmail({
      application: mockApplication,
      certificate: mockCertificate,
      instrument: mockInstrument,
      shop: mockShop,
      transporterOverride: failingTransporter,
    });

    assert(smtpFailResult.success === false, "Returns success: false when SMTP fails");
    assert(smtpFailResult.status === "FAILED", "Status indicates FAILED");
    assert(smtpFailResult.error.includes("421"), "Error message captured properly without throwing");

    // ----------------------------------------------------
    // TEST 7: Certificate Generation Failure Handling
    // ----------------------------------------------------
    logStep(7, "Certificate Generation Failure Handling");
    const noCertResult = await sendVerificationSuccessEmail({
      application: mockApplication,
      certificate: null,
      instrument: mockInstrument,
      shop: mockShop,
      transporterOverride: testTransporter,
    });

    assert(noCertResult.success === false, "Aborts email dispatch when certificate is null");
    assert(noCertResult.reason === "MISSING_CERTIFICATE", "Reason is MISSING_CERTIFICATE");

    // ----------------------------------------------------
    // TEST 8: Recipient Resolution Chain (Instrument -> Shop -> Owner -> Email)
    // ----------------------------------------------------
    logStep(8, "Recipient Resolution Chain Hierarchy");
    // Create DB documents to test real population chain
    const dbUser = await User.create({
      name: "Suresh Patel",
      email: "suresh.patel@gujarat-weigh.com",
      phone: "9876543299",
      password: "Password123!",
      aadhar_no: "112233445566",
      role: "USER",
    });

    const dbShop = await Shop.create({
      owner: dbUser._id,
      shopName: "Gujarat Weighing Solutions",
      licenseNumber: "LIC-GJ-2026-8888",
    });

    const dbInstrument = await Instrument.create({
      shop: dbShop._id,
      category: "WEIGHBRIDGE",
      serialNumber: "WB-AHM-2026-001",
      installationType: "FIXED",
    });

    const resolved = await resolveRecipient({
      instrument: dbInstrument,
      shop: dbShop,
    });

    assert(resolved !== null, "Recipient resolved successfully");
    assert(resolved.email === "suresh.patel@gujarat-weigh.com", "Resolved email matches shop owner");
    assert(resolved.name === "Suresh Patel", "Resolved name matches shop owner");

    // ----------------------------------------------------
    // TEST 9: Complete End-to-End Verification + Certificate + Email Flow
    // ----------------------------------------------------
    logStep(9, "Complete End-to-End Verification + Certificate + Email Flow");
    sentMails = [];
    setTransporter(testTransporter);

    const officer = await User.create({
      name: "Inspector Anita Roy",
      email: "anita.roy@gov.in",
      phone: "9811223300",
      password: "OfficerPass123!",
      aadhar_no: "998877665500",
      role: "OFFICER",
    });

    const dbApp = await Application.create({
      applicationNumber: "APP-WB-2026-7777",
      applicant: dbUser._id,
      shop: dbShop._id,
      instrument: dbInstrument._id,
      applicationType: "FRESH",
      status: "VERIFIED",
      verificationDetails: {
        verificationDate: new Date(),
        outcome: "PASS",
        officer: officer._id,
        stampCode: "LM-GJ-26-999",
      },
    });

    const issuedCert = await issueCertificateForApplication(dbApp._id, officer);

    assert(issuedCert !== null, "Certificate successfully issued by issueCertificateForApplication");
    assert(issuedCert.certificateNumber.startsWith("CERT-"), "Certificate number generated");
    assert(issuedCert.status === "ACTIVE", "Certificate status is ACTIVE");

    const updatedApp = await Application.findById(dbApp._id);
    assert(updatedApp.status === "COMPLETED", "Application transitioned to COMPLETED");

    const updatedInst = await Instrument.findById(dbInstrument._id);
    assert(updatedInst.status === "VERIFIED", "Instrument status updated to VERIFIED");

    assert(sentMails.length >= 1, "Verification email was dispatched via transporter");
    const sentEmail = sentMails[sentMails.length - 1];
    assert(sentEmail.to === "suresh.patel@gujarat-weigh.com", "Dispatched to shop owner email");
    assert(
      sentEmail.subject.includes("WB-AHM-2026-001"),
      `Email subject includes machine number: ${sentEmail.subject}`
    );
    assert(
      sentEmail.attachments.length === 1,
      "Dispatched email includes the newly generated certificate PDF as attachment"
    );
    assert(
      sentEmail.attachments[0].filename === "Verification_Certificate_WB-AHM-2026-001.pdf",
      `Attachment name matches convention: ${sentEmail.attachments[0].filename}`
    );

    console.log("\n==================================================");
    console.log("ALL EMAIL NOTIFICATION TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err);
    process.exitCode = 1;
  } finally {
    resetTransporter();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
}

runTests();
