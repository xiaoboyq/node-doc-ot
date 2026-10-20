'use strict';

const intersects = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const contains = (a, b) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const text = value => (value == null ? '' : String(value).trim());

// Projection of occupied rectangles, without expanding large merged ranges into cells.
function bands(rects, axis, tolerance) {
  const intervals = rects.map(rect => [ rect[axis], rect[axis + 2] ]).sort((a, b) => a[0] - b[0]);
  const result = [];
  for (const interval of intervals) {
    const previous = result[result.length - 1];
    if (!previous || interval[0] - previous[1] > tolerance + 1) result.push(interval.slice());
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  return result;
}
function bounds(rects) {
  const range = [ Infinity, Infinity, -Infinity, -Infinity ];
  for (const rect of rects) {
    range[0] = Math.min(range[0], rect[0]); range[1] = Math.min(range[1], rect[1]);
    range[2] = Math.max(range[2], rect[2]); range[3] = Math.max(range[3], rect[3]);
  }
  return range;
}
function detectRegions(source, options) {
  const points = [];
  source.rows.forEach((row, r) => row.forEach((value, c) => points.push([ c, r, c, r ])));
  // Empty formatting alone must not create gigantic tables.
  const merges = source.merges.filter(m => text(source.get(m[1], m[0])) !== '');
  const titles = [];
  function split(rects, depth) {
    if (!rects.length) return [];
    const range = bounds(rects);
    if (depth >= options.maxRegionDepth) {
      source.warnings.add('REGION_DEPTH_LIMIT');
      return [ range ];
    }
    // A full-width report title can bridge otherwise independent tables.
    // Remove it only when recursive analysis actually finds multiple children.
    const titleMerge = merges.find(m => m[0] === range[0] && m[2] === range[2] &&
      m[1] === range[1] && m[3] === range[1] && m[0] < m[2]);
    if (titleMerge && rects.filter(r => r[1] === range[1] && r[0] === r[2]).length === 1) {
      const savedTitleCount = titles.length;
      const children = split(rects.filter(r => r[1] > range[1]), depth + 1);
      if (children.length > 1) {
        titles.push({ range: titleMerge.slice(), text: text(source.get(titleMerge[1], titleMerge[0])), tableRanges: children });
        return children;
      }
      titles.length = savedTitleCount;
      return [ range ];
    }
    for (const axis of [ 1, 0 ]) {
      const parts = bands(rects, axis, axis === 1 ? options.blankRowTolerance : 0);
      if (parts.length > 1) {
        // Bucket once, instead of scanning every cell for every small table.
        const buckets = parts.map(() => []);
        for (const rect of rects) {
          let low = 0,
            high = parts.length - 1;
          while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (parts[mid][1] < rect[axis]) low = mid + 1;
            else high = mid;
          }
          buckets[low].push(rect);
        }
        return buckets.reduce((result, bucket) => result.concat(split(bucket, depth + 1)), []);
      }
    }
    return [ range ];
  }
  return { regions: split(points.concat(merges), 0).sort((a, b) => a[1] - b[1] || a[0] - b[0]), titles };
}

function validateMerges(source) {
  const ordered = source.merges.slice().sort((a, b) => a[1] - b[1]);
  let active = [];
  for (const merge of ordered) {
    active = active.filter(other => other[3] >= merge[1]);
    if (active.some(other => intersects(other, merge))) source.warnings.add('OVERLAPPING_MERGES');
    active.push(merge);
  }
}

// Build actual nodes so repeated labels at different depths do not collapse.
function buildHeaderTree(source, range, headerRows) {
  const warnings = new Set();
  if (!headerRows.length) return { tree: [], paths: [], warnings: [] };
  const headerRange = [ range[0], headerRows[0], range[2], headerRows[headerRows.length - 1] ];
  const relevant = source.merges.filter(m => intersects(m, headerRange));
  if (relevant.some(m => !contains(headerRange, m))) warnings.add('HEADER_MERGE_CROSSES_BOUNDARY');
  const nodes = [];
  const seen = new Set();
  for (const row of headerRows) {
    for (let col = range[0]; col <= range[2]; col++) {
      const merge = relevant.find(m => contains(m, [ col, row, col, row ]));
      const span = merge || [ col, row, col, row ];
      const id = 'r' + span[1] + 'c' + span[0];
      if (seen.has(id)) continue;
      seen.add(id);
      const value = source.get(span[1], span[0]);
      if (!text(value)) continue;
      nodes.push({ id, label: text(value), range: span.slice(), children: [] });
    }
  }
  const tree = [];
  for (const node of nodes) {
    const above = nodes.filter(other => other.range[3] < node.range[1] &&
      other.range[0] <= node.range[2] && other.range[2] >= node.range[0]);
    if (above.some(other => other.range[0] > node.range[0] || other.range[2] < node.range[2])) {
      warnings.add('CROSSING_HEADER_GROUPS');
    }
    const parent = above.filter(other => other.range[0] <= node.range[0] && other.range[2] >= node.range[2])
      .sort((a, b) => b.range[3] - a.range[3])[0];
    if (parent) parent.children.push(node);
    else tree.push(node);
  }
  const paths = [];
  for (let col = range[0]; col <= range[2]; col++) {
    const covering = nodes.filter(node => node.range[0] <= col && node.range[2] >= col);
    paths.push(covering.map(node => node.label));
    if (!covering.some(node => node.range[3] === headerRange[3])) warnings.add('MISSING_HEADER_LEAF');
  }
  return { tree, paths, warnings: Array.from(warnings) };
}
module.exports = { detectRegions, validateMerges, buildHeaderTree };
