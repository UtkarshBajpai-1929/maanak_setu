export const getValidityIntervalMonths = (category, options = {}) => {
  if (options.isStorageTank) {
    return 60;
  }

  switch (category) {
    case "TAPE_MEASURE":
      return 24;

    case "WEIGHING_SCALE":
      return 24;

    case "TANK_LORRY":
      return 12;

    case "WEIGHBRIDGE":
    case "WATER_METER":
    case "FUEL_DISPENSER":
    case "LOAD_CELL":
    case "GAS_METER":
    case "ENERGY_METER":
    case "FLOW_METER":
    case "SPEED_GUN":
    case "BREATH_ANALYZER":
    case "MOISTURE_METER":
    case "SPHYGMOMANOMETER":
    case "CLINICAL_THERMOMETER":
    case "OTHER":
    default:
      return 12;
  }
};

export const calculateCertificateDates = (instrumentCategory, fromDate = new Date(), options = {}) => {
  const validFrom = new Date(fromDate);
  const months = getValidityIntervalMonths(instrumentCategory, options);

  const validUntil = new Date(validFrom);
  validUntil.setMonth(validUntil.getMonth() + months);
  validUntil.setDate(validUntil.getDate() - 1);
  validUntil.setHours(23, 59, 59, 999);

  return {
    validFrom,
    validUntil,
    validityMonths: months,
  };
};
