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
exports.default = void 0;

var constants = _interopRequireWildcard(require("./constants"));

var _ext = require("./ext");

var _io = _interopRequireDefault(require("./io"));

var _propagation = require("./propagation");

var _dopplerFactor = _interopRequireDefault(require("./dopplerFactor"));

var _transforms = require("./transforms");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

var _default = {
  constants: constants,
  // Propagation
  propagate: _propagation.propagate,
  sgp4: _propagation.sgp4,
  twoline2satrec: _io.default,
  gstime: _propagation.gstime,
  jday: _ext.jday,
  invjday: _ext.invjday,
  dopplerFactor: _dopplerFactor.default,
  // Coordinate transforms
  radiansToDegrees: _transforms.radiansToDegrees,
  degreesToRadians: _transforms.degreesToRadians,
  degreesLat: _transforms.degreesLat,
  degreesLong: _transforms.degreesLong,
  radiansLat: _transforms.radiansLat,
  radiansLong: _transforms.radiansLong,
  geodeticToEcf: _transforms.geodeticToEcf,
  eciToGeodetic: _transforms.eciToGeodetic,
  eciToEcf: _transforms.eciToEcf,
  ecfToEci: _transforms.ecfToEci,
  ecfToLookAngles: _transforms.ecfToLookAngles
};
exports.default = _default;