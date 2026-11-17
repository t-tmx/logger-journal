// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import { hexToForeGroundColor, hexToBackGroundColor } from './colors.js';
import { hostname } from 'os';

const HOSTNAME = hostname();
const PID = process.pid.toString();

/**
 * Maps each key `K` of `T` to the methods that are injected into the Logger.
 *
 * For a key like `debug` in `levels`, the following are generated:
 * - `debug(message)`: logging method.
 * - `isDebugEnabled()`: checks whether that level is enabled.
 *
 * @template {Record<string, number>} T
 * @typedef {{
 *   [K in keyof T & string as K]: (message: string) => void
 * } & {
 *   [K in keyof T & string as `is${Capitalize<K>}Enabled`]: () => boolean
 * }} LogMethods
 */

/**
 * Capitalizes the first letter of a string.
 *
 * @param {string} text The text to capitalize.
 * @returns {string} The text with the first letter capitalized.
 */
const capitalizeFirstLetter = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Pre-computed color information for a log level.
 *
 * @typedef {{
 *   hexColor: string,
 *   ansiFgColor: string,
 *   ansiBgColor: string,
 * }} ColorInfo
 */

/**
 * A map of log levels to their pre-computed color information.
 *
 * @typedef {Record<string, ColorInfo>} ColorMap
 */

const DEFAULT_HEX = '#000';

/** @type {ColorInfo} */
const DEFAULT_COLOR = {
  hexColor: DEFAULT_HEX,
  ansiFgColor: hexToForeGroundColor(DEFAULT_HEX),
  ansiBgColor: hexToBackGroundColor(DEFAULT_HEX),
};

/**
 * Pre-computes the ANSI color sequences for each log level.
 *
 * @param {Record<string, string>} [colors] The hexadecimal colors keyed by log level.
 * @returns {ColorMap | null} The pre-computed colors, or `null` if none were provided.
 */
const buildColorMap = (colors) => {
  if (!colors) return null;

  /** @type {ColorMap} */
  const result = {};

  for (const [type, hex] of Object.entries(colors)) {
    result[type] = {
      hexColor: hex,
      ansiFgColor: hexToForeGroundColor(hex),
      ansiBgColor: hexToBackGroundColor(hex),
    };
  }

  return result;
};

/**
 * Options used to configure a Logger instance.
 *
 * @typedef {{
 *   name: string,
 *   loggingLevel: string | number,
 *   levels: Record<string, number>,
 *   appenders: Array<import('./appenders/appender.js').Appender>,
 *   colors: Record<string, string>,
 * }} LoggerOptions
 */
class Logger {
  #appenders;

  #name;

  /** @type {ColorMap | null} */
  #colors;

  /**
   * Creates a Logger instance.
   *
   * @param {LoggerOptions} options The logger options.
   */
  constructor({
    name,
    loggingLevel,
    levels,
    appenders,
    colors,
  }) {
    this.#appenders = appenders;
    this.#name = name;
    this.#colors = buildColorMap(colors);

    const normalizedLevel = typeof loggingLevel !== 'number'
      ? (levels[loggingLevel] ?? -1)
      : loggingLevel;

    /**
     * The methods injected into the logger instance.
     *
     * @type {Record<string, ((message: string) => void) | (() => boolean)>}
     */
    const methods = {};
    const noop = () => {};

    Object.entries(levels).forEach(([level, value]) => {
      methods[level] = value > normalizedLevel
        ? noop
        : (message) => {
            const date = new Date();
            const color = this.#colors?.[level] ?? DEFAULT_COLOR;
            const data = {
              date: date.toLocaleDateString(),
              datetime: date.toLocaleString(),
              time: date.toLocaleTimeString(),
              pid: PID,
              hostname: HOSTNAME,
              m: message,
              loggerName: this.#name,
              level,
              hexColor: color.hexColor,
              ansiFgColor: color.ansiFgColor,
              ansiBgColor: color.ansiBgColor,
            };
            for (let i = 0; i < this.#appenders.length; ++i) {
              this.#appenders[i].append(data);
            }
          };
      methods[`is${capitalizeFirstLetter(level)}Enabled`] = () => value <= normalizedLevel;
    });

    Object.assign(this, methods);
  }
}

/**
 * A Logger instance with methods injected according to the levels.
 *
 * @template {Record<string, number>} T
 * @typedef {Logger & LogMethods<T>} LoggerInstance
 */
const LoggerCtor = /** @type {any} */ (Logger);

export default LoggerCtor;

/**
 * Creates a logger instance with the provided options.
 *
 * @template {Record<string, number>} T
 * @param {Omit<LoggerOptions, 'levels'> & { levels: T }} options The logger options.
 * @returns {Logger & LogMethods<T>} The created logger instance.
 */
export const createLogger = (options) => /**
 * The new Logger instance cast to any.
 *
 * @type {any}
 */ (new Logger(options));
