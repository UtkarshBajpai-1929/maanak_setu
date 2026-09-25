import crypto from "crypto";

const getFormattedDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

export const generateApplicationNumber = () => {
  const dateStr = getFormattedDate();
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `APP-${dateStr}-${randomSuffix}`;
};

export const generateCertificateNumber = () => {
  const dateStr = getFormattedDate();
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `CERT-${dateStr}-${randomSuffix}`;
};

export const generateStampCode = () => {
  const dateStr = getFormattedDate().slice(2);
  const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `LM-${dateStr}-${randomSuffix}`;
};
