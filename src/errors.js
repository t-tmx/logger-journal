// Copyright 2026 @t-tmx
// SPDX-License-Identifier: Apache-2.0

/**
 * Error thrown when the LogManager configuration is invalid.
 */
export class LogManagerConfigError extends Error {
  /**
   * @param {string} message The error message.
   * @param {{ code: string } & Record<string, unknown>} [details] The error code and additional context.
   */
  constructor(message, details = { code: 'ERR_LOG_MANAGER_CONFIG' }) {
    super(message);
    this.name = 'LogManagerConfigError';
    Object.assign(this, details);
  }
}
