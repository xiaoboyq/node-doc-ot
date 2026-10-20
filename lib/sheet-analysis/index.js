'use strict';

const { detectRegions, validateMerges, buildHeaderTree } = require('./structure');

// Coordinates everywhere (including merge/range options): [left, top, right, bottom], inclusive.
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const empty = value => value == null || typeof value === 'string' && value.trim() === '';
const label = value => (empty(value) ? '' : String(value).trim());
function richText(nodes) {
  return nodes.map(node => (typeof node.text === 'string' ? node.text :
    Array.isArray(node.children) ? richText(node.children) : '')).join('');
}
function readValue(cell) {
  if (cell && typeof cell === 'object' && !(cell instanceof Date)) {
    if (cell.formula || cell.type === 'formula') {
      return own(cell, 'result') ? cell.result : null; // Never execute formula text.
    }
    if (cell.type === 'image') return null;
    const value = own(cell, 'value') ? cell.value : own(cell, 'v') ? cell.v : null;
    return Array.isArray(value) ? richText(value) : value;
  }
  return cell;
}
function valueType(value) {
  if (empty(value)) return 'empty';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'invalid' : 'date';
  if (typeof value === 'number') return Number.isFinite(value) ? 'number' : 'invalid';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value !== 'string') return 'unsupported';
  // Do not convert identifiers, percentages, currencies or date-looking text implicitly.
  return 'text';
}
function rangeCheck(range) {
  if (!Array.isArray(range) || range.length !== 4 ||
    range.some(n => !Number.isSafeInteger(n) || n < 0) || range[0] > range[2] || range[1] > range[3]) {
    throw new TypeError('Range must be finite inclusive [left, top, right, bottom]');
  }
  return range;
}
function normalize(input, options) {
  const matrix = Array.isArray(input) ? input : input && Array.isArray(input.data) ? input.data : null;
  const sparse = !matrix && input && (input.data || input);
  if (!matrix && (!sparse || !Array.isArray(sparse.rows))) throw new TypeError('Expected matrix or Sheet snapshot');
  const rows = new Map();
  const warnings = new Set();
  const styles = new Map();
  function put(r, c, cell) {
    if (!Number.isSafeInteger(r) || !Number.isSafeInteger(c) || r < 0 || c < 0) throw new TypeError('Invalid cell coordinates');
    const value = (options.getValue || readValue)(cell, r, c);
    if (cell && (cell.formula || cell.type === 'formula') && empty(value)) warnings.add('FORMULA_RESULT_MISSING');
    if (valueType(value) === 'unsupported' || valueType(value) === 'invalid') warnings.add('UNSUPPORTED_CELL_VALUE');
    if (!empty(value)) {
      if (!rows.has(r)) rows.set(r, new Map());
      if (rows.get(r).has(c)) throw new TypeError('Duplicate sparse cell');
      rows.get(r).set(c, value);
    }
    if (cell && cell.style) styles.set(r + ':' + c, cell.style);
  }
  if (matrix) {
    matrix.forEach((row, r) => {
      if (row == null) return;
      if (!Array.isArray(row)) throw new TypeError('Matrix rows must be arrays');
      row.forEach((cell, c) => put(r, c, cell));
    });
  } else sparse.rows.forEach(row => (row.children || []).forEach(cell => put(row.index, cell.index, cell.meta)));
  const config = !Array.isArray(input) && input.config || {};
  // Project styles can have row/column defaults. Use explicit cells here; caller may resolve inheritance via getStyle.
  if (config.style) {
    (config.style.rows || []).forEach(row => (row.children || []).forEach(cell => {
      styles.set(row.index + ':' + cell.index, cell.meta || {});
    }));
  }
  const merges = (options.merges || Object.values(config.merge || {})).map(range => rangeCheck(range).slice());
  if (!matrix && ((sparse.cols || []).some(col => col.meta != null) || sparse.rows.some(row => row.meta != null))) {
    warnings.add('SPARSE_DEFAULT_VALUES_NOT_EXPANDED');
  }
  const get = (r, c) => (rows.has(r) ? rows.get(r).get(c) : undefined);
  const style = options.getStyle || ((r, c) => styles.get(r + ':' + c) || {});
  const rowIds = Array.from(rows.keys()).sort((a, b) => a - b);
  return { rows, rowIds, get, style, merges, warnings };
}
const headerWords = /^(姓名|名称|部门|日期|时间|编号|序号|产品|商品|地区|城市|数量|单价|金额|销售额|收入|支出|备注|状态|年龄|岗位|name|id|date|department|quantity|price|amount|status|region|product)$/i;
const summaryWords = /^(合计|总计|小计|汇总|total|subtotal|grand total)([:：\s]|$)/i;
function analyzeRegion(source, spec, options) {
  const range = rangeCheck(Array.isArray(spec) ? spec : spec.range).slice();
  const [ left, top, right, bottom ] = range;
  if (right - left + 1 > options.maxColumns) throw new RangeError('Region exceeds maxColumns; supply narrower regions');
  const rowIds = source.rowIds.filter(r => r >= top && r <= bottom &&
    Array.from(source.rows.get(r).keys()).some(c => c >= left && c <= right));
  const width = right - left + 1;
  const cells = r => Array.from({ length: width }, (_, i) => source.get(r, left + i));
  const reasons = [];
  const warnings = [];
  const titleRows = [];
  let start = rowIds[0];
  let headerRows = [];
  let confidence = 0;
  const explicit = !Array.isArray(spec) && own(spec, 'headerRows');
  if (explicit) {
    if (!Array.isArray(spec.headerRows) || spec.headerRows.some((r, i, a) =>
      !Number.isInteger(r) || r < top || r > bottom || i && r !== a[i - 1] + 1)) {
      throw new TypeError('headerRows must be contiguous absolute row indices inside range');
    }
    headerRows = spec.headerRows.slice();
    confidence = 1;
    reasons.push('EXPLICIT_HEADER_ROWS');
  } else if (start != null) {
    // Only strip a title with a full-width merge; a lone value could be real data.
    const isTitle = row => rowIds.some(id => id > row) && width > 1 &&
      source.merges.some(m => m[0] === left && m[2] === right && m[1] === row && m[3] === row) &&
      cells(row).filter(v => !empty(v)).length === 1;
    const nextRow = current => rowIds.find(row => row > current);
    while (isTitle(start)) {
      titleRows.push(start);
      start = nextRow(start);
    }
    const first = cells(start);
    const below = rowIds.filter(r => r > start).slice(0, options.sampleRows);
    const filled = first.filter(v => !empty(v));
    const textRatio = filled.length ? filled.filter(v => valueType(v) === 'text').length / filled.length : 0;
    const lexical = filled.filter(v => headerWords.test(label(v))).length;
    const contrast = first.some((v, i) => valueType(v) === 'text' && below.length &&
      below.filter(r => [ 'number', 'boolean', 'date' ].includes(valueType(source.get(r, left + i)))).length / below.length >= 0.6);
    const styled = first.filter((v, i) => !empty(v) && source.style(start, left + i).bold &&
      below.some(r => !source.style(r, left + i).bold)).length >= Math.ceil(width / 2);
    const headerMerges = source.merges.filter(m => m[1] === start && m[0] >= left && m[2] <= right &&
      m[3] < bottom && (m[2] > m[0] || m[3] > m[1]));
    if (textRatio >= 0.6 && below.length) {
      if (contrast) { confidence += 0.65; reasons.push('TEXT_TO_TYPED_DATA'); }
      if (lexical) { confidence += Math.min(0.65, lexical * 0.35); reasons.push('HEADER_VOCABULARY'); }
      if (styled) { confidence += 0.45; reasons.push('BOLD_STYLE_TRANSITION'); }
      if (headerMerges.length) { confidence += 0.65; reasons.push('MERGED_HEADER_STRUCTURE'); }
      if (confidence >= 0.6) {
        let end = start;
        // Expand only through connected merge bands, never guess an unmerged multi-row header.
        for (let r = start; r <= end && r < start + options.maxHeaderRows; r++) {
          for (const m of source.merges) {
            if (m[1] === r && m[0] >= left && m[2] <= right) {
              end = Math.max(end, m[3], m[2] > m[0] ? m[3] + 1 : m[3]);
            }
          }
        }
        if (end >= start + options.maxHeaderRows || end >= bottom) warnings.push('HEADER_DEPTH_UNCERTAIN');
        end = Math.min(end, start + options.maxHeaderRows - 1, bottom - 1);
        headerRows = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }
    confidence = Math.min(0.95, confidence);
  }
  if (!rowIds.length) warnings.push('EMPTY_REGION');
  if (!explicit && !headerRows.length) warnings.push('HEADER_UNCERTAIN');
  if (titleRows.length) reasons.push('FULL_WIDTH_MERGED_TITLE');
  const headerValue = (r, c) => {
    const merge = source.merges.find(m => c >= m[0] && c <= m[2] && r >= m[1] && r <= m[3]);
    return merge ? source.get(merge[1], merge[0]) : source.get(r, c);
  };
  const structure = buildHeaderTree(source, range, headerRows);
  warnings.push(...structure.warnings);
  const columns = Array.from({ length: width }, (_, i) => {
    const c = left + i;
    const path = structure.paths[i] || [];
    return { index: c, key: 'c' + c, name: path.join(' / ') || 'column_' + (c + 1), path };
  });
  const bodyStart = headerRows.length ? headerRows[headerRows.length - 1] + 1 : start;
  const summaryRows = [],
    repeatedHeaderRows = [],
    internalHeaderRows = [],
    dataRows = [];
  const repeated = new Set();
  rowIds.filter(r => r >= bodyStart).forEach(r => {
    if (repeated.has(r)) return;
    const values = cells(r);
    const matchesHeader = headerRows.length > 0 && r + headerRows.length - 1 <= bottom &&
      headerRows.every((hr, offset) => cells(hr).every((v, i) =>
        label(headerValue(hr, left + i)) === label(headerValue(r + offset, left + i))));
    if (matchesHeader) {
      headerRows.forEach((hr, offset) => { repeated.add(r + offset); repeatedHeaderRows.push(r + offset); });
    } else if (summaryWords.test(label(values.find(v => !empty(v)))) && values.some(v => valueType(v) === 'number')) {
      summaryRows.push(r);
    } else {
      if (!explicit && values.filter(v => headerWords.test(label(v))).length >= 2) internalHeaderRows.push(r);
      dataRows.push(r);
    }
  });
  if (internalHeaderRows.length) warnings.push('POSSIBLE_INTERNAL_HEADER');
  if (summaryRows.length) warnings.push('SUMMARY_ROWS_REQUIRE_REVIEW');
  if (source.merges.some(m => m[3] >= bodyStart && m[1] <= bottom && m[2] >= left && m[0] <= right &&
    !(repeated.has(m[1]) && repeated.has(m[3])))) {
    warnings.push('MERGED_BODY_REQUIRES_REVIEW');
  }
  columns.forEach(col => {
    const counts = {};
    dataRows.forEach(r => {
      const type = valueType(source.get(r, col.index));
      counts[type] = (counts[type] || 0) + 1;
    });
    const types = Object.keys(counts).filter(t => t !== 'empty');
    col.type = types.length === 1 ? types[0] : types.length ? 'mixed' : 'empty';
    col.typeCounts = counts;
  });
  return { range, titleRows, headerRows, headerTree: structure.tree, columns, dataRows, summaryRows, repeatedHeaderRows, internalHeaderRows,
    rowCount: dataRows.length, confidence, reasons, warnings,
    needsReview: warnings.length > 0 || !explicit && confidence < 0.8 };
}
// Pure snapshot analysis. No OT mutation, network request, formula execution or LLM call.
function analyzeSheet(input, options = {}) {
  options = Object.assign({ sampleRows: 30, maxHeaderRows: 6, maxColumns: 10000, blankRowTolerance: 0, maxRegionDepth: 32 }, options);
  for (const key of [ 'sampleRows', 'maxHeaderRows', 'maxColumns', 'blankRowTolerance', 'maxRegionDepth' ]) {
    if (!Number.isSafeInteger(options[key]) || options[key] < (key === 'blankRowTolerance' ? 0 : 1)) throw new TypeError('Invalid ' + key);
  }
  const source = normalize(input, options);
  validateMerges(source);
  const detected = options.regions ? { regions: options.regions, titles: [] } : detectRegions(source, options);
  const specs = detected.regions;
  if (!Array.isArray(specs)) throw new TypeError('regions must be an array');
  const tables = specs.map(spec => analyzeRegion(source, spec, options));
  if (source.warnings.size) {
    tables.forEach(table => {
      table.warnings.push(...source.warnings);
      table.needsReview = true;
    });
  }
  return { version: 2, tables, sectionTitles: detected.titles, warnings: Array.from(source.warnings),
    needsReview: source.warnings.size > 0 || tables.some(t => t.needsReview) };
}
// Stream records without making another full matrix. Reuse the exact analyzed snapshot.
function* iterateRecords(input, table, options = {}) {
  if (table.needsReview && !options.allowUncertain) throw new Error('Review table and pass allowUncertain before extracting records');
  const source = normalize(input, options);
  if (source.warnings.size && !options.allowUncertain) throw new Error('Source values require review');
  for (const r of table.dataRows) {
    const values = {};
    table.columns.forEach(col => {
      const value = source.get(r, col.index);
      values[col.key] = empty(value) ? null : value;
    });
    yield { rowIndex: r, values };
  }
}
module.exports = { analyzeSheet, iterateRecords, readValue, valueType };
