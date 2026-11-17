// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import { Appender } from './appenders/appender.js';
import { ConsoleAppender } from './appenders/consoleAppender.js';
import { LogManagerConfigError } from './errors.js';
import { createLogger } from './logger.js';

/**
 * Defines a log level.
 *
 * @typedef {Object} LevelDefinition
 * @property {string} color The CSS color associated with the level.
 * @property {number} severity The severity of the level; lower numbers are more severe.
 */

/**
 * Maps level names to their definitions.
 *
 * @typedef {Record<string, LevelDefinition>} LevelsConfig
 */

/**
 * Configuration for a logger.
 *
 * @template {string} [TLevelName=string]
 * @typedef {Object} LoggerConfig
 * @property {TLevelName | null} [level] The level name. `null` disables the logger.
 * @property {string[]} [appenders] The appender names from the `appenders` dictionary.
 */

/**
 * Maps each level name to its numeric severity.
 *
 * @template {LevelsConfig} T
 * @typedef {{ [K in keyof T]: number }} SeveritiesFromLevels
 */

/**
 * Logger type generated from a levels configuration.
 *
 * @template {LevelsConfig} T
 * @typedef {import('./logger.js').LoggerInstance<SeveritiesFromLevels<T>>} LoggerFor
 */

/**
 * Fully resolved logger configuration.
 *
 * @typedef {Object} ResolvedLoggerConfig
 * @property {string | number | null} level The resolved level.
 * @property {import('./appenders/appender.js').Appender[]} appenders The resolved appenders.
 */

const DefaultLevelsConfig = {
  fatal: { color: '#bb1e4d', severity: 0 },
  error: { color: '#ff0000', severity: 1 },
  warn: { color: '#efc408', severity: 2 },
  info: { color: '#00c8ff', severity: 3 },
  debug: { color: '#fafa85', severity: 4 },
  trace: { color: '#4f4f4f', severity: 5 },
};
Object.freeze(DefaultLevelsConfig);

/**
 * The default levels configuration type.
 *
 * @typedef {typeof DefaultLevelsConfig} DefaultLevels
 */

/**
 * Validates and normalizes the levels configuration.
 *
 * @template {LevelsConfig} T
 * @param {T | undefined} levelsConfig The levels configuration to validate.
 * @returns {{ severities: SeveritiesFromLevels<T>, levelsColor: Object.<string, string> }} The normalized severities and level colors.
 */
const buildLevels = (levelsConfig) => {
  /**
   * The levels configuration to use.
   *
   * @type {LevelsConfig}
   */
  const levelsToUse = levelsConfig ?? DefaultLevelsConfig;

  if (Object.keys(levelsToUse).length === 0) {
    throw new LogManagerConfigError(
      'LogManager: at least one level is required',
      { code: 'ERR_EMPTY_LEVELS' },
    );
  }

  /**
   * The level severities.
   *
   * @type {Object.<string, number>}
   */
  const severities = {};
  /**
   * The level colors.
   *
   * @type {Object.<string, string>}
   */
  const levelsColor = {};
  const seen = new Set();

  Object.entries(levelsToUse).forEach(([name, def]) => {
    if (typeof def.severity !== 'number') {
      throw new TypeError(`LogManager: severity for level "${name}" must be a number`);
    }
    if (def.severity < 0) {
      throw new RangeError(`LogManager: severity for level "${name}" must be >= 0`);
    }
    if (seen.has(def.severity)) {
      throw new LogManagerConfigError(
        `LogManager: duplicate severity ${def.severity}`,
        { code: 'ERR_DUPLICATE_SEVERITY', severity: def.severity, level: name },
      );
    }
    if (typeof def.color !== 'string') {
      throw new TypeError(`LogManager: color for level "${name}" must be a string`);
    }
    if (def.color.length === 0) {
      throw new LogManagerConfigError(
        `LogManager: missing color for level "${name}"`,
        { code: 'ERR_MISSING_COLOR', level: name },
      );
    }
    seen.add(def.severity);
    severities[name] = def.severity;
    levelsColor[name] = def.color;
  });

  return {
    severities: /**
     * The severities cast to the expected type.
     *
     * @type {SeveritiesFromLevels<T>}
     */ (severities),
    levelsColor,
  };
};

/**
 * Validates the appenders configuration.
 *
 * @param {Object.<string, import('./appenders/appender.js').Appender>} [appendersConfig] The appenders configuration.
 * @returns {Object.<string, import('./appenders/appender.js').Appender>} The validated appenders.
 */
const validateAppenders = (appendersConfig) => {
  const appenders = appendersConfig ?? {};

  Object.entries(appenders).forEach(([name, appender]) => {
    if (!(appender instanceof Appender)) {
      throw new TypeError(`LogManager: appender "${name}" must extend Appender`);
    }
  });

  return appenders;
};

/**
 * Resolves appender names to appender instances.
 *
 * @param {string[]} names The appender names.
 * @param {Object.<string, import('./appenders/appender.js').Appender>} appenders The available appenders.
 * @returns {import('./appenders/appender.js').Appender[]} The resolved appenders.
 */
const resolveAppenders = (names, appenders) => names.map((appenderName) => {
  if (!Object.hasOwn(appenders, appenderName)) {
    throw new LogManagerConfigError(
      `LogManager: unknown appender "${appenderName}"`,
      { code: 'ERR_UNKNOWN_APPENDER', appenderName },
    );
  }
  return appenders[appenderName];
});

/**
 * Resolves a logger configuration against the available levels and appenders.
 *
 * @param {LoggerConfig} cfg The logger configuration.
 * @param {Object.<string, number>} severities The level severities.
 * @param {Object.<string, import('./appenders/appender.js').Appender>} appenders The available appenders.
 * @returns {Partial<ResolvedLoggerConfig>} The partially resolved logger configuration.
 */
const resolveLoggerConfig = (cfg, severities, appenders) => {
  /**
   * The partially resolved logger configuration.
   *
   * @type {Partial<ResolvedLoggerConfig>}
   */
  const resolved = {};

  if (typeof cfg.level !== 'undefined') {
    if (cfg.level === null) {
      resolved.level = null;
      resolved.appenders = [];
      return resolved;
    }
    if (!Object.hasOwn(severities, cfg.level)) {
      throw new LogManagerConfigError(
        `LogManager: unknown level "${cfg.level}"`,
        { code: 'ERR_UNKNOWN_LEVEL', level: cfg.level },
      );
    }
    resolved.level = cfg.level;
  }

  if (typeof cfg.appenders !== 'undefined') {
    resolved.appenders = resolveAppenders(cfg.appenders, appenders);
  }

  return resolved;
};

/**
 * Manages logger instances and their configuration.
 *
 * @template {LevelsConfig} [TLevels=DefaultLevels]
 */
export class LogManager {
  /**
   * The resolved levels information.
   *
   * @type {{ severities: SeveritiesFromLevels<TLevels>, levelsColor: Record<string, string> }}
   */
  #levels;

  /**
   * The available appenders.
   *
   * @type {Record<string, import('./appenders/appender.js').Appender>}
   */
  #appenders;

  /**
   * The root logger configuration.
   *
   * @type {ResolvedLoggerConfig}
   */
  #rootConfig;

  /**
   * The per-logger configurations.
   *
   * @type {Record<string, Partial<ResolvedLoggerConfig>>}
   */
  #loggersConfig;

  /**
   * The cached logger instances.
   *
   * @type {Map<string, LoggerFor<TLevels>>}
   */
  #loggers;

  /**
   * Creates a LogManager instance.
   *
   * @param {{
   *   root?: LoggerConfig<keyof TLevels & string>,
   *   loggers?: Record<string, LoggerConfig<keyof TLevels & string>>,
   *   appenders?: Record<string, import('./appenders/appender.js').Appender>,
   *   levels?: TLevels,
   * }} [config] The log manager configuration.
   */
  constructor(config = {}) {
    const {
      levels: levelsConfig,
      appenders: appendersConfig,
      root,
      loggers,
    } = config;

    this.#levels = buildLevels(levelsConfig);
    this.#appenders = validateAppenders(appendersConfig);
    this.#loggers = new Map();

    const { severities } = this.#levels;
    const maxLevel = Math.max(...Object.values(severities));

    if (typeof root === 'undefined') {
      this.#rootConfig = {
        level: maxLevel,
        appenders: [new ConsoleAppender()],
      };
    } else {
      const resolved = resolveLoggerConfig(root, severities, this.#appenders);
      this.#rootConfig = {
        level: typeof resolved.level !== 'undefined' ? resolved.level : maxLevel,
        appenders: typeof resolved.appenders !== 'undefined' ? resolved.appenders : [],
      };
    }

    this.#loggersConfig = {};
    Object.entries(loggers ?? {}).forEach(([name, cfg]) => {
      this.#loggersConfig[name] = resolveLoggerConfig(cfg, severities, this.#appenders);
    });
  }

  /**
   * Gets or creates a logger by name.
   *
   * @param {string} name The logger name.
   * @returns {LoggerFor<TLevels>} The logger instance.
   */
  getLogger(name) {
    const cached = this.#loggers.get(name);
    if (typeof cached !== 'undefined') {
      return cached;
    }

    const { level, appenders } = this.#resolveConfig(name);

    const logger = createLogger({
      name,
      appenders,
      levels: this.#levels.severities,
      loggingLevel: level ?? -1,
      colors: this.#levels.levelsColor,
    });

    this.#loggers.set(name, logger);

    return logger;
  }

  /**
   * Resolves the effective level and appenders for a logger name.
   *
   * Each field is inherited independently from the closest matching ancestor config.
   *
   * @param {string} name The logger name.
   * @returns {ResolvedLoggerConfig} The resolved logger configuration.
   */
  #resolveConfig(name) {
    /**
     * The ancestor prefixes of the logger name.
     *
     * @type {string[]}
     */
    const prefixes = [];
    let partial = '';

    name.split('.').forEach((segment) => {
      partial = partial ? `${partial}.${segment}` : segment;
      prefixes.push(partial);
    });

    let { level, appenders } = this.#rootConfig;

    prefixes.forEach((prefix) => {
      const cfg = this.#loggersConfig[prefix];
      if (!cfg) {
        return;
      }
      if (typeof cfg.level !== 'undefined') {
        level = cfg.level;
      }
      if (typeof cfg.appenders !== 'undefined') {
        appenders = cfg.appenders;
      }
    });

    // A logger without appenders cannot emit anything: force it disabled so
    // the injected methods become noops.
    if (appenders.length === 0) {
      level = null;
    }

    return { level, appenders };
  }
}
