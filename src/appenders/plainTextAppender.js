// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import { createWriteStream } from 'fs';
import { Appender } from './appender.js';

const DEFAULT_FORMAT = '{{datetime}} [{{level}}] {{loggerName}} - {{m}}\n';

export class PlainTextAppender extends Appender {
  #fileStream;

  /**
   * @param {Object} options The constructor options.
   * @param {string} options.filePath The file path.
   * @param {string} [options.format] The format for each message type.
   */
  constructor({ format, filePath }) {
    if (typeof filePath !== 'string') {
      throw new TypeError(`Expected a string, received: ${typeof filePath}`);
    }
    super(format ?? DEFAULT_FORMAT);
    this.#fileStream = createWriteStream(filePath, { flags: 'a' });
  }

  /**
   * Appends a message to the console.
   *
   * @param {Record<string, string>} data The pre-built log data.
   */
  append(data) {
    this.#fileStream.write(this.formatMessage(data));
  }

  /**
   * Closes the underlying file stream and disables further appends.
   */
  close() {
    this.#fileStream.close();
    this.append = () => {};
  }
}
