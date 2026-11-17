// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

import { Appender } from './appender.js';

const DEFAULT_FORMAT = '\x1b[90m[{{time}}] ({{loggerName}})\x1b[0m {{ansiFgColor}}{{level}}:\x1b[0m {{m}}\n';

export class ConsoleAppender extends Appender {
  /**
   * @param {{ format?: string }} [options] The constructor options.
   */
  constructor(options = {}) {
    const format = options.format ?? DEFAULT_FORMAT;
    super(format);
  }

  /**
   * Appends a message to the console.
   *
   * @param {Record<string, string>} data The pre-built log data.
   */
  append(data) {
    process.stdout.write(this.formatMessage(data));
  }
}
