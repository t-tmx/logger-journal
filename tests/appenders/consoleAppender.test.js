// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';

import { ConsoleAppender } from '../../src/appenders/consoleAppender.js';

describe('ConsoleAppender', () => {
  let chunks;

  const buildAppender = (overrides = {}) => new ConsoleAppender(overrides);

  const sampleData = (overrides = {}) => ({
    m: 'hello',
    level: 'info',
    loggerName: 'myLogger',
    time: '10:30:00',
    datetime: '2024-01-15T10:30:00.000Z',
    ansiFgColor: '\x1b[38;2;0;0;0m',
    ...overrides,
  });

  const written = () => chunks.join('').replace(/\n$/, '');

  beforeEach(() => {
    chunks = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(typeof chunk === 'string' ? chunk : String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('does not throw when the constructor is called without arguments', () => {
      expect(() => new ConsoleAppender()).not.toThrow();
    });

    it('does not throw when format is undefined', () => {
      expect(() => buildAppender({ format: undefined })).not.toThrow();
    });

    it('does not throw when format is null', () => {
      expect(() => buildAppender({ format: null })).not.toThrow();
    });

    it('does not throw when an empty options object is passed', () => {
      expect(() => new ConsoleAppender({})).not.toThrow();
    });

    it('uses the default format when the constructor is called without arguments', () => {
      const appender = new ConsoleAppender();

      appender.append(sampleData());

      const output = written();
      expect(output).toContain('(myLogger)');
      expect(output).toContain('info');
      expect(output).toContain('hello');
      expect(output).toContain('[10:30:00]');
    });

    it('uses the default format when format is not passed', () => {
      const appender = buildAppender();

      appender.append(sampleData());

      const output = written();
      expect(output).toContain('(myLogger)');
      expect(output).toContain('info');
      expect(output).toContain('hello');
    });

    it('respects a custom format', () => {
      const appender = buildAppender({ format: '{{level}} => {{m}}' });

      appender.append(sampleData());

      expect(written()).toBe('info => hello');
    });
  });

  describe('append', () => {
    it('writes the formatted message exactly once per append', () => {
      const appender = buildAppender({ format: '{{m}}' });

      appender.append(sampleData({ loggerName: 'logger' }));

      expect(written()).toBe('hello');
    });

    it('writes only the formatted message to stdout', () => {
      const appender = buildAppender({ format: '{{loggerName}}: {{m}}' });

      appender.append({ m: 'boom', level: 'error', loggerName: 'api' });

      expect(written()).toBe('api: boom');
    });

    it('substitutes {{datetime}} with the value provided in the data dictionary', () => {
      const appender = buildAppender({ format: '{{datetime}}' });

      appender.append({ datetime: '2024-01-15T10:30:00.000Z' });

      const output = written();
      expect(output).not.toBe('{{datetime}}');
      expect(output).toContain('2024');
    });

    it('substitutes {{time}} with the value provided in the data dictionary', () => {
      const appender = buildAppender({ format: '{{time}}' });

      appender.append({ time: '10:30:00' });

      expect(written()).toBe('10:30:00');
    });

    it('leaves a placeholder literal if its key is missing from the data', () => {
      const appender = buildAppender({ format: '{{missing}}' });

      appender.append({});

      expect(written()).toBe('{{missing}}');
    });

    it('forwards any custom key present in the data dictionary', () => {
      const appender = buildAppender({ format: '{{custom}}' });

      appender.append({ custom: 'X' });

      expect(written()).toBe('X');
    });

    it('does not require message, level, or loggerName to be present', () => {
      const appender = buildAppender({ format: '{{custom}}' });

      expect(() => appender.append({ custom: 'only-custom' })).not.toThrow();
      expect(written()).toBe('only-custom');
    });

    it('writes multiple messages in order', () => {
      const appender = buildAppender({ format: '{{level}}: {{m}}\n' });

      appender.append({ m: 'first', level: 'info', loggerName: 'a' });
      appender.append({ m: 'second', level: 'error', loggerName: 'b' });

      expect(written()).toBe('info: first\nerror: second');
    });

    it('accepts an empty message', () => {
      const appender = buildAppender({ format: '{{m}}' });

      appender.append({ m: '', level: 'info', loggerName: 'logger' });

      expect(written()).toBe('');
    });

    it('works without options or a custom format', () => {
      const appender = new ConsoleAppender();

      appender.append(sampleData({ m: 'without options', level: 'warn', loggerName: 'root' }));

      const output = written();
      expect(output).toContain('(root)');
      expect(output).toContain('warn');
      expect(output).toContain('without options');
    });
  });
});
