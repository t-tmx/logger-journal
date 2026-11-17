# logger-journal

A zero-dependency, TypeScript-friendly logging library featuring hierarchical loggers, customizable colored levels, and pluggable appenders.

[![npm version](https://img.shields.io/npm/v/logger-journal.svg)](https://www.npmjs.com/package/logger-journal)
[![npm downloads](https://img.shields.io/npm/dm/logger-journal.svg)](https://www.npmjs.com/package/logger-journal)
[![license](https://img.shields.io/npm/l/logger-journal.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Zero dependencies.**
- **Customizable levels.** Define your own level names, severities, and colors.
- **Hierarchical loggers.** `app.db.queries` inherits configuration from `app.db` and `app`.
- **Pluggable appenders.** Console and plain-text file built in, plus a simple base class for your own.
- **Format templates.** Compose log lines with placeholders like `{{time}}`, `{{level}}`, `{{ansiFgColor}}`, and more.
- **TypeScript-first.** Logger methods are inferred from the configured levels.

## Installation

```bash
npm install logger-journal
```

## Quick start

```js
import { LogManager } from 'logger-journal';

const logManager = new LogManager();
const logger = logManager.getLogger('main');

logger.info('Hello World!');
```

Output:

<pre style="background-color: #1e1e1e; color: #d4d4d4; padding: 1em; border-radius: 6px; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 0.9em; line-height: 1.4;">
<span style="color: #808080;">[12:43:09] (main)</span> <span style="color: #00c8ff;">info:</span> Hello World!
</pre>

With no configuration, every level goes to the console through a `ConsoleAppender` with sensible defaults.

## A bit more

Configure levels, appenders, and per-logger thresholds:

```js
import { LogManager, ConsoleAppender, PlainTextAppender } from 'logger-journal';

const logManager = new LogManager({
  appenders: {
    console: new ConsoleAppender(),
    file: new PlainTextAppender({ filePath: './app.log' }),
  },
  root: { level: 'info', appenders: ['console', 'file'] },
  loggers: {
    'app.db': { level: 'debug' }, // console + file, inherited from root
  },
});

const log = logManager.getLogger('app.db');
log.debug('emitted: app.db has a debug threshold');
```

Or plug in your own appender:

```js
import { Appender } from 'logger-journal';

export class JsonAppender extends Appender {
  constructor() {
    super('{"level":"{{level}}","logger":"{{loggerName}}","message":"{{m}}"}');
  }

  append(message, type, loggerName) {
    process.stdout.write(`${this.formatMessage(message, type, loggerName)}\n`);
  }
}
```

## API

Public exports: `LogManager`, `Appender`, `ConsoleAppender`, `PlainTextAppender`, `LogManagerConfigError`.

See the [full API documentation](./docs/api.md) for levels, format placeholders, appender lifecycle, hierarchical configuration, and every option.

## Compatibility

- Node.js (dual ESM / CommonJS support).
- TypeScript typings bundled.

## License

[Apache-2.0](./LICENSE) © @t-tmx