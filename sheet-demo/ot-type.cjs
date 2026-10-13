'use strict';
const { SheetOTType } = require('@bzl/sheet-ottype');
// ShareDB requires a URI in snapshots and create messages. Keep the package algorithms.
exports.SheetOTType = { ...SheetOTType, uri: 'urn:bzl:sheet-ot-type:0.0.60' };
