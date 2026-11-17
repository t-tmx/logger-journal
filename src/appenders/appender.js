// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

/**
 * A fragment of a compiled template.
 *
 * @typedef {string | { key: string }} Fragment
 */

/**
 * Compiles a template string to optimize the replacement process.
 *
 * @param {string} templateString The template string to compile.
 * @returns {(data: Record<string, any>) => string} A function that renders the template with the provided data.
 */
export const createTemplate = (templateString) => {
  const regex = /\{\{\s*([\w.-]+)\s*\}\}/g;

  /** @type {Fragment[]} */
  const fragments = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(templateString)) !== null) {
    fragments.push(templateString.slice(lastIndex, match.index));
    fragments.push({ key: match[1] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < templateString.length) {
    fragments.push(templateString.slice(lastIndex));
  }

  return (data) => {
    let result = '';
    for (let i = 0; i < fragments.length; ++i) {
      const fragment = fragments[i];
      if (typeof fragment === 'string') {
        result += fragment;
      } else {
        const value = data[fragment.key];
        result += value ?? `{{${fragment.key}}}`;
      }
    }

    return result;
  };
};

/**
 * Abstract class with common methods used by other appenders.
 */
export class Appender {
  /**
   * Formats a message using the pre-built data dictionary.
   *
   * @type {(data: Record<string, string>) => string}
   */
  formatMessage;

  /**
   * @param {string} format How to format the logs.
   */
  constructor(format) {
    if (new.target === Appender) {
      throw new TypeError(
        'The Appender class is abstract and cannot be instantiated directly.',
      );
    }

    this.formatMessage = /** @type {(data: Record<string, string>) => string} */ (
      createTemplate(format)
    );
  }

  /**
   * @param {Record<string, string>} _data Pre-built data dictionary.
   */
  append(_data) {
    throw new Error('The method "append" must be implemented in the subclass.');
  }
}
