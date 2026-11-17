// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';

vi.mock('fs', () => ({
  createWriteStream: vi.fn(),
}));

import { createWriteStream } from 'fs';
import { PlainTextAppender } from '../../src/appenders/plainTextAppender.js';

describe('PlainTextAppender', () => {
  let mockStream;

  const buildAppender = (overrides = {}) => new PlainTextAppender({ filePath: 'test.log', ...overrides });

  const sampleData = (overrides = {}) => ({
    m: 'hello world',
    level: 'info',
    loggerName: 'myLogger',
    datetime: '2024-01-15T10:30:00.000Z',
    ...overrides,
  });

  const lastWrite = () => {
    const { calls } = mockStream.write.mock;
    return calls.at(-1)?.[0];
  };

  beforeEach(() => {
    mockStream = {
      write: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };
    createWriteStream.mockReturnValue(mockStream);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('creates the write stream with the given path', () => {
      buildAppender({ filePath: 'logs/app.log' });

      expect(createWriteStream).toHaveBeenCalledTimes(1);
      expect(createWriteStream).toHaveBeenCalledWith('logs/app.log', { flags: 'a' });
    });

    it('opens the stream in append mode so the file is not truncated', () => {
      buildAppender({ filePath: 'logs/app.log' });
      const [, options] = createWriteStream.mock.calls[0];
      expect(options).toMatchObject({ flags: 'a' });
    });

    it('throws TypeError when filePath is not provided', () => {
      expect(() => new PlainTextAppender({})).toThrow(TypeError);
      expect(() => new PlainTextAppender({})).toThrow(
        /Expected a string, received: undefined/,
      );
    });

    it('throws TypeError when filePath is not a string', () => {
      expect(() => new PlainTextAppender({ filePath: 123 })).toThrow(TypeError);
      expect(() => new PlainTextAppender({ filePath: 123 })).toThrow(
        /Expected a string, received: number/,
      );
    });

    it('does not throw when format is undefined', () => {
      expect(() => buildAppender({ format: undefined })).not.toThrow();
    });

    it('does not throw when format is null', () => {
      expect(() => buildAppender({ format: null })).not.toThrow();
    });
  });

  describe('append', () => {
    it('writes to the stream using the default format', () => {
      const appender = buildAppender();

      appender.append(sampleData());

      expect(mockStream.write).toHaveBeenCalledTimes(1);
      const written = lastWrite();
      expect(written).toContain('[info]');
      expect(written).toContain('myLogger');
      expect(written).toContain('hello world');
      expect(written.endsWith('\n')).toBe(true);
    });

    it('applies the default format when format is undefined', () => {
      const appender = buildAppender({ format: undefined });

      appender.append(sampleData({ m: 'msg', level: 'warn', loggerName: 'logger' }));

      expect(lastWrite()).toMatch(/\[warn\] logger - msg\n$/);
    });

    it('applies the default format when format is null', () => {
      const appender = buildAppender({ format: null });

      appender.append(sampleData({ m: 'msg', level: 'warn', loggerName: 'logger' }));

      expect(lastWrite()).toMatch(/\[warn\] logger - msg\n$/);
    });

    it('respects a custom format', () => {
      const appender = buildAppender({ format: '{{level}} => {{m}}' });

      appender.append(sampleData());

      expect(lastWrite()).toBe('info => hello world');
    });

    it('substitutes {{datetime}} with the value provided in the data dictionary', () => {
      const appender = buildAppender({ format: '{{datetime}}' });

      appender.append({ datetime: '2024-01-15T10:30:00.000Z' });

      expect(lastWrite()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('leaves a placeholder literal if its key is missing from the data', () => {
      const appender = buildAppender({ format: '{{missing}}' });

      appender.append({});

      expect(lastWrite()).toBe('{{missing}}');
    });

    it('forwards any custom key present in the data dictionary', () => {
      const appender = buildAppender({ format: '{{custom}}' });

      appender.append({ custom: 'X' });

      expect(lastWrite()).toBe('X');
    });

    it('writes multiple messages in order', () => {
      const appender = buildAppender({ format: '{{level}}: {{m}}' });

      appender.append({ m: 'first', level: 'info', loggerName: 'a' });
      appender.append({ m: 'second', level: 'error', loggerName: 'b' });

      expect(mockStream.write).toHaveBeenNthCalledWith(1, 'info: first');
      expect(mockStream.write).toHaveBeenNthCalledWith(2, 'error: second');
    });

    it('accepts an empty message', () => {
      const appender = buildAppender({ format: '{{m}}' });

      appender.append({ m: '', level: 'info', loggerName: 'logger' });

      expect(lastWrite()).toBe('');
    });

    it('propagates the loggerName correctly', () => {
      const appender = buildAppender({ format: '{{loggerName}}' });

      appender.append({ m: 'msg', level: 'info', loggerName: 'MyCustomLogger' });

      expect(lastWrite()).toBe('MyCustomLogger');
    });

    it('does not write when a template is provided but no data is passed', () => {
      const appender = buildAppender({ format: 'static' });

      appender.append({});

      expect(lastWrite()).toBe('static');
    });
  });

  describe('close', () => {
    it('closes the underlying stream', () => {
      const appender = buildAppender();

      appender.close();

      expect(mockStream.close).toHaveBeenCalledTimes(1);
    });

    it('is idempotent: closing multiple times does not throw', () => {
      const appender = buildAppender();

      appender.close();
      expect(() => appender.close()).not.toThrow();
    });

    it('does not write to the stream after close', () => {
      const appender = buildAppender({ format: '{{m}}' });

      appender.close();
      appender.append({ m: 'after closing', level: 'info', loggerName: 'logger' });

      expect(mockStream.write).not.toHaveBeenCalled();
    });
  });
});
