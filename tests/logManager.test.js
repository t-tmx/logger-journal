// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';

import { LogManager } from '../src/logManager.js';
import { Appender } from '../src/appenders/appender.js';
import { LogManagerConfigError } from '../src/errors.js';

class MockAppender extends Appender {
  constructor() {
    super('{{m}}');
    this.append = vi.fn();
  }
}

const makeMock = () => new MockAppender();

/** Extracts the most recent data dictionary passed to a mocked appender. */
const lastData = (mock) => mock.append.mock.calls.at(-1)?.[0];

beforeEach(() => {
  ['log', 'info', 'warn', 'error', 'debug', 'trace'].forEach((method) => {
    vi.spyOn(console, method).mockImplementation(() => {});
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LogManager', () => {
  describe('defaults', () => {
    it('creates a working logger with no arguments', () => {
      const manager = new LogManager();
      const logger = manager.getLogger('app');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.isInfoEnabled).toBe('function');
    });

    it('enables every level by default (max severity = trace)', () => {
      const manager = new LogManager();
      const logger = manager.getLogger('app');
      expect(logger.isFatalEnabled()).toBe(true);
      expect(logger.isErrorEnabled()).toBe(true);
      expect(logger.isWarnEnabled()).toBe(true);
      expect(logger.isInfoEnabled()).toBe(true);
      expect(logger.isDebugEnabled()).toBe(true);
      expect(logger.isTraceEnabled()).toBe(true);
    });
  });

  describe('levels validation', () => {
    it('accepts levels: undefined (falls back to defaults)', () => {
      expect(() => new LogManager({})).not.toThrow();
    });

    it('throws LogManagerConfigError when levels is an empty object', () => {
      const fn = () => new LogManager({ levels: {} });
      expect(fn).toThrow(LogManagerConfigError);
      expect(fn).toThrow(/at least one level/);
    });

    it('throws TypeError on non-numeric severity', () => {
      const fn = () => new LogManager({
        levels: { debug: { color: '#fff', severity: 'x' } },
      });
      expect(fn).toThrow(TypeError);
      expect(fn).not.toThrow(LogManagerConfigError);
      expect(fn).toThrow(/must be a number/);
    });

    it('throws RangeError on negative severity', () => {
      const fn = () => new LogManager({
        levels: { debug: { color: '#fff', severity: -1 } },
      });
      expect(fn).toThrow(RangeError);
      expect(fn).not.toThrow(LogManagerConfigError);
      expect(fn).toThrow(/must be >= 0/);
    });

    it('throws LogManagerConfigError on duplicate severity', () => {
      const fn = () => new LogManager({
        levels: {
          a: { color: '#fff', severity: 1 },
          b: { color: '#fff', severity: 1 },
        },
      });
      expect(fn).toThrow(LogManagerConfigError);
      expect(fn).toThrow(/duplicate severity/);
    });

    it('throws LogManagerConfigError on empty color', () => {
      const fn = () => new LogManager({
        levels: { debug: { color: '', severity: 1 } },
      });
      expect(fn).toThrow(LogManagerConfigError);
      expect(fn).toThrow(/missing color/);
    });

    it('throws TypeError on non-string color', () => {
      const fn = () => new LogManager({
        levels: { debug: { color: 123, severity: 1 } },
      });
      expect(fn).toThrow(TypeError);
      expect(fn).not.toThrow(LogManagerConfigError);
      expect(fn).toThrow(/must be a string/);
    });
  });

  describe('appenders validation', () => {
    it('throws TypeError when an appender does not extend Appender', () => {
      const fn = () => new LogManager({
        appenders: { bad: { append: () => {} } },
      });
      expect(fn).toThrow(TypeError);
      expect(fn).not.toThrow(LogManagerConfigError);
      expect(fn).toThrow(/must extend Appender/);
    });

    it('accepts any subclass of Appender', () => {
      const mock = makeMock();
      expect(() => new LogManager({ appenders: { mock } })).not.toThrow();
    });
  });

  describe('color propagation', () => {
    it('passes each level color to the logger data dictionary', () => {
      const mock = makeMock();
      const manager = new LogManager({
        appenders: { mock },
        levels: {
          info: { color: '#abc', severity: 0 },
          error: { color: '#def', severity: 1 },
        },
        root: { level: 'error', appenders: ['mock'] },
      });

      const logger = manager.getLogger('app');
      logger.info('hi');
      expect(lastData(mock)).toMatchObject({
        m: 'hi',
        level: 'info',
        hexColor: '#abc',
        ansiFgColor: '\x1b[38;2;170;187;204m',
        ansiBgColor: '\x1b[48;2;170;187;204m',
      });

      logger.error('boom');
      expect(lastData(mock)).toMatchObject({
        m: 'boom',
        level: 'error',
        hexColor: '#def',
        ansiFgColor: '\x1b[38;2;221;238;255m',
        ansiBgColor: '\x1b[48;2;221;238;255m',
      });
    });

    it('uses the default color declared for each level', () => {
      const mock = makeMock();
      const manager = new LogManager({
        appenders: { mock },
        root: { level: 'info', appenders: ['mock'] },
      });

      manager.getLogger('app').info('hi');
      const data = lastData(mock);

      // Default `info` color from DefaultLevelsConfig.
      expect(data.hexColor).toBe('#00c8ff');
      expect(data.ansiFgColor).toBe('\x1b[38;2;0;200;255m');
      expect(data.ansiBgColor).toBe('\x1b[48;2;0;200;255m');
    });
  });

  describe('root resolution', () => {
    it('uses the provided root level', () => {
      const mock = makeMock();
      const manager = new LogManager({
        appenders: { mock },
        root: { level: 'warn', appenders: ['mock'] },
      });
      const logger = manager.getLogger('app');
      expect(logger.isFatalEnabled()).toBe(true);
      expect(logger.isWarnEnabled()).toBe(true);
      expect(logger.isInfoEnabled()).toBe(false);
    });

    it('throws on unknown root level', () => {
      const fn = () => new LogManager({
        root: { level: 'nope', appenders: [] },
      });
      expect(fn).toThrow(LogManagerConfigError);
      expect(fn).toThrow(/unknown level/);
    });

    it('throws on unknown root appender', () => {
      const fn = () => new LogManager({
        root: { level: 'info', appenders: ['nope'] },
      });
      expect(fn).toThrow(LogManagerConfigError);
      expect(fn).toThrow(/unknown appender/);
    });

    it('is case-sensitive for level names', () => {
      const fn = () => new LogManager({
        root: { level: 'INFO', appenders: [] },
      });
      expect(fn).toThrow(LogManagerConfigError);
      expect(fn).toThrow(/unknown level/);
    });

    it('disables the logger when root level is null', () => {
      const mock = makeMock();
      const manager = new LogManager({
        appenders: { mock },
        root: { level: null, appenders: ['mock'] },
      });
      const logger = manager.getLogger('app');
      logger.fatal('x');
      expect(mock.append).not.toHaveBeenCalled();
    });

    it('does not validate appenders when root level is null', () => {
      expect(() => new LogManager({
        root: { level: null, appenders: ['nonexistent'] },
      })).not.toThrow();
    });

    it('disables the logger when root appenders is empty', () => {
      const manager = new LogManager({
        root: { level: 'info', appenders: [] },
      });
      const logger = manager.getLogger('app');
      expect(logger.isFatalEnabled()).toBe(false);
      expect(logger.isTraceEnabled()).toBe(false);
    });

    it('falls back to the maximum level when root omits the level', () => {
      const mock = makeMock();
      const manager = new LogManager({
        appenders: { mock },
        root: { appenders: ['mock'] },
      });
      const logger = manager.getLogger('app');
      expect(logger.isFatalEnabled()).toBe(true);
      expect(logger.isTraceEnabled()).toBe(true);
      logger.info('msg');
      expect(mock.append).toHaveBeenCalledWith(
        expect.objectContaining({ m: 'msg', level: 'info', loggerName: 'app' }),
      );
    });

    it('falls back to an empty appender list when root omits the appenders', () => {
      const manager = new LogManager({
        root: { level: 'info' },
      });
      const logger = manager.getLogger('app');
      expect(logger.isFatalEnabled()).toBe(false);
      expect(logger.isInfoEnabled()).toBe(false);
      expect(logger.isTraceEnabled()).toBe(false);
    });
  });

  describe('loggers resolution', () => {
    it('applies named logger config', () => {
      const root = makeMock();
      const child = makeMock();
      const manager = new LogManager({
        appenders: { root, child },
        root: { level: 'trace', appenders: ['root'] },
        loggers: { app: { level: 'error', appenders: ['child'] } },
      });
      const logger = manager.getLogger('app');
      logger.fatal('x');
      expect(child.append).toHaveBeenCalledWith(
        expect.objectContaining({ m: 'x', level: 'fatal', loggerName: 'app' }),
      );
      expect(root.append).not.toHaveBeenCalled();
    });

    it('throws on unknown named level', () => {
      const fn = () => new LogManager({
        root: { level: 'info', appenders: [] },
        loggers: { app: { level: 'nope' } },
      });
      expect(fn).toThrow(LogManagerConfigError);
      expect(fn).toThrow(/unknown level/);
    });

    it('throws on unknown named appender', () => {
      const fn = () => new LogManager({
        root: { level: 'info', appenders: [] },
        loggers: { app: { appenders: ['nope'] } },
      });
      expect(fn).toThrow(LogManagerConfigError);
      expect(fn).toThrow(/unknown appender/);
    });

    it('disables a named logger when its level is null', () => {
      const mock = makeMock();
      const manager = new LogManager({
        appenders: { mock },
        root: { level: 'info', appenders: ['mock'] },
        loggers: { silent: { level: null } },
      });
      const logger = manager.getLogger('silent');
      logger.fatal('x');
      expect(mock.append).not.toHaveBeenCalled();
    });
  });

  describe('inheritance', () => {
    it('inherits appenders from root when only level is set', () => {
      const mock = makeMock();
      const manager = new LogManager({
        appenders: { mock },
        root: { level: 'info', appenders: ['mock'] },
        loggers: { app: { level: 'debug' } },
      });
      const logger = manager.getLogger('app');
      logger.debug('msg');
      expect(mock.append).toHaveBeenCalledWith(
        expect.objectContaining({ m: 'msg', level: 'debug', loggerName: 'app' }),
      );
    });

    it('inherits level from root when only appenders are set', () => {
      const root = makeMock();
      const child = makeMock();
      const manager = new LogManager({
        appenders: { root, child },
        root: { level: 'warn', appenders: ['root'] },
        loggers: { app: { appenders: ['child'] } },
      });
      const logger = manager.getLogger('app');
      logger.info('no');
      logger.warn('yes');
      expect(child.append).toHaveBeenCalledTimes(1);
      expect(child.append).toHaveBeenCalledWith(
        expect.objectContaining({ m: 'yes', level: 'warn', loggerName: 'app' }),
      );
      expect(root.append).not.toHaveBeenCalled();
    });

    it('resolves hierarchical config (system -> system.critical)', () => {
      const root = makeMock();
      const sys = makeMock();
      const manager = new LogManager({
        appenders: { root, sys },
        root: { level: 'trace', appenders: ['root'] },
        loggers: { system: { level: 'info', appenders: ['sys'] } },
      });
      const logger = manager.getLogger('system.critical');
      logger.fatal('x');
      logger.debug('y');
      expect(sys.append).toHaveBeenCalledTimes(1);
      expect(sys.append).toHaveBeenCalledWith(
        expect.objectContaining({ m: 'x', level: 'fatal', loggerName: 'system.critical' }),
      );
      expect(root.append).not.toHaveBeenCalled();
    });

    it('distinguishes appenders: undefined (inherit) from [] (empty)', () => {
      const mock = makeMock();
      const manager = new LogManager({
        appenders: { mock },
        root: { level: 'info', appenders: ['mock'] },
        loggers: {
          inherits: { level: 'info' },
          empty: { level: 'info', appenders: [] },
        },
      });
      expect(manager.getLogger('inherits').isInfoEnabled()).toBe(true);
      expect(manager.getLogger('empty').isInfoEnabled()).toBe(false);
    });
  });

  describe('getLogger', () => {
    it('returns the same instance for the same name (caching)', () => {
      const manager = new LogManager();
      expect(manager.getLogger('app')).toBe(manager.getLogger('app'));
    });

    it('returns different instances for different names', () => {
      const manager = new LogManager();
      expect(manager.getLogger('a')).not.toBe(manager.getLogger('b'));
    });

    it('calls appenders only for enabled levels', () => {
      const mock = makeMock();
      const manager = new LogManager({
        appenders: { mock },
        root: { level: 'info', appenders: ['mock'] },
      });
      const logger = manager.getLogger('app');
      logger.fatal('f');
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      logger.debug('d');
      logger.trace('t');
      expect(mock.append).toHaveBeenCalledTimes(4);
    });
  });
});
