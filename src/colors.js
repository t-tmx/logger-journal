// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import { LogManagerConfigError } from './errors.js';

/**
 * Parses a hexadecimal color and returns its RGB components.
 *
 * @param {string} hex The hexadecimal color in #RGB, #RRGGBB, RGB, or RRGGBB format.
 * @returns {{r: number, g: number, b: number}} The RGB components of the color.
 */
const parseHexColor = (hex) => {
  if (typeof hex !== 'string') {
    throw new TypeError(`Expected a string, received: ${typeof hex}`);
  }

  let hexColor = hex.startsWith('#') ? hex.slice(1) : hex;

  if (hexColor.length === 3) {
    hexColor = hexColor
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (hexColor.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hexColor)) {
    throw new LogManagerConfigError(
      `Invalid hexadecimal color: "${hex}"`,
      { code: 'ERR_INVALID_HEX_COLOR', hex },
    );
  }

  const r = parseInt(hexColor.slice(0, 2), 16);
  const g = parseInt(hexColor.slice(2, 4), 16);
  const b = parseInt(hexColor.slice(4, 6), 16);

  return { r, g, b };
};

/**
 * Converts a hexadecimal color to an ANSI foreground text color code.
 *
 * Accepts formats: #RGB, #RRGGBB, RGB, and RRGGBB with or without #.
 *
 * @param {string} hex The hexadecimal color.
 * @returns {string} The ANSI sequence for the text color.
 * @throws {TypeError} If the argument is not a string.
 * @throws {Error} If the hexadecimal format is invalid.
 */
export const hexToForeGroundColor = (hex) => {
  const { r, g, b } = parseHexColor(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
};

/**
 * Converts a hexadecimal color to an ANSI background color code.
 *
 * Accepts formats: #RGB, #RRGGBB, RGB, and RRGGBB with or without #.
 *
 * @param {string} hex The hexadecimal color.
 * @returns {string} The ANSI sequence for the background color.
 * @throws {TypeError} If the argument is not a string.
 * @throws {Error} If the hexadecimal format is invalid.
 */
export const hexToBackGroundColor = (hex) => {
  const { r, g, b } = parseHexColor(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
};
