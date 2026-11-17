// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import {
  describe, it, expect,
} from 'vitest';

import {
  hexToForeGroundColor,
  hexToBackGroundColor,
} from '../src/colors.js';
import { LogManagerConfigError } from '../src/errors.js';

describe('hexToForeGroundColor', () => {
  describe('valid colors', () => {
    it('converts #RRGGBB to an ANSI foreground sequence', () => {
      expect(hexToForeGroundColor('#FF0000')).toBe('\x1b[38;2;255;0;0m');
    });

    it('converts #RGB shorthand by duplicating each digit', () => {
      expect(hexToForeGroundColor('#F00')).toBe('\x1b[38;2;255;0;0m');
    });

    it.each([
      ['#FF0000'],
      ['FF0000'],
      ['#F00'],
      ['F00'],
    ])('accepts %s', (color) => {
      expect(hexToForeGroundColor(color)).toBe('\x1b[38;2;255;0;0m');
    });

    it('accepts lowercase and mixed-case hex digits', () => {
      expect(hexToForeGroundColor('#ff0000')).toBe('\x1b[38;2;255;0;0m');
      expect(hexToForeGroundColor('#FfAa00')).toBe('\x1b[38;2;255;170;0m');
    });

    it('converts black', () => {
      expect(hexToForeGroundColor('#000000')).toBe('\x1b[38;2;0;0;0m');
      expect(hexToForeGroundColor('#000')).toBe('\x1b[38;2;0;0;0m');
    });

    it('converts white', () => {
      expect(hexToForeGroundColor('#FFFFFF')).toBe('\x1b[38;2;255;255;255m');
    });

    it('converts an arbitrary color', () => {
      expect(hexToForeGroundColor('#ABCDEF')).toBe('\x1b[38;2;171;205;239m');
    });
  });

  describe('invalid input', () => {
    it('throws TypeError when the color is not a string', () => {
      [123, null, undefined, {}, [], true].forEach((value) => {
        expect(() => hexToForeGroundColor(value)).toThrow(TypeError);
      });
    });

    it('reports the received type in the TypeError message', () => {
      expect(() => hexToForeGroundColor(123)).toThrow(/Expected a string, received: number/);
    });

    it.each([
      ['not-a-color'],
      [''],
      ['#'],
      ['#GGGGGG'],
      ['#12345'],
      ['#1234567'],
      ['GGG'],
      ['red'],
    ])('throws LogManagerConfigError for %j', (color) => {
      expect(() => hexToForeGroundColor(color)).toThrow(LogManagerConfigError);
    });

    it('includes the offending value in the error message', () => {
      expect(() => hexToForeGroundColor('not-a-color')).toThrow(
        /Invalid hexadecimal color: "not-a-color"/,
      );
    });
  });
});

describe('hexToBackGroundColor', () => {
  describe('valid colors', () => {
    it('converts #RRGGBB to an ANSI background sequence', () => {
      expect(hexToBackGroundColor('#FF0000')).toBe('\x1b[48;2;255;0;0m');
    });

    it('converts #RGB shorthand by duplicating each digit', () => {
      expect(hexToBackGroundColor('#F00')).toBe('\x1b[48;2;255;0;0m');
    });

    it.each([
      ['#FF0000'],
      ['FF0000'],
      ['#F00'],
      ['F00'],
    ])('accepts %s', (color) => {
      expect(hexToBackGroundColor(color)).toBe('\x1b[48;2;255;0;0m');
    });

    it('accepts lowercase and mixed-case hex digits', () => {
      expect(hexToBackGroundColor('#ff0000')).toBe('\x1b[48;2;255;0;0m');
      expect(hexToBackGroundColor('#FfAa00')).toBe('\x1b[48;2;255;170;0m');
    });

    it('converts black', () => {
      expect(hexToBackGroundColor('#000000')).toBe('\x1b[48;2;0;0;0m');
      expect(hexToBackGroundColor('#000')).toBe('\x1b[48;2;0;0;0m');
    });

    it('converts white', () => {
      expect(hexToBackGroundColor('#FFFFFF')).toBe('\x1b[48;2;255;255;255m');
    });

    it('converts an arbitrary color', () => {
      expect(hexToBackGroundColor('#ABCDEF')).toBe('\x1b[48;2;171;205;239m');
    });
  });

  describe('invalid input', () => {
    it('throws TypeError when the color is not a string', () => {
      [123, null, undefined, {}, [], true].forEach((value) => {
        expect(() => hexToBackGroundColor(value)).toThrow(TypeError);
      });
    });

    it('reports the received type in the TypeError message', () => {
      expect(() => hexToBackGroundColor(123)).toThrow(/Expected a string, received: number/);
    });

    it.each([
      ['not-a-color'],
      [''],
      ['#'],
      ['#GGGGGG'],
      ['#12345'],
      ['#1234567'],
      ['GGG'],
      ['red'],
    ])('throws LogManagerConfigError for %j', (color) => {
      expect(() => hexToBackGroundColor(color)).toThrow(LogManagerConfigError);
    });

    it('includes the offending value in the error message', () => {
      expect(() => hexToBackGroundColor('not-a-color')).toThrow(
        /Invalid hexadecimal color: "not-a-color"/,
      );
    });
  });

  it('solo difiere del color de primer plano en el prefijo ANSI', () => {
    expect(hexToBackGroundColor('#123456')).toBe(
      hexToForeGroundColor('#123456').replace('[38;', '[48;'),
    );
  });
});
