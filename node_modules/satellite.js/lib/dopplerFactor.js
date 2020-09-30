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
exports.default = dopplerFactor;

function dopplerFactor(location, position, velocity) {
  var currentRange = Math.sqrt(Math.pow(position.x - location.x, 2) + Math.pow(position.y - location.y, 2) + Math.pow(position.z - location.z, 2));
  var nextPos = {
    x: position.x + velocity.x,
    y: position.y + velocity.y,
    z: position.z + velocity.z
  };
  var nextRange = Math.sqrt(Math.pow(nextPos.x - location.x, 2) + Math.pow(nextPos.y - location.y, 2) + Math.pow(nextPos.z - location.z, 2));
  var rangeRate = nextRange - currentRange;

  function sign(value) {
    return value >= 0 ? 1 : -1;
  }

  rangeRate *= sign(rangeRate);
  var c = 299792.458; // Speed of light in km/s

  return 1 + rangeRate / c;
}