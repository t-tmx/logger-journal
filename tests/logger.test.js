// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import {
  describe, expect, it, vi, beforeEach, afterEach,
} from 'vitest';
import Logger, { createLogger } from '../src/logger.js';

const NAME = 'test';

const LEVELS = Object.freeze({
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
});

const LEVEL_NAMES = Object.keys(LEVELS);

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const enabledName = (level) => `is${capitalize(level)}Enabled`;

const makeAppender = () => ({ append: vi.fn() });

/**
 * Builds a logger with spied appenders and the default levels.
 * @param {string | number} loggingLevel
 * @param {{
 *   levels?: Record<string, number>,
 *   appenders?: Array<{ append: Function }>,
 *   colors?: Record<string, string>,
 * }} [overrides]
 */
const buildLogger = (loggingLevel, { levels = LEVELS, appenders, colors } = {}) => {
  const finalAppenders = appenders ?? [makeAppender()];
  const options = {
    name: NAME,
    loggingLevel,
    levels,
    appenders: finalAppenders,
  };
  if (colors !== undefined) options.colors = colors;

  const logger = new Logger(options);
  return { logger, appenders: finalAppenders };
};

/** How many levels would be enabled for a given loggingLevel. */
const enabledCount = (loggingLevel, levels = LEVELS) => {
  const threshold = typeof loggingLevel === 'number'
    ? loggingLevel
    : levels[loggingLevel];
  return Object.values(levels).filter((value) => value <= threshold).length;
};

/** Retrieves the most recent data dictionary passed to `append`. */
const lastData = (appender) => {
  const { calls } = appender.append.mock;
  return calls.at(-1)?.[0];
};

describe('Logger', () => {
  describe('method injection', () => {
    it.each(LEVEL_NAMES)(
      'injects both "%s" and its corresponding "is<Level>Enabled"',
      (level) => {
        const { logger } = buildLogger('trace');
        expect(logger[level]).toBeTypeOf('function');
        expect(logger[enabledName(level)]).toBeTypeOf('function');
      },
    );

    it('creates one pair of methods per key in `levels`, using those keys', () => {
      const levels = { custom: 0, other: 1 };
      const { logger } = buildLogger(0, { levels });

      expect(logger.custom).toBeTypeOf('function');
      expect(logger.isCustomEnabled).toBeTypeOf('function');
      expect(logger.other).toBeTypeOf('function');
      expect(logger.isOtherEnabled).toBeTypeOf('function');
    });

    it('does not inject methods for levels that are not declared', () => {
      const { logger } = buildLogger('trace');
      expect(logger.verbose).toBeUndefined();
      expect(logger.isVerboseEnabled).toBeUndefined();
    });

    it('returns undefined from a level method (void contract)', () => {
      const { logger } = buildLogger('trace');
      expect(logger.info('hello')).toBeUndefined();
    });
  });

  describe('forwarding to appenders', () => {
    it.each(LEVEL_NAMES)(
      'calls every appender exactly once with a data dictionary for level "%s"',
      (level) => {
        const appenders = [makeAppender(), makeAppender(), makeAppender()];
        const { logger } = buildLogger('trace', { appenders });

        logger[level]('the message');

        appenders.forEach(({ append }) => {
          expect(append).toHaveBeenCalledTimes(1);
          expect(append.mock.calls[0][0]).toMatchObject({
            m: 'the message',
            level,
            loggerName: NAME,
          });
        });
      },
    );

    it('passes a single argument (the data dictionary) to each appender', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info('hello');

      expect(appender.append).toHaveBeenCalledTimes(1);
      expect(appender.append.mock.calls[0]).toHaveLength(1);
      expect(typeof appender.append.mock.calls[0][0]).toBe('object');
    });

    it('data dictionary contains every documented key', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info('hello');

      const data = lastData(appender);
      expect(Object.keys(data).sort()).toEqual(
        [
          'ansiBgColor', 'ansiFgColor', 'date', 'datetime',
          'hexColor', 'level', 'loggerName', 'm', 'time',
          'pid', 'hostname',
        ].sort(),
      );
    });

    it('fills date, time and datetime from the clock', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info('hello');

      const data = lastData(appender);
      expect(data.date).toBeTypeOf('string');
      expect(data.time).toBeTypeOf('string');
      expect(data.datetime).toBeTypeOf('string');
      expect(data.date).not.toBe('');
      expect(data.time).not.toBe('');
      expect(data.datetime).not.toBe('');
    });

    it('passes the message through verbatim', () => {
      const message = '  line with\ttab and newline\n';
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info(message);

      expect(lastData(appender).m).toBe(message);
    });

    it('does not call appenders for disabled levels', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('warn', { appenders: [appender] });

      logger.info('no');
      logger.debug('no');
      logger.trace('no');

      expect(appender.append).not.toHaveBeenCalled();
    });

    it('only forwards the level that was invoked', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.warn('one');

      expect(appender.append).toHaveBeenCalledTimes(1);
      expect(lastData(appender)).toMatchObject({
        m: 'one',
        level: 'warn',
        loggerName: NAME,
      });
    });

    it('does not throw when there are no appenders', () => {
      const { logger } = buildLogger('trace', { appenders: [] });
      expect(() => logger.info('hello')).not.toThrow();
    });

    it('emits exactly the expected number of appends across all levels', () => {
      LEVEL_NAMES.forEach((loggingLevelName) => {
        const appender = makeAppender();
        const { logger } = buildLogger(loggingLevelName, {
          appenders: [appender],
        });

        LEVEL_NAMES.forEach((level) => logger[level](level));

        expect(appender.append).toHaveBeenCalledTimes(
          enabledCount(loggingLevelName),
        );
      });
    });

    it('uses a fresh data dictionary per call (no shared mutable state)', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info('first');
      logger.info('second');

      const [first, second] = appender.append.mock.calls.map(([d]) => d);
      expect(first).not.toBe(second);
      expect(first.m).toBe('first');
      expect(second.m).toBe('second');
    });
  });

  describe('temporal fields', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('date is stable within the same day', () => {
      vi.setSystemTime(new Date('2024-01-15T00:00:00'));
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info('a');
      const first = lastData(appender).date;

      vi.setSystemTime(new Date('2024-01-15T23:59:59'));
      logger.info('b');
      const second = lastData(appender).date;

      expect(second).toBe(first);
    });

    it('date changes when the day changes', () => {
      vi.setSystemTime(new Date('2024-01-15T12:00:00'));
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info('a');
      const first = lastData(appender).date;

      vi.setSystemTime(new Date('2024-01-16T12:00:00'));
      logger.info('b');
      const second = lastData(appender).date;

      expect(second).not.toBe(first);
    });

    it('time advances with the clock', () => {
      vi.setSystemTime(new Date('2024-01-15T00:00:00'));
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info('a');
      const first = lastData(appender).time;

      vi.setSystemTime(new Date('2024-01-15T12:34:56'));
      logger.info('b');
      const second = lastData(appender).time;

      expect(second).not.toBe(first);
    });
  });

  describe('colors', () => {
    it('uses #000 by default when no colors are configured', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info('hello');

      const data = lastData(appender);
      expect(data.hexColor).toBe('#000');
      expect(data.ansiFgColor).toBe('\x1b[38;2;0;0;0m');
      expect(data.ansiBgColor).toBe('\x1b[48;2;0;0;0m');
    });

    it('uses #000 for any level when no colors are configured', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', { appenders: [appender] });

      logger.info('info');
      expect(lastData(appender).hexColor).toBe('#000');

      logger.error('error');
      expect(lastData(appender).hexColor).toBe('#000');

      logger.trace('trace');
      expect(lastData(appender).hexColor).toBe('#000');
    });

    it('applies the configured color for the requested level', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', {
        appenders: [appender],
        colors: { info: '#FF0000' },
      });

      logger.info('hello');

      const data = lastData(appender);
      expect(data.hexColor).toBe('#FF0000');
      expect(data.ansiFgColor).toBe('\x1b[38;2;255;0;0m');
      expect(data.ansiBgColor).toBe('\x1b[48;2;255;0;0m');
    });

    it('falls back to #000 for levels not present in the colors map', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', {
        appenders: [appender],
        colors: { info: '#FF0000' },
      });

      logger.error('boom');

      const data = lastData(appender);
      expect(data.hexColor).toBe('#000');
      expect(data.ansiFgColor).toBe('\x1b[38;2;0;0;0m');
    });

    it('keeps colors per level independent across calls', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', {
        appenders: [appender],
        colors: { info: '#FF0000', error: '#00FF00', warn: '#0000FF' },
      });

      logger.info('one');
      expect(lastData(appender).hexColor).toBe('#FF0000');

      logger.error('two');
      expect(lastData(appender).hexColor).toBe('#00FF00');

      logger.warn('three');
      expect(lastData(appender).hexColor).toBe('#0000FF');

      logger.info('four');
      expect(lastData(appender).hexColor).toBe('#FF0000');
    });

    it('preserves the original hex form in hexColor', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', {
        appenders: [appender],
        colors: { info: '#F00' },
      });

      logger.info('hello');

      const data = lastData(appender);
      expect(data.hexColor).toBe('#F00');
      expect(data.ansiFgColor).toBe('\x1b[38;2;255;0;0m');
    });

    it('supports custom level names in the colors map', () => {
      const levels = { custom: 0 };
      const appender = makeAppender();
      const { logger } = buildLogger(0, {
        levels,
        appenders: [appender],
        colors: { custom: '#ABCDEF' },
      });

      logger.custom('msg');

      const data = lastData(appender);
      expect(data.hexColor).toBe('#ABCDEF');
      expect(data.ansiFgColor).toBe('\x1b[38;2;171;205;239m');
      expect(data.ansiBgColor).toBe('\x1b[48;2;171;205;239m');
    });

    it('treats an empty colors object as "no colors"', () => {
      const appender = makeAppender();
      const { logger } = buildLogger('trace', {
        appenders: [appender],
        colors: {},
      });

      logger.info('hello');

      const data = lastData(appender);
      expect(data.hexColor).toBe('#000');
      expect(data.ansiFgColor).toBe('\x1b[38;2;0;0;0m');
    });

    it('two logger instances do not share colors', () => {
      const a = makeAppender();
      const b = makeAppender();
      const { logger: loggerA } = buildLogger('trace', {
        appenders: [a],
        colors: { info: '#FF0000' },
      });
      const { logger: loggerB } = buildLogger('trace', { appenders: [b] });

      loggerA.info('hi');
      loggerB.info('hi');

      expect(lastData(a).hexColor).toBe('#FF0000');
      expect(lastData(b).hexColor).toBe('#000');
    });

    it('throws LogManagerConfigError at construction if a color is invalid', () => {
      expect(() => buildLogger('trace', {
        colors: { info: 'not-a-color' },
      })).toThrow(/Invalid hexadecimal color: "not-a-color"/);
    });

    it('throws TypeError at construction if a color is not a string', () => {
      expect(() => buildLogger('trace', {
        colors: { info: 123 },
      })).toThrow(TypeError);
    });

    it('accepts the four documented hex formats', () => {
      const formats = ['#F00', 'F00', '#FF0000', 'FF0000'];

      formats.forEach((hex) => {
        const appender = makeAppender();
        const { logger } = buildLogger('trace', {
          appenders: [appender],
          colors: { info: hex },
        });

        logger.info('hello');

        expect(lastData(appender)).toMatchObject({
          hexColor: hex,
          ansiFgColor: '\x1b[38;2;255;0;0m',
          ansiBgColor: '\x1b[48;2;255;0;0m',
        });
      });
    });
  });

  describe('isXEnabled semantics', () => {
    it.each(LEVEL_NAMES)(
      'agrees with "levels[level] <= levels[loggingLevel]" for loggingLevel="%s"',
      (loggingLevelName) => {
        const { logger } = buildLogger(loggingLevelName);
        LEVEL_NAMES.forEach((level) => {
          expect(logger[enabledName(level)]()).toBe(
            LEVELS[level] <= LEVELS[loggingLevelName],
          );
        });
      },
    );

    it.each(LEVEL_NAMES)(
      'agrees with "levels[level] <= loggingLevel" for numeric loggingLevel = LEVELS["%s"]',
      (loggingLevelName) => {
        const threshold = LEVELS[loggingLevelName];
        const { logger } = buildLogger(threshold);
        LEVEL_NAMES.forEach((level) => {
          expect(logger[enabledName(level)]()).toBe(LEVELS[level] <= threshold);
        });
      },
    );

    it('accepts a numeric loggingLevel between two level values', () => {
      const { logger } = buildLogger(2.5);

      expect(logger.isFatalEnabled()).toBe(true);
      expect(logger.isErrorEnabled()).toBe(true);
      expect(logger.isWarnEnabled()).toBe(true);
      expect(logger.isInfoEnabled()).toBe(false);
      expect(logger.isDebugEnabled()).toBe(false);
      expect(logger.isTraceEnabled()).toBe(false);
    });

    it('disables every level when loggingLevel is below the minimum', () => {
      const { logger } = buildLogger(-1);
      LEVEL_NAMES.forEach((level) => {
        expect(logger[enabledName(level)]()).toBe(false);
      });
    });

    it('enables every level when loggingLevel is above the maximum', () => {
      const { logger } = buildLogger(100);
      LEVEL_NAMES.forEach((level) => {
        expect(logger[enabledName(level)]()).toBe(true);
      });
    });

    it('disables every level when loggingLevel is an unknown name (current behavior)', () => {
      const { logger, appenders } = buildLogger('unknown-level');

      LEVEL_NAMES.forEach((level) => {
        expect(logger[enabledName(level)]()).toBe(false);
      });

      LEVEL_NAMES.forEach((level) => logger[level](level));
      appenders.forEach(({ append }) => expect(append).not.toHaveBeenCalled());
    });
  });

  describe('createLogger factory', () => {
    it('returns a Logger instance with the same observable behavior', () => {
      const appender = makeAppender();
      const logger = createLogger({
        name: NAME,
        loggingLevel: 'info',
        levels: LEVELS,
        appenders: [appender],
      });

      expect(logger).toBeInstanceOf(Logger);
      expect(logger.debug).toBeTypeOf('function');
      expect(logger.isDebugEnabled).toBeTypeOf('function');

      logger.info('hi');
      logger.debug('no');

      expect(appender.append).toHaveBeenCalledTimes(1);
      expect(lastData(appender)).toMatchObject({
        m: 'hi',
        level: 'info',
        loggerName: NAME,
      });
    });

    it('respects a custom levels map', () => {
      const levels = { high: 0, low: 10 };
      const appender = makeAppender();
      const logger = createLogger({
        name: NAME,
        loggingLevel: 'high',
        levels,
        appenders: [appender],
      });

      logger.low('no');
      logger.high('yes');

      expect(appender.append).toHaveBeenCalledTimes(1);
      expect(lastData(appender)).toMatchObject({
        m: 'yes',
        level: 'high',
        loggerName: NAME,
      });
    });

    it('forwards the colors option to the Logger', () => {
      const appender = makeAppender();
      const logger = createLogger({
        name: NAME,
        loggingLevel: 'trace',
        levels: LEVELS,
        appenders: [appender],
        colors: { info: '#123456' },
      });

      logger.info('hi');

      const data = lastData(appender);
      expect(data.hexColor).toBe('#123456');
      expect(data.ansiFgColor).toBe('\x1b[38;2;18;52;86m');
      expect(data.ansiBgColor).toBe('\x1b[48;2;18;52;86m');
    });
  });
});
