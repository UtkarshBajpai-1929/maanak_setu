import ApiError from "../utils/apiError.js";

const VALID_TRANSITIONS = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["SCHEDULED", "REJECTED"],
  SCHEDULED: ["VERIFICATION_PENDING", "REJECTED"],
  VERIFICATION_PENDING: ["VERIFIED", "REJECTED"],
  VERIFIED: ["CERTIFICATE_ISSUED"],
  CERTIFICATE_ISSUED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

export const isValidTransition = (currentStatus, targetStatus) => {
  if (currentStatus === targetStatus) return true;
  const allowed = VALID_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(targetStatus));
};

export const validateTransition = (currentStatus, targetStatus) => {
  if (!isValidTransition(currentStatus, targetStatus)) {
    throw new ApiError(
      400,
      `Invalid application workflow transition from '${currentStatus}' to '${targetStatus}'. Allowed next states: [${(VALID_TRANSITIONS[currentStatus] || []).join(", ")}]`
    );
  }
};
