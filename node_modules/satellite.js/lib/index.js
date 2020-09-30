/*!
 * satellite-js v3.0.1
 * (c) 2013 Shashwat Kandadai and UCSC
 * https://github.com/shashwatak/satellite-js
 * License: MIT
 */

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "jday", {
  enumerable: true,
  get: function get() {
    return _ext.jday;
  }
});
Object.defineProperty(exports, "invjday", {
  enumerable: true,
  get: function get() {
    return _ext.invjday;
  }
});
Object.defineProperty(exports, "twoline2satrec", {
  enumerable: true,
  get: function get() {
    return _io.default;
  }
});
Object.defineProperty(exports, "propagate", {
  enumerable: true,
  get: function get() {
    return _propagation.propagate;
  }
});
Object.defineProperty(exports, "sgp4", {
  enumerable: true,
  get: function get() {
    return _propagation.sgp4;
  }
});
Object.defineProperty(exports, "gstime", {
  enumerable: true,
  get: function get() {
    return _propagation.gstime;
  }
});
Object.defineProperty(exports, "dopplerFactor", {
  enumerable: true,
  get: function get() {
    return _dopplerFactor.default;
  }
});
Object.defineProperty(exports, "radiansToDegrees", {
  enumerable: true,
  get: function get() {
    return _transforms.radiansToDegrees;
  }
});
Object.defineProperty(exports, "degreesToRadians", {
  enumerable: true,
  get: function get() {
    return _transforms.degreesToRadians;
  }
});
Object.defineProperty(exports, "degreesLat", {
  enumerable: true,
  get: function get() {
    return _transforms.degreesLat;
  }
});
Object.defineProperty(exports, "degreesLong", {
  enumerable: true,
  get: function get() {
    return _transforms.degreesLong;
  }
});
Object.defineProperty(exports, "radiansLat", {
  enumerable: true,
  get: function get() {
    return _transforms.radiansLat;
  }
});
Object.defineProperty(exports, "radiansLong", {
  enumerable: true,
  get: function get() {
    return _transforms.radiansLong;
  }
});
Object.defineProperty(exports, "geodeticToEcf", {
  enumerable: true,
  get: function get() {
    return _transforms.geodeticToEcf;
  }
});
Object.defineProperty(exports, "eciToGeodetic", {
  enumerable: true,
  get: function get() {
    return _transforms.eciToGeodetic;
  }
});
Object.defineProperty(exports, "eciToEcf", {
  enumerable: true,
  get: function get() {
    return _transforms.eciToEcf;
  }
});
Object.defineProperty(exports, "ecfToEci", {
  enumerable: true,
  get: function get() {
    return _transforms.ecfToEci;
  }
});
Object.defineProperty(exports, "ecfToLookAngles", {
  enumerable: true,
  get: function get() {
    return _transforms.ecfToLookAngles;
  }
});
exports.constants = void 0;

var constants = _interopRequireWildcard(require("./constants"));

exports.constants = constants;

var _ext = require("./ext");

var _io = _interopRequireDefault(require("./io"));

var _propagation = require("./propagation");

var _dopplerFactor = _interopRequireDefault(require("./dopplerFactor"));

var _transforms = require("./transforms");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }