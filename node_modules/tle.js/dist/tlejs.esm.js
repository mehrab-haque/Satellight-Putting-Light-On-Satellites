import { twoline2satrec, propagate, gstime, eciToEcf, eciToGeodetic, ecfToLookAngles, degreesLong, degreesLat } from 'satellite.js';

const _MS_IN_A_DAY = 86400000;
const _MS_IN_A_SECOND = 1000;
const _MS_IN_A_MINUTE = 60000; // Data formats for TLE orbital elements.

const _TLE_DATA_TYPES = {
  _INT: Symbol(),
  _FLOAT: Symbol(),
  _CHAR: Symbol(),
  _DECIMAL_ASSUMED: Symbol(),
  // 12345   -> 0.12345
  _DECIMAL_ASSUMED_E: Symbol() // 12345-2 -> 0.0012345

};
const _DATA_TYPES = {
  _ARRAY: "array",
  _STRING: "string",
  _OBJECT: "object",
  _DATE: "date",
  _NAN: "NaN"
};

/**
 * General helper that provides more useful info than JavaScript's built-in "typeof" operator.
 *
 * Example:
 * getType([]);
 * -> 'array'
 */

function getType(input) {
  const type = typeof input;

  if (Array.isArray(input)) {
    return _DATA_TYPES._ARRAY;
  }

  if (input instanceof Date) {
    return _DATA_TYPES._DATE;
  }

  if (Number.isNaN(input)) {
    return _DATA_TYPES._NAN;
  }

  return type;
}
/**
 * Determines if a number is positive.
 */

const _isPositive = num => num >= 0;
/**
 * Determines the amount of digits in a number.  Used for converting a TLE's "leading decimal
 * assumed" notation.
 *
 * Example:
 * getDigitCount(12345);
 * -> 5
 */

const _getDigitCount = num => {
  const absVal = Math.abs(num);
  return absVal.toString().length;
};
/**
 * Converts a TLE's "leading decimal assumed" notation to a float representation.
 *
 * Example:
 * toLeadingDecimal(12345);
 * -> 0.12345
 */

const _toLeadingDecimal = num => {
  const numDigits = _getDigitCount(num);

  const zeroes = "0".repeat(numDigits - 1);
  return parseFloat(num * `0.${zeroes}1`);
};
/**
 * Converts a TLE's "leading decimal assumed" notation with leading zeroes to a float
 * representation.
 *
 * Example:
 * decimalAssumedEToFloat('12345-4');
 * -> 0.000012345
 */

const _decimalAssumedEToFloat = str => {
  const numWithAssumedLeadingDecimal = str.substr(0, str.length - 2);

  const num = _toLeadingDecimal(numWithAssumedLeadingDecimal);

  const leadingDecimalPoints = parseInt(str.substr(str.length - 2, 2), 10);
  const float = num * Math.pow(10, leadingDecimalPoints);
  return parseFloat(float.toPrecision(5));
};
/**
 * Converts a fractional day of the year to a timestamp.  Used for parsing the TLE epoch.
 */

const _dayOfYearToTimeStamp = (dayOfYear, year = new Date().getFullYear()) => {
  const yearStart = new Date(`1/1/${year} 0:0:0 Z`);
  const yearStartMS = yearStart.getTime();
  return Math.floor(yearStartMS + (dayOfYear - 1) * _MS_IN_A_DAY);
};
/**
 * Converts radians (0 to 2π) to degrees (0 to 360).
 */

const _radiansToDegrees = radians => radians * (180 / Math.PI);
/**
 * Converts degrees (0 to 360) to radians (0 to 2π).
 */

const _degreesToRadians = degrees => degrees * (Math.PI / 180);
/**
 * Determines if a pair of longitude points crosses over the antemeridian, which is a
 * pain point for mapping software.
 */

const _crossesAntemeridian = (longitude1, longitude2) => {
  if (!longitude1 || !longitude2) return false;

  const isLong1Positive = _isPositive(longitude1);

  const isLong2Positive = _isPositive(longitude2);

  const haveSameSigns = isLong1Positive === isLong2Positive;
  if (haveSameSigns) return false; // Signs don't match, so check if we're reasonably near the antemeridian (just to be sure it's
  // not the prime meridian).

  const isNearAntemeridian = Math.abs(longitude1) > 100;
  return isNearAntemeridian;
};
/**
 * Note: TLEs have a year 2000 style problem in 2057, because they only represent years in 2
 * characters.  This function doesn't account for that problem.
 *
 * Example:
 * _getFullYear(98);
 * -> 1998
 *
 * @param {Number} twoDigitYear
 */

function _getFullYear(twoDigitYear) {
  const twoDigitYearInt = parseInt(twoDigitYear, 10);
  return twoDigitYearInt < 100 && twoDigitYearInt > 56 ? twoDigitYearInt + 1900 : twoDigitYearInt + 2000;
}
/**
 * Gets a piece of data directly from a TLE line string, and attempts to parse it based on
 * data format.
 *
 * @param {Object} parsedTLE
 * @param {(1|2)} lineNumber TLE line number.
 * @param {Object} definition From line-1-definitions or line-2-definitions.
 */

function getFromTLE(parsedTLE, lineNumber, definition) {
  const {
    name,
    tle
  } = parsedTLE;
  const line = lineNumber === 1 ? tle[0] : tle[1];
  const {
    start,
    length,
    type
  } = definition;
  const val = line.substr(start, length);
  let output;

  switch (type) {
    case _TLE_DATA_TYPES._INT:
      output = parseInt(val, 10);
      break;

    case _TLE_DATA_TYPES._FLOAT:
      output = parseFloat(val);
      break;

    case _TLE_DATA_TYPES._DECIMAL_ASSUMED:
      output = parseFloat(`0.${val}`);
      break;

    case _TLE_DATA_TYPES._DECIMAL_ASSUMED_E:
      output = _decimalAssumedEToFloat(val);
      break;

    case _TLE_DATA_TYPES._CHAR:
    default:
      output = val.trim();
      break;
  }

  return output;
}

const _ERRORS = {
  _TYPE: (context = "", expected = [], got = "") => `${context} must be of type [${expected.join(", ")}], but got ${got}.`,
  _NOT_PARSED_OBJECT: `Input object is malformed (should have name and tle properties).`
};
function isTLEObj(obj) {
  return typeof obj === _DATA_TYPES._OBJECT && obj.name && obj.tle && getType(obj.tle) === _DATA_TYPES._ARRAY && obj.tle.length === 2;
} // For TLE parsing memoization.

const tleCache = {};
/**
 * Converts string and array TLE formats into a "parsed" TLE in a consistent object format.
 * Accepts 2 and 3-line (with satellite name) TLE variants in string (\n-delimited) and array
 * forms.
 *
 * Example:
 * parseTLE(`ISS (ZARYA)
 * 1 25544U 98067A   19285.67257269  .00001247  00000-0  29690-4 0  9993
 * 2 25544  51.6439 138.6866 0007415 141.2524 326.3533 15.50194187193485`);
 * ->
 * {
 *   name: 'ISS (ZARYA)',
 *   tle: [
 *     '1 25544U 98067A   19285.67257269  .00001247  00000-0  29690-4 0  9993',
 *     '2 25544  51.6439 138.6866 0007415 141.2524 326.3533 15.50194187193485'
 *   ]
 * }
 */

const acceptedTLETypes = [_DATA_TYPES._ARRAY, _DATA_TYPES._STRING, _DATA_TYPES._OBJECT];
function parseTLE(sourceTLE) {
  const type = getType(sourceTLE);
  const output = {};
  let tleArray = [];
  const alreadyParsed = isTLEObj(sourceTLE);

  if (alreadyParsed) {
    // This TLE has already been parsed, so there's nothing left to do.
    return sourceTLE;
  }

  const isUnexpectedObject = !alreadyParsed && type === _DATA_TYPES._OBJECT;

  if (isUnexpectedObject) {
    // TLE is in an unexpected object format.
    throw new Error(_ERRORS._NOT_PARSED_OBJECT);
  } // Note: only strings and arrays will make it past this point.
  // Check if the TLE exists in the cache.


  const cacheKey = type === _DATA_TYPES._ARRAY ? sourceTLE[0] : sourceTLE;

  if (tleCache[cacheKey]) {
    return tleCache[cacheKey];
  }

  if (!acceptedTLETypes.includes(type)) {
    throw new Error(_ERRORS._TYPE("Source TLE", acceptedTLETypes, type));
  } // Convert to array.


  if (type === _DATA_TYPES._STRING) {
    tleArray = sourceTLE.split("\n");
  } else if (type === _DATA_TYPES._ARRAY) {
    // Already an array, so make a copy so we don't mutate the input.
    tleArray = Array.from(sourceTLE);
  } // 3-line variant: remove name from array for consistency.


  if (tleArray.length === 3) {
    const name = tleArray[0].trim();
    tleArray = tleArray.slice(1); // Preserve original name string for use in the getSatelliteName() getter.

    output.name = name;
  }

  output.tle = tleArray.map(line => line.trim()); // Update cache.

  tleCache[cacheKey] = output;
  return output;
}
/**
 * Determines the checksum for a single line of a TLE.
 *
 * Checksum = modulo 10 of sum of all numbers (including line number) + 1 for each negative
 * sign (-).  Everything else is ignored.
 */

function computeChecksum(tleLineStr) {
  const charArr = tleLineStr.split(""); // Remove trailing checksum.

  charArr.splice(charArr.length - 1, 1);

  if (charArr.length === 0) {
    throw new Error("Character array empty!", tleLineStr);
  }

  const checksum = charArr.reduce((sum, val) => {
    const parsedVal = parseInt(val, 10);
    const parsedSum = parseInt(sum, 10);

    if (Number.isInteger(parsedVal)) {
      return parsedSum + parsedVal;
    }

    if (val === "-") {
      return parsedSum + 1;
    }

    return parsedSum;
  });
  return checksum % 10;
}
function lineNumberIsValid(tleObj, lineNumber) {
  const {
    tle
  } = tleObj;
  return lineNumber === parseInt(tle[lineNumber - 1][0], 10);
}
function checksumIsValid(tleObj, lineNumber) {
  const {
    tle
  } = tleObj;
  const tleLine = tle[lineNumber - 1];
  const checksumInTLE = parseInt(tleLine[tleLine.length - 1], 10);
  const computedChecksum = computeChecksum(tle[lineNumber - 1]);
  return computedChecksum === checksumInTLE;
}
/**
 * Determines if a TLE is structurally valid.
 */

function isValidTLE(rawTLE) {
  let tleObj;

  try {
    tleObj = parseTLE(rawTLE);
  } catch (e) {
    return false;
  } // Line number checks.


  const line1NumberIsValid = lineNumberIsValid(tleObj, 1);
  const line2NumberIsValid = lineNumberIsValid(tleObj, 2);

  if (!line1NumberIsValid || !line2NumberIsValid) {
    return false;
  } // Checksums


  const line1ChecksumIsValid = checksumIsValid(tleObj, 1);
  const line2ChecksumIsValid = checksumIsValid(tleObj, 2);

  if (!line1ChecksumIsValid || !line2ChecksumIsValid) {
    return false;
  }

  return true;
}

/**
 * Two-Line Element Set (TLE) format definitions, Line 1
 * See https://en.wikipedia.org/wiki/Two-line_element_set and https://celestrak.com/columns/v04n03/
 */

/* TLE line number. Will always return 1 for valid TLEs. */

const lineNumber1 = {
  start: 0,
  length: 1,
  type: _TLE_DATA_TYPES._INT
};
/**
 * NORAD satellite catalog number (e.g. Sputnik's rocket was number 00001).
 * See https://en.wikipedia.org/wiki/Satellite_Catalog_Number
 *
 * Range: 0 to 99999
 * Example: 25544
 */

const catalogNumber1 = {
  start: 2,
  length: 5,
  type: _TLE_DATA_TYPES._INT
};
/**
 * Satellite classification.
 * 'U' = unclassified
 * 'C' = classified
 * 'S' = secret
 *
 * Example: 'U'
 */

const classification = {
  start: 7,
  length: 1,
  type: _TLE_DATA_TYPES._CHAR
};
/**
 * International Designator (COSPAR ID): Last 2 digits of launch year.
 * 57 to 99 = 1900s, 00-56 = 2000s
 * See https://en.wikipedia.org/wiki/International_Designator
 *
 * Range: 00 to 99
 * Example: 98
 */

const intDesignatorYear = {
  start: 9,
  length: 2,
  type: _TLE_DATA_TYPES._INT
};
/**
 * International Designator (COSPAR ID): Launch number of the year.
 * See https://en.wikipedia.org/wiki/International_Designator
 *
 * Range: 1 to 999
 * Example: 67
 */

const intDesignatorLaunchNumber = {
  start: 11,
  length: 3,
  type: _TLE_DATA_TYPES._INT
};
/**
 * International Designator  (COSPAR ID): Piece of the launch.
 * See https://en.wikipedia.org/wiki/International_Designator
 *
 * Range: A to ZZZ
 * Example: 'A'
 */

const intDesignatorPieceOfLaunch = {
  start: 14,
  length: 3,
  type: _TLE_DATA_TYPES._CHAR
};
/**
 * Year when the TLE was generated (TLE epoch), last two digits.
 *
 * Range: 00 to 99
 * Example: 17
 */

const epochYear = {
  start: 18,
  length: 2,
  type: _TLE_DATA_TYPES._INT
};
/**
 * Fractional day of the year when the TLE was generated (TLE epoch).
 *
 * Range: 1 to 365.99999999
 * Example: 206.18396726
 */

const epochDay = {
  start: 20,
  length: 12,
  type: _TLE_DATA_TYPES._FLOAT
};
/**
 * First Time Derivative of the Mean Motion divided by two.  Defines how mean motion changes
 * from day to day, so TLE propagators can still be used to make reasonable guesses when
 * times are distant from the original TLE epoch.
 *
 * Units: Orbits / day ^ 2
 * Example: 0.00001961
 */

const firstTimeDerivative = {
  start: 33,
  length: 11,
  type: _TLE_DATA_TYPES._FLOAT
};
/**
 * Second Time Derivative of Mean Motion divided by six (decimal point assumed). Measures rate
 * of change in the Mean Motion Dot so software can make reasonable guesses when times are
 * distant from the original TLE epoch.
 *
 * Usually zero, unless the satellite is manuevering or in a decaying orbit.
 *
 * Units: Orbits / day ^ 3.
 * Example: 0 ('00000-0' in the original TLE [= 0.00000 * 10 ^ 0])
 */

const secondTimeDerivative = {
  start: 44,
  length: 8,
  type: _TLE_DATA_TYPES._DECIMAL_ASSUMED_E
};
/**
 * BSTAR drag term (decimal point assumed).  Estimates the effects of
 * atmospheric drag on the satellite's motion.
 *
 * Units: EarthRadii ^ -1
 * Example: 0.000036771 ('36771-4' in the original TLE [= 0.36771 * 10 ^ -4])
 */

const bstarDrag = {
  start: 53,
  length: 8,
  type: _TLE_DATA_TYPES._DECIMAL_ASSUMED_E
};
/**
 * Private value - used by Air Force Space Command to reference the orbit model used to
 * generate the TLE.  Will always be seen as zero externally (e.g. by "us", unless you are
 * "them" - in which case, hello!).
 *
 * Example: 0
 */

const orbitModel = {
  start: 62,
  length: 1,
  type: _TLE_DATA_TYPES._INT
};
/**
 * TLE element set number, incremented for each new TLE generated. 999 seems to mean the TLE
 * has maxed out.
 *
 * Range: Technically 1 to 9999, though in practice the maximum number seems to be 999.
 * Example: 999
 */

const tleSetNumber = {
  start: 64,
  length: 4,
  type: _TLE_DATA_TYPES._INT
};
/*
 * TLE line 1 checksum (modulo 10), for verifying the integrity of this line of the TLE.
 *
 * Range: 0 to 9
 * Example: 3
 */

const checksum1 = {
  start: 68,
  length: 1,
  type: _TLE_DATA_TYPES._INT
};

/**
 * General helper to get a piece of data from the first line of a TLE.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Object} definition From `line-1-definitions.js`
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getFromLine1(tle, definition, isTLEParsed = false) {
  const parsedTLE = isTLEParsed ? tle : parseTLE(tle);
  return getFromTLE(parsedTLE, 1, definition);
}
/**
 * Returns the line number from line 1.  Should always return "1" for valid TLEs.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getLineNumber1(tle, isTLEParsed) {
  return getFromLine1(tle, lineNumber1, isTLEParsed);
}
/**
 * Returns the Space Catalog Number (aka NORAD Catalog Number).
 * See https://en.wikipedia.org/wiki/Satellite_Catalog_Number
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getCatalogNumber1(tle, isTLEParsed) {
  return getFromLine1(tle, catalogNumber1, isTLEParsed);
}
/**
 * Returns the satellite classification.  For example, an unclassified satellite will return `U`.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getClassification(tle, isTLEParsed) {
  return getFromLine1(tle, classification, isTLEParsed);
}
/**
 * Returns the launch year (last two digits), which makes up part of the COSPAR id
 * (international designator).  For example, a satellite launched in 1999 will return "99".
 * See https://en.wikipedia.org/wiki/International_Designator
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getIntDesignatorYear(tle, isTLEParsed) {
  return getFromLine1(tle, intDesignatorYear, isTLEParsed);
}
/**
 * Returns the launch number of the year, which makes up part of the COSPAR id
 * (international designator).  For example, the 50th launch of the year will return "50".
 * See https://en.wikipedia.org/wiki/International_Designator
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getIntDesignatorLaunchNumber(tle, isTLEParsed) {
  return getFromLine1(tle, intDesignatorLaunchNumber, isTLEParsed);
}
/**
 * Returns the piece of the launch, which makes up part of the COSPAR id (international designator).
 * For example, the first piece of the launch will return "A".
 * See https://en.wikipedia.org/wiki/International_Designator
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getIntDesignatorPieceOfLaunch(tle, isTLEParsed) {
  return getFromLine1(tle, intDesignatorPieceOfLaunch, isTLEParsed);
}
/**
 * Returns the TLE epoch year (last two digits) when the TLE was generated.  For example, a TLE
 * generated in 2022 will return `22`.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getEpochYear(tle, isTLEParsed) {
  return getFromLine1(tle, epochYear, isTLEParsed);
}
/**
 * Returns the TLE epoch day of the year (day of year with fractional portion of the day) when the
 * TLE was generated.  For example, a TLE generated on January 1 will return something like
 * `1.18396726`.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getEpochDay(tle, isTLEParsed) {
  return getFromLine1(tle, epochDay, isTLEParsed);
}
/**
 * First Time Derivative of the Mean Motion divided by two, measured in orbits per day per day
 * (orbits/day2). Defines how mean motion changes from day to day, so TLE propagators can still be
 * used to make reasonable guesses when distant from the original TLE epoch.
 * See https://en.wikipedia.org/wiki/Mean_Motion
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getFirstTimeDerivative(tle, isTLEParsed) {
  return getFromLine1(tle, firstTimeDerivative, isTLEParsed);
}
/**
 * Second Time Derivative of Mean Motion divided by six, measured in orbits per day per day per day
 * (orbits/day3). Similar to the first time derivative, it measures rate of change in the Mean
 * Motion Dot so software can make reasonable guesses when distant from the original TLE epoch.
 * See https://en.wikipedia.org/wiki/Mean_Motion and http://castor2.ca/03_Mechanics/03_TLE/Mean_Mot_Dot.html
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getSecondTimeDerivative(tle, isTLEParsed) {
  return getFromLine1(tle, secondTimeDerivative, isTLEParsed);
}
/**
 * BSTAR drag term. This estimates the effects of atmospheric drag on the satellite's motion.
 * See https://en.wikipedia.org/wiki/BSTAR
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getBstarDrag(tle, isTLEParsed) {
  return getFromLine1(tle, bstarDrag, isTLEParsed);
}
/**
 * Private value - used by Air Force Space Command to reference the orbit model used to generate the
 * TLE (e.g. SGP, SGP4).  Distributed TLES will always return `0` for this value.  Note that all
 * distributed TLEs are generated with SGP4/SDP4.
 * See https://celestrak.com/columns/v04n03/
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getOrbitModel(tle, isTLEParsed) {
  return getFromLine1(tle, orbitModel, isTLEParsed);
}
/**
 * TLE element set number, incremented for each new TLE generated since launch. 999 seems to mean
 * the TLE has maxed out.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getTleSetNumber(tle, isTLEParsed) {
  return getFromLine1(tle, tleSetNumber, isTLEParsed);
}
/**
 * TLE line 1 checksum (modulo 10), for verifying the integrity of this line of the TLE. Note that
 * letters, blanks, periods, and plus signs are counted as 0, while minus signs are counted as 1.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getChecksum1(tle, isTLEParsed) {
  return getFromLine1(tle, checksum1, isTLEParsed);
}

/**
 * Two-Line Element Set (TLE) format definitions, Line 2
 * See https://en.wikipedia.org/wiki/Two-line_element_set and https://celestrak.com/columns/v04n03/
 */

/* TLE line number. Will always return 2 for valid TLEs. */

const lineNumber2 = {
  start: 0,
  length: 1,
  type: _TLE_DATA_TYPES._INT
};
/**
 * NORAD satellite catalog number (Sputnik's rocket was 00001).  Should match the satellite
 * number on line 1.
 *
 * Range: 0 to 99999
 * Example: 25544
 */

const catalogNumber2 = {
  start: 2,
  length: 5,
  type: _TLE_DATA_TYPES._INT
};
/**
 * Inclination relative to the Earth's equatorial plane in degrees. 0 to 90 degrees is a
 * prograde orbit and 90 to 180 degrees is a retrograde orbit.
 *
 * Units: degrees
 * Range: 0 to 180
 * Example: 51.6400
 */

const inclination = {
  start: 8,
  length: 8,
  type: _TLE_DATA_TYPES._FLOAT
};
/**
 * Right ascension of the ascending node in degrees. Essentially, this is the angle of the
 * satellite as it crosses northward (ascending) across the Earth's equator (equatorial
 * plane).
 *
 * Units: degrees
 * Range: 0 to 359.9999
 * Example: 208.9163
 */

const rightAscension = {
  start: 17,
  length: 8,
  type: _TLE_DATA_TYPES._FLOAT
};
/**
 * Orbital eccentricity, decimal point assumed. All artifical Earth satellites have an
 * eccentricity between 0 (perfect circle) and 1 (parabolic orbit).
 *
 * Range: 0 to 1
 * Example: 0.0006317 (`0006317` in the original TLE)
 */

const eccentricity = {
  start: 26,
  length: 7,
  type: _TLE_DATA_TYPES._DECIMAL_ASSUMED
};
/**
 * Argument of perigee. See https://en.wikipedia.org/wiki/Argument_of_perigee
 * Units: degrees
 * Range: 0 to 359.9999
 * Example: 69.9862
 */

const perigee = {
  start: 34,
  length: 8,
  type: _TLE_DATA_TYPES._FLOAT
};
/**
 * Mean anomaly. Indicates where the satellite was located within its orbit at the time of the
 * TLE epoch.
 * See https://en.wikipedia.org/wiki/Mean_Anomaly
 *
 * Units: degrees
 * Range: 0 to 359.9999
 * Example: 25.2906
 */

const meanAnomaly = {
  start: 43,
  length: 8,
  type: _TLE_DATA_TYPES._FLOAT
};
/**
 * Revolutions around the Earth per day (mean motion).
 * See https://en.wikipedia.org/wiki/Mean_Motion
 *
 * Range: 0 to 17 (theoretically)
 * Example: 15.54225995
 */

const meanMotion = {
  start: 52,
  length: 11,
  type: _TLE_DATA_TYPES._FLOAT
};
/**
 * Total satellite revolutions when this TLE was generated. This number seems to roll over
 * (e.g. 99999 -> 0).
 *
 * Range: 0 to 99999
 * Example: 6766
 */

const revNumberAtEpoch = {
  start: 63,
  length: 5,
  type: _TLE_DATA_TYPES._INT
};
/*
 * TLE line 2 checksum (modulo 10), for verifying the integrity of this line of the TLE.
 *
 * Range: 0 to 9
 * Example: 0
 */

const checksum2 = {
  start: 68,
  length: 1,
  type: _TLE_DATA_TYPES._INT
};

/**
 * General helper to get a piece of data from the second line of a TLE.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Object} definition From `line-1-definitions.js`
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getFromLine2(tle, definition, isTLEParsed = false) {
  const parsedTLE = isTLEParsed ? tle : parseTLE(tle);
  return getFromTLE(parsedTLE, 2, definition);
}
/**
 * Returns the line number from line 2.  Should always return "2" for valid TLEs.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getLineNumber2(tle, isTLEParsed) {
  return getFromLine2(tle, lineNumber2, isTLEParsed);
}
/**
 * Returns the line number from line 1.  Should always return "1" for valid TLEs.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getCatalogNumber2(tle, isTLEParsed) {
  return getFromLine2(tle, catalogNumber2, isTLEParsed);
}
/**
 * Returns the inclination relative to the Earth's equatorial plane in degrees. 0 to 90 degrees is a
 * prograde orbit and 90 to 180 degrees is a retrograde orbit.
 * See https://en.wikipedia.org/wiki/Orbital_inclination
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getInclination(tle, isTLEParsed) {
  return getFromLine2(tle, inclination, isTLEParsed);
}
/**
 * Returns the right ascension of the ascending node in degrees. Essentially, this is the angle of
 * the satellite as it crosses northward (ascending) across the Earth's equator (equatorial plane).
 * See https://en.wikipedia.org/wiki/Right_ascension_of_the_ascending_node
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getRightAscension(tle, isTLEParsed) {
  return getFromLine2(tle, rightAscension, isTLEParsed);
}
/**
 * Returns the orbital eccentricity. All artificial Earth satellites have an eccentricity between 0
 * (perfect circle) and 1 (parabolic orbit).
 * See https://en.wikipedia.org/wiki/Orbital_eccentricity
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getEccentricity(tle, isTLEParsed) {
  return getFromLine2(tle, eccentricity, isTLEParsed);
}
/**
 * Returns the argument of perigee.
 * See https://en.wikipedia.org/wiki/Argument_of_perigee
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getPerigee(tle, isTLEParsed) {
  return getFromLine2(tle, perigee, isTLEParsed);
}
/**
 * Returns the Mean Anomaly. Indicates where the satellite was located within its orbit at the time
 * of the TLE epoch.
 * See https://en.wikipedia.org/wiki/Mean_Anomaly
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getMeanAnomaly(tle, isTLEParsed) {
  return getFromLine2(tle, meanAnomaly, isTLEParsed);
}
/**
 * Returns the revolutions around the Earth per day (mean motion).
 * See https://en.wikipedia.org/wiki/Mean_Motion
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getMeanMotion(tle, isTLEParsed) {
  return getFromLine2(tle, meanMotion, isTLEParsed);
}
/**
 * Returns the total satellite revolutions when this TLE was generated. This number seems to roll
 * over (e.g. 99999 -> 0).
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getRevNumberAtEpoch(tle, isTLEParsed) {
  return getFromLine2(tle, revNumberAtEpoch, isTLEParsed);
}
/**
 * TLE line 2 checksum (modulo 10), for verifying the integrity of this line of the TLE. Note that
 * letters, blanks, periods, and plus signs are counted as 0, while minus signs are counted as 1.
 *
 * @param {String|Array} tle Two or three line TLE
 * @param {Boolean} isTLEParsed Skips TLE parsing when true.
 */

function getChecksum2(tle, isTLEParsed) {
  return getFromLine2(tle, checksum2, isTLEParsed);
}

/**
 * Determines COSPAR ID.
 * See https://en.wikipedia.org/wiki/International_Designator
 */

function getCOSPAR(tle, tleIsParsed) {
  const partialYear = getIntDesignatorYear(tle, tleIsParsed);

  const fullYear = _getFullYear(partialYear);

  const launchNum = getIntDesignatorLaunchNumber(tle, tleIsParsed);
  const launchNumWithPadding = launchNum.toString().padStart(3, 0);
  const launchPiece = getIntDesignatorPieceOfLaunch(tle, tleIsParsed);
  return `${fullYear}-${launchNumWithPadding}${launchPiece}`;
}
/**
 * Determines the name of a satellite, if present in the first line of a 3-line TLE.  If not found,
 * returns "Unknown" by default, or the COSPAR id when fallbackToCOSPAR is true.
 *
 * Example:
 * getSatelliteName(tleStr);
 * -> 'ISS (ZARYA)'
 *
 * @param {String|Array} rawTLE Input TLE.
 * @param {Boolean} fallbackToCOSPAR Returns COSPAR id when satellite name isn't found.
 */

function getSatelliteName(rawTLE, fallbackToCOSPAR = false) {
  const parsedTLE = parseTLE(rawTLE);
  const {
    name
  } = parsedTLE;

  if (fallbackToCOSPAR) {
    return name || getCOSPAR(parsedTLE, true);
  } else {
    return name || "Unknown";
  }
}
/**
 * Determines the Unix timestamp (in ms) of a TLE epoch (the time a TLE was generated).
 *
 * Example:
 * getEpochTimestamp(tleStr);
 * -> 1500956694771
 */

function getEpochTimestamp(rawTLE) {
  const epochDay = getEpochDay(rawTLE);
  const epochYear = getEpochYear(rawTLE);
  return _dayOfYearToTimeStamp(epochDay, epochYear);
}
/**
 * Determines the average amount of milliseconds in one orbit.
 */

function getAverageOrbitTimeMS(tle) {
  return parseInt(_MS_IN_A_DAY / getMeanMotion(tle), 10);
}
/**
 * Determines the average amount of minutes in one orbit.
 */

function getAverageOrbitTimeMins(tle) {
  return getAverageOrbitTimeMS(tle) / _MS_IN_A_MINUTE;
}
/**
 * Determines the average amount of seconds in one orbit.
 */

function getAverageOrbitTimeS(tle) {
  return getAverageOrbitTimeMS(tle) / _MS_IN_A_SECOND;
}

const _SAT_REC_ERRORS = {
  _DEFAULT: "Problematic TLE with unknown error.",
  1: "Mean elements, ecc >= 1.0 or ecc < -0.001 or a < 0.95 er",
  2: "Mean motion less than 0.0",
  3: "Pert elements, ecc < 0.0  or  ecc > 1.0",
  4: "Semi-latus rectum < 0.0",
  5: "Epoch elements are sub-orbital",
  6: "Satellite has decayed"
};
let cachedSatelliteInfo = {};
let cachedAntemeridianCrossings = {};
let cachedOrbitTracks = {};
let cachedVisibleSatellites = {
  slowMoving: {}
};
let cachedGroundTrack = {};
const caches = [cachedSatelliteInfo, cachedAntemeridianCrossings, cachedOrbitTracks, cachedVisibleSatellites, cachedGroundTrack];
function getCacheSizes() {
  return caches.map(cache => getObjLength);
}
/**
 * Provides a way to clear up memory for long-running apps.
 */

function clearCache() {
  cachedVisibleSatellites.slowMoving = [];
}
/**
	 * Determines satellite position and look angles from an earth observer.
	 *
	 * Example:
	 * const satInfo = getSatelliteInfo(
	 *   tleStr,          // Satellite TLE string or array (2 or 3 line variants).
	 *   1501039265000,   // Unix timestamp (ms)
	 *   34.243889,       // Observer latitude (degrees)
	 *   -116.911389,     // Observer longitude (degrees)
	 *   0                // Observer elevation (km)
	 * );
	 *
	 * ->
	 * {
	 *   // satellite compass heading from observer in degrees (0 = north, 180 = south)
	 *   azimuth: 294.5780478624994,
	 *
	 *   // satellite elevation from observer in degrees (90 is directly overhead)
	 *   elevation: 81.63903620330046,
	 *
	 *   // km distance from observer to spacecraft
	 *   range: 406.60211015810074,
	 *
	 *   // spacecraft altitude in km
	 *   height: 402.9082788620108,

	 *   // spacecraft latitude in degrees
	 *   lat: 34.45112876592785,

	 *   // spacecraft longitude in degrees
	 *   lng: -117.46176597710809,
	 *
	 *   // spacecraft velocity in km/s
	 *   velocity: 7.675627442183371
	 * }
	 */

function getSatelliteInfo(rawTLE, rawTimestamp, observerLat, observerLng, observerHeight) {
  const timestamp = rawTimestamp || Date.now();
  const {
    tle
  } = parseTLE(rawTLE);
  const defaultObserverPosition = {
    lat: 36.9613422,
    lng: -122.0308,
    height: 0.37
  };
  const obsLat = observerLat || defaultObserverPosition.lat;
  const obsLng = observerLng || defaultObserverPosition.lng;
  const obsHeight = observerHeight || defaultObserverPosition.height; // Memoization

  const cacheKey = `${tle[0]}-${timestamp}-${observerLat}-${observerLng}
-${observerHeight}`;

  if (cachedSatelliteInfo[cacheKey]) {
    return cachedSatelliteInfo[cacheKey];
  } // Initialize a satellite record


  const satrec = twoline2satrec(tle[0], tle[1]);

  if (satrec.error) {
    throw new Error(_SAT_REC_ERRORS[satrec.error] || _SAT_REC_ERRORS._DEFAULT);
  }

  const dateObj = new Date(timestamp); // Propagate SGP4.

  const positionAndVelocity = propagate(satrec, dateObj); // The position_velocity result is a key-value pair of ECI coordinates.
  // These are the base results from which all other coordinates are derived.

  const positionEci = positionAndVelocity.position;
  const velocityEci = positionAndVelocity.velocity; // Set the observer position (in radians).

  const observerGd = {
    latitude: _degreesToRadians(obsLat),
    longitude: _degreesToRadians(obsLng),
    height: obsHeight
  }; // Get GMST for some coordinate transforms.
  // http://en.wikipedia.org/wiki/Sidereal_time#Definition

  const gmst = gstime(dateObj); // Get ECF, Geodetic, Look Angles, and Doppler Factor.

  const positionEcf = eciToEcf(positionEci, gmst);
  const positionGd = eciToGeodetic(positionEci, gmst);
  const lookAngles = ecfToLookAngles(observerGd, positionEcf);
  const velocityKmS = Math.sqrt(Math.pow(velocityEci.x, 2) + Math.pow(velocityEci.y, 2) + Math.pow(velocityEci.z, 2)); // Azimuth: is simply the compass heading from the observer's position.

  const {
    azimuth,
    elevation,
    rangeSat
  } = lookAngles; // Geodetic coords are accessed via `longitude`, `latitude`, `height`.

  const {
    longitude,
    latitude,
    height
  } = positionGd;
  const output = {
    lng: degreesLong(longitude),
    lat: degreesLat(latitude),
    elevation: _radiansToDegrees(elevation),
    azimuth: _radiansToDegrees(azimuth),
    range: rangeSat,
    height,
    velocity: velocityKmS
  }; // Memoization

  cachedSatelliteInfo[cacheKey] = output;
  return output;
}
/**
 * Determines if the last antemeridian crossing has been cached.  If it has, the time (in ms)
 * is returned, otherwise it returns false.
 */

function getCachedLastAntemeridianCrossingTimeMS(tleObj, timeMS) {
  const {
    tle
  } = tleObj;
  const orbitLengthMS = getAverageOrbitTimeMins(tle) * 60 * 1000;
  const tleStr = tle[0].substr(0, 30);
  const cachedCrossingTimes = cachedAntemeridianCrossings[tleStr];
  if (!cachedCrossingTimes) return false;
  if (cachedCrossingTimes === -1) return cachedCrossingTimes;
  const cachedTime = cachedCrossingTimes.filter(val => {
    if (typeof val === "object" && val.tle === tle) return -1;
    const diff = timeMS - val;
    const isDiffPositive = diff > 0;
    const isWithinOrbit = isDiffPositive && diff < orbitLengthMS;
    return isWithinOrbit;
  });
  return cachedTime[0] || false;
}
/**
 * Determines the last time the satellite crossed the antemeridian.  For mapping convenience
 * and to avoid headaches, we want to avoid plotting ground tracks that cross the antemeridian.
 */

function getLastAntemeridianCrossingTimeMS(tle, timeMS) {
  const parsedTLE = parseTLE(tle);
  const {
    tle: tleArr
  } = parsedTLE;
  const cachedVal = getCachedLastAntemeridianCrossingTimeMS(parsedTLE, timeMS);

  if (cachedVal) {
    return cachedVal;
  }

  const time = timeMS || Date.now();
  let step = 1000 * 60 * 10;
  let curLngLat = [];
  let lastLngLat = [];
  let curTimeMS = time;
  let didCrossAntemeridian = false;
  let tries = 0;
  let isDone = false;
  const maxTries = 1000;

  while (!isDone) {
    curLngLat = getLngLat(tleArr, curTimeMS);
    const [curLng, curLat] = curLngLat;
    didCrossAntemeridian = _crossesAntemeridian(lastLngLat[0], curLng);

    if (didCrossAntemeridian) {
      // Back up a bit, then keep halving the step increment till we get close enough.
      curTimeMS += step;
      step = step > 20000 ? 20000 : step / 2;
    } else {
      curTimeMS -= step;
      lastLngLat = curLngLat;
    }

    isDone = step < 500 || tries >= maxTries;
    tries++;
  }

  const couldNotFindCrossing = tries - 1 === maxTries;
  const crossingTime = couldNotFindCrossing ? -1 : parseInt(curTimeMS, 10);
  const tleStr = tleArr[0];

  if (!cachedAntemeridianCrossings[tleStr]) {
    cachedAntemeridianCrossings[tleStr] = [];
  }

  if (couldNotFindCrossing) {
    cachedAntemeridianCrossings[tleStr] = -1;
  } else {
    cachedAntemeridianCrossings[tleStr].push(crossingTime);
  }

  return crossingTime;
}
/**
 * Determines current satellite position, or position at time of timestamp (optional).
 *
 * @param {Array|String} tle
 * @param {Number} optionalTimestamp Unix timestamp in milliseconds.
 */

function getLatLngObj(tle, optionalTimestamp = Date.now()) {
  const {
    lat,
    lng
  } = getSatelliteInfo(tle, optionalTimestamp);
  return {
    lat,
    lng
  };
}
/**
 * Determines current satellite position, or position at time of timestamp (optional).
 *
 * @param {Array|String} tle
 * @param {Number} optionalTimestamp Unix timestamp in milliseconds.
 */

function getLngLat(tle, optionalTimestamp = Date.now()) {
  const {
    lat,
    lng
  } = getSatelliteInfo(tle, optionalTimestamp);
  return [lng, lat];
}
/**
 * Determines the position of the satellite at the time the TLE was generated.
 *
 * @param {Array|String} tle
 */

function getLngLatAtEpoch(tle) {
  return getLngLat(tle, getEpochTimestamp(tle));
} // TODO: cache geosync and erroring satellites and don't recompute on next pass.

function getVisibleSatellites({
  observerLat,
  observerLng,
  observerHeight = 0,
  tles = [],
  elevationThreshold = 0,
  timestampMS = Date.now()
}) {
  return tles.reduce((visibleSats, tleArr, index) => {
    // Don't waste time reprocessing geosync.
    const cacheKey = tleArr[1];
    const cachedVal = cachedVisibleSatellites.slowMoving[cacheKey];

    if (cachedVal) {
      const {
        info
      } = cachedVal;
      const {
        elevation: cachedElevation
      } = info;
      return cachedElevation >= elevationThreshold ? visibleSats.concat(cachedVal) : visibleSats;
    }

    let info;

    try {
      info = getSatelliteInfo(tleArr, timestampMS, observerLat, observerLng, observerHeight);
    } catch (e) {
      // Don't worry about decayed sats, just move on.
      // TODO cache error
      return visibleSats;
    }

    const {
      elevation,
      velocity,
      range
    } = info;
    const isSlowMoving = velocity / range < 0.001;

    if (isSlowMoving) {
      cachedVisibleSatellites.slowMoving[cacheKey] = {
        tleArr,
        info
      };
    }

    return elevation >= elevationThreshold ? visibleSats.concat({
      tleArr,
      info
    }) : visibleSats;
  }, []);
}
function* getNextPosition(tleArr, startTimeMS, stepMS) {
  let curTimeMS = startTimeMS - stepMS;

  while (true) {
    curTimeMS += stepMS;
    yield {
      curTimeMS,
      lngLat: getLngLat(tleArr, curTimeMS)
    };
  }
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Generates an array of lng/lat pairs representing a ground track (orbit track), starting
 * from startTimeMS and continuing until just before crossing the antemeridian, which is considered the end
 * of the orbit for convenience.
 *
 * Consider pairing this with getLastAntemeridianCrossingTimeMS() to create a full orbit path (see usage
 * in getGroundTracks()).
 */

function getOrbitTrack({
  tle,
  startTimeMS = Date.now(),
  stepMS = 1000,
  sleepMS = 0,
  jobChunkSize = 1000,
  maxTimeMS = 6000000,
  isLngLatFormat = true
}) {
  return new Promise(async (resolve, reject) => {
    const {
      tle: tleArr
    } = parseTLE(tle);
    const startS = (startTimeMS / 1000).toFixed();
    const cacheKey = `${tleArr[0]}-${startS}-${stepMS}-${isLngLatFormat}`;

    if (cachedOrbitTracks[cacheKey]) {
      resolve(cachedOrbitTracks[cacheKey]);
      return;
    }

    const generator = getNextPosition(tleArr, startTimeMS, stepMS);
    let step = 0;
    let isDone = false;
    let coords = [];
    let lastLng;

    while (!isDone) {
      const {
        curTimeMS,
        lngLat
      } = generator.next().value;
      const [curLng, curLat] = lngLat;

      const doesCrossAntemeridian = _crossesAntemeridian(lastLng, curLng);

      const doesExceedTime = maxTimeMS && curTimeMS - startTimeMS > maxTimeMS;
      isDone = doesCrossAntemeridian || doesExceedTime;

      if (isLngLatFormat) {
        coords.push(lngLat);
      } else {
        coords.push([curLat, curLng]);
      }

      if (sleepMS && step % jobChunkSize === 0) {
        // Chunk is processed, so cool off a bit.
        await sleep(sleepMS);
      }

      lastLng = curLng;
      step++;
    }

    cachedOrbitTracks[cacheKey] = coords;
    resolve(coords);
  });
}
/**
 *
 */

function getOrbitTrackSync({
  tle,
  startTimeMS = Date.now(),
  stepMS = 1000,
  maxTimeMS = 6000000,
  isLngLatFormat = true
}) {
  const {
    tle: tleArr
  } = parseTLE(tle);
  const startS = (startTimeMS / 1000).toFixed();
  const cacheKey = `${tleArr[0]}-${startS}-${stepMS}-${isLngLatFormat}`;

  if (cachedOrbitTracks[cacheKey]) {
    return cachedOrbitTracks[cacheKey];
  }

  let isDone = false;
  let coords = [];
  let lastLng;
  let curTimeMS = startTimeMS;

  while (!isDone) {
    const curLngLat = getLngLat(tleArr, curTimeMS);
    const [curLng, curLat] = curLngLat;

    const doesCrossAntemeridian = _crossesAntemeridian(lastLng, curLng);

    const doesExceedTime = maxTimeMS && curTimeMS - startTimeMS > maxTimeMS;
    isDone = doesCrossAntemeridian || doesExceedTime;

    if (isLngLatFormat) {
      coords.push(curLngLat);
    } else {
      coords.push([curLat, curLng]);
    }

    lastLng = curLng;
    curTimeMS += stepMS;
  }

  cachedOrbitTracks[cacheKey] = coords;
  return coords;
}
/**
 * Calculates three orbit arrays of latitude/longitude pairs.
 * TODO: just calculate future orbits
 *
 * @param {Array|String} options.tle
 * @param {Number} startTimeMS Unix timestamp in milliseconds.
 * @param {Number} stepMS Time in milliseconds between points on the ground track.
 * @param {Boolean} isLngLatFormat Formats coords in [lng, lat] order when true, [lat, lng] when false.
 * 
 *
 * Example:
 * const threeOrbitsArr = await getGroundTracks({ tle: tleStr });
 * ->
 * [
 *   // previous orbit
 *   [
 *     [ 45.85524291891481, -179.93297540317567 ],
 *     ...
 *   ],
 *
 *   // current orbit
 *   [
 *     [ 51.26165992503701, -179.9398612198045 ],
 *     ...
 *   ],
 *
 *   // next orbit
 *   [
 *     [ 51.0273714070371, -179.9190165549038 ],
 *     ...
 *   ]
 * ]
 */

function getGroundTracks({
  tle,
  startTimeMS = Date.now(),
  stepMS = 1000,
  isLngLatFormat = true
}) {
  return new Promise(async (resolve, reject) => {
    const parsedTLE = parseTLE(tle);
    const orbitTimeMS = getAverageOrbitTimeMS(parsedTLE);
    const curOrbitStartMS = getLastAntemeridianCrossingTimeMS(parsedTLE, startTimeMS);
    const foundCrossing = curOrbitStartMS !== -1;

    if (!foundCrossing) {
      // Geosync or unusual orbit, so just return a partial orbit track.
      const partialGroundTrack = await getOrbitTrack({
        tle: parsedTLE,
        startTimeMS,
        stepMS: _MS_IN_A_MINUTE,
        maxTimeMS: _MS_IN_A_DAY / 4,
        isLngLatFormat
      });
      resolve([partialGroundTrack]);
      return;
    }

    const lastOrbitStartMS = getLastAntemeridianCrossingTimeMS(parsedTLE, // TODO: fix this magic math
    curOrbitStartMS - 10000);
    const nextOrbitStartMS = getLastAntemeridianCrossingTimeMS(parsedTLE, // TODO: fix this magic math
    curOrbitStartMS + orbitTimeMS + 1000 * 60 * 30);
    const groundTrackPromises = [getOrbitTrack({
      tle: parsedTLE,
      startTimeMS: lastOrbitStartMS,
      stepMS,
      isLngLatFormat
    }), getOrbitTrack({
      tle: parsedTLE,
      startTimeMS: curOrbitStartMS,
      stepMS,
      isLngLatFormat
    }), getOrbitTrack({
      tle: parsedTLE,
      startTimeMS: nextOrbitStartMS,
      stepMS,
      isLngLatFormat
    })];
    const threeOrbitTracks = await Promise.all(groundTrackPromises);
    resolve(threeOrbitTracks);
  });
}
/**
 * Calculates three orbit arrays of latitude/longitude pairs.
 *
 * Example:
 * const threeOrbitsArr = getGroundTrackSync({ tle: tleStr });
 * ->
 * [
 *   // previous orbit
 *   [
 *     [ 45.85524291891481, -179.93297540317567 ],
 *     ...
 *   ],
 *
 *   // current orbit
 *   [
 *     [ 51.26165992503701, -179.9398612198045 ],
 *     ...
 *   ],
 *
 *   // next orbit
 *   [
 *     [ 51.0273714070371, -179.9190165549038 ],
 *     ...
 *   ]
 * ]
 */

function getGroundTracksSync({
  tle,
  stepMS = 1000,
  optionalTimeMS = Date.now(),
  isLngLatFormat = true
}) {
  const parsedTLE = parseTLE(tle);
  const {
    tle: tleArr
  } = parsedTLE;
  const orbitTimeMS = getAverageOrbitTimeMS(tleArr);
  const curOrbitStartMS = getLastAntemeridianCrossingTimeMS(parsedTLE, optionalTimeMS);
  const foundCrossing = curOrbitStartMS !== -1;

  if (!foundCrossing) {
    // Geosync or unusual orbit, so just return a partial orbit track.
    const partialGroundTrack = getOrbitTrackSync({
      tle: parsedTLE,
      startTimeMS: timeMS,
      stepMS: _MS_IN_A_MINUTE,
      maxTimeMS: _MS_IN_A_DAY / 4
    });
    return partialGroundTrack;
  }

  const lastOrbitStartMS = getLastAntemeridianCrossingTimeMS(parsedTLE, curOrbitStartMS - 10000);
  const nextOrbitStartMS = getLastAntemeridianCrossingTimeMS(parsedTLE, curOrbitStartMS + orbitTimeMS + 1000 * 60 * 30);
  const orbitStartTimes = [lastOrbitStartMS, curOrbitStartMS, nextOrbitStartMS];
  const orbitLatLons = orbitStartTimes.map(orbitStartMS => {
    return getOrbitTrackSync({
      tle: parsedTLE,
      startTimeMS: orbitStartMS,
      stepMS,
      isLngLatFormat
    });
  });
  return orbitLatLons;
}
/**
 * Determes the compass bearing from the perspective of the satellite.  Useful for 3D / pitched
 * map perspectives.
 *
 * TODO: a bit buggy at extreme parts of orbits, where latitude hardly changes.
 */

function getSatBearing(tle, customTimeMS) {
  const parsedTLE = this.parseTLE(tle);
  const timeMS = customTimeMS || Date.now();
  const latLon1 = this.getLatLonArr(parsedTLE.arr, timeMS);
  const latLon2 = this.getLatLonArr(parsedTLE.arr, timeMS + 10000);

  const doesCrossAntemeridian = _crossesAntemeridian(latLon1[1], latLon2[1]);

  if (doesCrossAntemeridian) {
    // TODO: fix
    return {}; // return this.getSatBearing(tle, customTimeMS + 10000);
  }

  const lat1 = _degreesToRadians(latLon1[0]);

  const lat2 = _degreesToRadians(latLon2[0]);

  const lon1 = _degreesToRadians(latLon1[1]);

  const lon2 = _degreesToRadians(latLon2[1]);

  const NS = lat1 >= lat2 ? "S" : "N";
  const EW = lon1 >= lon2 ? "W" : "E";
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

  const degrees = _radiansToDegrees(Math.atan2(y, x));

  return {
    degrees,
    compass: `${NS}${EW}`
  };
}

export { clearCache, computeChecksum, getAverageOrbitTimeMS, getAverageOrbitTimeMins, getAverageOrbitTimeS, getBstarDrag, getCOSPAR, getCacheSizes, getCatalogNumber1 as getCatalogNumber, getCatalogNumber1, getCatalogNumber2, getChecksum1, getChecksum2, getClassification, getEccentricity, getEpochDay, getEpochTimestamp, getEpochYear, getFirstTimeDerivative, getGroundTracks, getGroundTracksSync, getInclination, getIntDesignatorLaunchNumber, getIntDesignatorPieceOfLaunch, getIntDesignatorYear, getLastAntemeridianCrossingTimeMS, getLatLngObj, getLineNumber1, getLineNumber2, getLngLatAtEpoch, getMeanAnomaly, getMeanMotion, getOrbitModel, getOrbitTrack, getOrbitTrackSync, getPerigee, getRevNumberAtEpoch, getRightAscension, getSatBearing, getSatelliteInfo, getSatelliteName, getSecondTimeDerivative, getTleSetNumber, getVisibleSatellites, isValidTLE, parseTLE };
