// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import {
  describe, it, expect,
} from 'vitest';
import { Appender, createTemplate } from '../../src/appenders/appender.js';

class TestAppender extends Appender {
  append(_data) {
    // No-op
  }
}

describe('createTemplate', () => {
  describe('templates without placeholders', () => {
    it('returns the same string', () => {
      expect(createTemplate('Hello World')({})).toBe('Hello World');
    });

    it('returns an empty string for an empty template', () => {
      expect(createTemplate('')({})).toBe('');
    });

    it('does not interpret single braces as placeholders', () => {
      expect(createTemplate('{ name }')({ name: 'John' })).toBe('{ name }');
    });

    it('does not interpret unbalanced braces', () => {
      expect(createTemplate('{{name}')({ name: 'John' })).toBe('{{name}');
      expect(createTemplate('{name}}')({ name: 'John' })).toBe('{name}}');
    });
  });

  describe('placeholder substitution', () => {
    it('replaces a single placeholder', () => {
      expect(createTemplate('Hello {{name}}')({ name: 'John' })).toBe('Hello John');
    });

    it('replaces multiple distinct placeholders', () => {
      expect(createTemplate('{{greeting}} {{name}}!')({ greeting: 'Hello', name: 'John' }))
        .toBe('Hello John!');
    });

    it('replaces all occurrences of the same placeholder', () => {
      expect(createTemplate('{{x}}-{{x}}-{{x}}')({ x: 'a' })).toBe('a-a-a');
    });

    it('handles adjacent placeholders without a separator', () => {
      expect(createTemplate('{{a}}{{b}}')({ a: '1', b: '2' })).toBe('12');
    });

    it('allows whitespace inside the braces', () => {
      expect(createTemplate('Hello {{ name }}')({ name: 'John' })).toBe('Hello John');
    });

    it('treats dotted keys as literal keys', () => {
      expect(createTemplate('{{a.b}}')({ 'a.b': 'value' })).toBe('value');
    });

    it('treats keys with dashes and underscores as literal', () => {
      expect(createTemplate('{{logger-name}}')({ 'logger-name': 'L' })).toBe('L');
      expect(createTemplate('{{logger_name}}')({ logger_name: 'L' })).toBe('L');
    });

    it('does not re-interpret the substituted value as a template', () => {
      const out = createTemplate('{{a}}')({ a: 'x{{b}}y', b: 'MUST NOT APPEAR' });
      expect(out).toBe('x{{b}}y');
    });

    it('does not perform double substitution in chained substitutions', () => {
      expect(createTemplate('{{a}}')({ a: '{{b}}' })).toBe('{{b}}');
    });
  });

  describe('value types', () => {
    it('converts numbers to string', () => {
      expect(createTemplate('{{n}}')({ n: 42 })).toBe('42');
    });

    it('converts 0 to "0" (not an empty string)', () => {
      expect(createTemplate('{{n}}')({ n: 0 })).toBe('0');
    });

    it('converts false to "false" (not an empty string)', () => {
      expect(createTemplate('{{b}}')({ b: false })).toBe('false');
    });

    it('preserves newlines and quotes in the value', () => {
      expect(createTemplate('"{{x}}"')({ x: 'a\nb' })).toBe('"a\nb"');
    });
  });

  describe('missing key', () => {
    it('must not write "undefined" in the output', () => {
      const out = createTemplate('Hello {{name}}')({});
      expect(out).not.toContain('undefined');
    });

    it('must not substitute "null" when the key is missing', () => {
      const out = createTemplate('{{x}}')({});
      expect(out).not.toContain('null');
    });

    // Adjust to the policy you decide on:
    it('leaves the placeholder literal when the key is missing', () => {
      expect(createTemplate('Hello {{name}}')({})).toBe('Hello {{name}}');
      // Alternative: toBe('Hello ') if you decide to substitute with empty.
    });
  });

  describe('special characters', () => {
    it('does not interpret regex metacharacters in the template', () => {
      expect(createTemplate('a.b*c+d?{{x}}')({ x: 'V' })).toBe('a.b*c+d?V');
    });

    it('allows newlines and quotes in the template', () => {
      expect(createTemplate('a\n"{{x}}"\n')({ x: 'V' })).toBe('a\n"V"\n');
    });

    it('is not confused by braces inside the value', () => {
      expect(createTemplate('pre {{x}} post')({ x: '{inline}' })).toBe('pre {inline} post');
    });
  });
});

describe('Appender', () => {
  describe('abstract contract', () => {
    it('does not allow instantiating the base class directly', () => {
      expect(() => new Appender('{{m}}')).toThrow(TypeError);
    });

    it('throws the documented message when instantiating the base class', () => {
      expect(() => new Appender('')).toThrow(
        'The Appender class is abstract and cannot be instantiated directly.',
      );
    });

    it('the base class append() is not a silent no-op', () => {
      class EmptyAppender extends Appender {}
      const appender = new EmptyAppender('{{m}}');
      expect(() => appender.append({ m: 'msg', level: 'info', loggerName: 'logger' })).toThrow(
        'The method "append" must be implemented in the subclass.',
      );
    });

    it('a subclass that overrides append() can be used without throwing', () => {
      const appender = new TestAppender('{{m}}');
      expect(() => appender.append({ m: 'msg', level: 'info', loggerName: 'logger' })).not.toThrow();
    });
  });

  describe('formatMessage · substitution', () => {
    it('substitutes message, level, and logger name', () => {
      const appender = new TestAppender('{{m}}|{{level}}|{{loggerName}}');
      expect(appender.formatMessage({ m: 'hi', level: 'info', loggerName: 'L' })).toBe('hi|info|L');
    });

    it('respects the order and layout of the template', () => {
      const appender = new TestAppender('[{{level}}] {{loggerName}}: {{m}}');
      expect(appender.formatMessage({ m: 'hi', level: 'warn', loggerName: 'L' })).toBe('[warn] L: hi');
    });

    it('substitutes all occurrences of the same placeholder', () => {
      const appender = new TestAppender('{{m}}-{{m}}-{{m}}');
      expect(appender.formatMessage({ m: 'x', level: 'info', loggerName: 'L' })).toBe('x-x-x');
    });

    it('handles adjacent placeholders', () => {
      const appender = new TestAppender('{{m}}{{level}}{{loggerName}}');
      expect(appender.formatMessage({ m: 'a', level: 'b', loggerName: 'c' })).toBe('abc');
    });

    it('accepts whitespace inside the braces', () => {
      const appender = new TestAppender('{{ m }}|{{ level }}');
      expect(appender.formatMessage({ m: 'hi', level: 'info' })).toBe('hi|info');
    });

    it('returns the template intact if it has no placeholders', () => {
      const appender = new TestAppender('static text');
      expect(appender.formatMessage({ m: 'hi', level: 'info', loggerName: 'L' })).toBe('static text');
    });

    it('returns an empty string if the template is empty', () => {
      const appender = new TestAppender('');
      expect(appender.formatMessage({ m: 'hi', level: 'info', loggerName: 'L' })).toBe('');
    });

    it('handles empty message, level, and loggerName', () => {
      const appender = new TestAppender('{{m}}|{{level}}|{{loggerName}}');
      expect(appender.formatMessage({ m: '', level: '', loggerName: '' })).toBe('||');
    });

    it('preserves special characters in the message', () => {
      const appender = new TestAppender('{{m}}');
      expect(appender.formatMessage({ m: 'a\tb\n"c"', level: 'info', loggerName: 'L' })).toBe('a\tb\n"c"');
    });

    it('does not re-interpret the message as a template', () => {
      const appender = new TestAppender('{{m}}');
      expect(appender.formatMessage({ m: '{{level}}', level: 'info', loggerName: 'L' })).toBe('{{level}}');
    });

    it('leaves an unknown placeholder literal', () => {
      const appender = new TestAppender('a{{unknown}}b');
      expect(appender.formatMessage({ m: 'hi', level: 'info', loggerName: 'L' })).toBe('a{{unknown}}b');
    });

    it('leaves placeholders literal when the dictionary is empty', () => {
      const appender = new TestAppender('{{m}}|{{level}}');
      expect(appender.formatMessage({})).toBe('{{m}}|{{level}}');
    });

    it('substitutes any key present in the data dictionary', () => {
      const appender = new TestAppender('{{custom}} {{date}}');
      expect(appender.formatMessage({ custom: 'C', date: '2024-01-01' })).toBe('C 2024-01-01');
    });

    it('ignores extra keys that are not in the template', () => {
      const appender = new TestAppender('{{m}}');
      expect(appender.formatMessage({ m: 'hi', extra: 'ignored' })).toBe('hi');
    });

    it('converts non-string values to string', () => {
      const appender = new TestAppender('{{m}}|{{n}}|{{b}}');
      expect(appender.formatMessage({ m: 'hi', n: 0, b: false })).toBe('hi|0|false');
    });

    it('does not mutate the data dictionary', () => {
      const appender = new TestAppender('{{m}}');
      const data = { m: 'hi' };
      appender.formatMessage(data);
      expect(data).toEqual({ m: 'hi' });
    });

    it('is deterministic for the same input', () => {
      const appender = new TestAppender(
        '{{m}}|{{level}}|{{loggerName}}|{{date}}|{{time}}',
      );
      const data = {
        m: 'hi', level: 'info', loggerName: 'L', date: '2024-01-01', time: '12:00:00',
      };
      expect(appender.formatMessage(data)).toBe(appender.formatMessage(data));
    });
  });
});
