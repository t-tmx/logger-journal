# API

Public API reference for `logger-journal`, a logging library for JavaScript and TypeScript. Ships ESM, CommonJS, and bundled type declarations. This page covers the exported classes, configuration, and how levels and appenders work together.

## Quick start

```js
import { LogManager, ConsoleAppender } from 'logger-journal';

const logManager = new LogManager({
  appenders: { console: new ConsoleAppender() },
  root: { level: 'info', appenders: ['console'] },
});

const log = logManager.getLogger('app');
log.info('Server started'); // printed
log.debug('Not printed');   // dropped: debug is above the info threshold
```

## Table of contents

- [Overview](#overview)
- [LogManager](#logmanager)
- [Levels](#levels)
- [Configuration](#configuration)
- [Logger instances](#logger-instances)
- [Appenders](#appenders)
- [Full example](#full-example)

## Overview

The package exports the classes needed to configure logging, two ready-to-use appenders, a base class for custom appenders, and the configuration error type:

- **`LogManager`**: the main entry point. It creates and configures loggers.
- **`ConsoleAppender`**: an appender that writes to the console.
- **`PlainTextAppender`**: an appender that writes to a text file.
- **`Appender`**: an abstract base class for implementing custom appenders.
- **`LogManagerConfigError`**: the error thrown by `LogManager` for invalid configuration.

```js
import {
  LogManager,
  ConsoleAppender,
  PlainTextAppender,
  Appender,
  LogManagerConfigError,
} from 'logger-journal';
```

## LogManager

`LogManager` is the entry point. Create one instance, configure it once, and request loggers from it.

### `new LogManager([config])`

`config` and every field inside it are optional.

| Option | Type | Description |
| --- | --- | --- |
| `levels` | `Record<string, { color: string, severity: number }>` | Available logging levels. |
| `appenders` | `Record<string, Appender>` | Named appenders that loggers reference. |
| `root` | `{ level?: string \| null, appenders?: string[] }` | Configuration for the root logger. |
| `loggers` | `Record<string, { level?: string \| null, appenders?: string[] }>` | Per-logger configurations, keyed by name. |

If `config` or `root` is omitted, the root logger writes to a `ConsoleAppender` at the most verbose level. See [Defaults](#defaults) for every fallback and [Levels](#levels) for validation rules.

### `getLogger(name)`

Returns the logger for `name`, creating and caching it on first call. The name appears as `{{loggerName}}` in format strings and determines the effective configuration through the hierarchy described in [Configuration](#configuration).

## Levels

Default levels:

| Level | `severity` | `color` |
| --- | --- | --- |
| `fatal` | `0` | `#bb1e4d` |
| `error` | `1` | `#ff0000` |
| `warn` | `2` | `#efc408` |
| `info` | `3` | `#00c8ff` |
| `debug` | `4` | `#fafa85` |
| `trace` | `5` | `#4f4f4f` |

### How severity works

`severity` orders the levels. **Lower numbers are more severe.** The configured level is a threshold: a message is emitted when its severity is **less than or equal to** the threshold.

With a `warn` threshold (severity `2`), the logger emits `fatal` (0), `error` (1), and `warn` (2). It drops `info` (3), `debug` (4), and `trace` (5).

### Custom levels

Pass your own `levels` object to replace the defaults entirely. Each entry needs a `color` and a numeric `severity`, and severities must be unique:

```js
new LogManager({
  levels: {
    fatal:   { color: '#bb1e4d', severity: 0 },
    error:   { color: '#ff0000', severity: 1 },
    warn:    { color: '#efc408', severity: 2 },
    info:    { color: '#00c8ff', severity: 3 },
    debug:   { color: '#fafa85', severity: 4 },
    trace:   { color: '#4f4f4f', severity: 5 },
    verbose: { color: '#888888', severity: 6 },
  },
  // ...
});
```

Custom levels appear as methods on every logger, e.g. `log.verbose('…')` and `log.isVerboseEnabled()`.

### Validation

`LogManager` throws at construction time. Invalid severities raise native errors:

- A `severity` is not a number (`TypeError`) or is negative (`RangeError`).

Everything else raises a `LogManagerConfigError` — a subclass of `Error`, exported by the package, with a `code` property:

- No levels are provided (`ERR_EMPTY_LEVELS`).
- Two levels share the same severity (`ERR_DUPLICATE_SEVERITY`).
- A level has no `color` (`ERR_MISSING_COLOR`).
- A logger references an unknown level (`ERR_UNKNOWN_LEVEL`) or an unknown appender (`ERR_UNKNOWN_APPENDER`).

## Configuration

Configuration has two parts: `root`, which applies to every logger, and `loggers`, which overrides settings for specific names.

### Root

`root` configures the root logger. Every logger inherits from it.

- `level`: a level name, or `null` to disable output.
- `appenders`: a list of appender names from the `appenders` dictionary.

### Logger configurations

Names containing dots form a hierarchy. `app`, `app.db`, and `app.db.queries` are ancestors and descendants of each other.

The effective configuration for a logger is built in this order:

1. Start with the `root` configuration.
2. Apply the `loggers` entry of the most general ancestor, if any.
3. Apply each more specific ancestor, ending with the logger itself.

For `app.db.queries`, the entries for `app`, then `app.db`, then `app.db.queries` are applied in that order.

Rules for each property:

- **`level` and `appenders` are inherited independently.** A logger that defines only `level` keeps the inherited appenders, and vice versa.
- **Setting `appenders` replaces the inherited list.** Lists are never merged.
- **`level: null` disables the logger and all its descendants.**

### Disabled loggers

A logger with an empty appender list produces no output. Setting `level: null` also empties the appender list, so a descendant of a disabled logger stays silent unless you define both `level` and `appenders` on it.

```js
loggers: {
  app: { level: null }, // disables app and everything below it
  'app.db': {  // re-enabled explicitly
    level: 'info', 
    appenders: ['console'] 
  },
}
```

### Defaults

| Omitted field | Default |
| --- | --- |
| `config` entirely, or `config` without `root` | A `ConsoleAppender` at the most verbose level |
| `root.level` | The most verbose level |
| `root.appenders` (when `root` is provided) | An empty list (output disabled) |

Because `root.appenders` defaults to an empty list, if you define `root` you should also pass `appenders`; otherwise the root logger produces no output.

## Logger instances

Each level adds two methods to the logger:

| Method | Description |
| --- | --- |
| `<level>(message)` | Writes `message` to every appender of the logger, if the level is enabled. |
| `is<Level>Enabled()` | Returns `true` if the level is emitted with the current threshold. |

With the default levels the logger exposes `fatal`, `error`, `warn`, `info`, `debug`, `trace`, plus `isFatalEnabled`, `isErrorEnabled`, `isWarnEnabled`, `isInfoEnabled`, `isDebugEnabled`, and `isTraceEnabled`.

The method name capitalizes the first letter of the level. A custom level named `verbose` creates `verbose(message)` and `isVerboseEnabled()`.

A disabled logger (empty appender list) turns every method into a no-op and every `is<Level>Enabled` into `false`.

In TypeScript, the logger type is generated from the levels configuration, so it only exposes the methods for the defined levels.

## Appenders

The `appenders` option maps names to appender instances. Names are used in `root.appenders` and `loggers[...].appenders`. Every value must be an `Appender` instance (or subclass); otherwise a `TypeError` is thrown at construction.

Loggers pass a pre-built data object to `append`. It already contains the resolved message, level, logger name, date fields, and the level colors — appenders never need to know about levels or colors directly.

### Data object

The object passed to `append` and `formatMessage`:

| Key | Value |
| --- | --- |
| `date` | Local date (`toLocaleDateString`). |
| `datetime` | Local date and time (`toLocaleString`). |
| `time` | Local time (`toLocaleTimeString`). |
| `pid` | Process ID (`PID`). |
| `hostname` | Host name (`HOSTNAME`). |
| `m` | Message. |
| `loggerName` | Logger name. |
| `level` | Level name. |
| `hexColor` | Level color in hexadecimal. |
| `ansiFgColor` | ANSI foreground color sequence. |
| `ansiBgColor` | ANSI background color sequence. |

### `Appender`

Abstract base class for appenders. `new Appender(...)` throws a `TypeError`; extend it to create your own.

#### `new Appender(format)`

Subclasses must call `super(format)` with a template string.

#### `formatMessage(data)`

Renders the template with the data object and returns the resulting string. Templates use `{{name}}` placeholders; whitespace inside the braces is ignored, so `{{ level }}` and `{{level}}` are equivalent. Unknown placeholders are left unchanged.

#### `append(data)`

Abstract method every subclass must implement. The base implementation throws. Implementations decide where the log goes: console, file, network, and so on.

### `ConsoleAppender`

Writes each message with `process.stdout.write`. The default format shows the time in gray, the logger name in parentheses, the level in its color followed by a colon, and the message, with a trailing newline.

```js
import { ConsoleAppender } from 'logger-journal';

const appender = new ConsoleAppender();
```

`options.format` is optional:

```js
new ConsoleAppender({
  format: '[{{time}}] {{ansiFgColor}}{{level}}\x1b[0m {{m}}\n',
});
```

> [!NOTE]
> `\x1b[0m` resets the color after the level; without it, the level color bleeds into the rest of the line. The format is written as-is, so it must end with `\n` to separate messages.

### `PlainTextAppender`

Writes to a text file opened in append mode. Existing content is not truncated.

| Option | Type | Description |
| --- | --- | --- |
| `filePath` | `string` | File path. Required; a non-string value throws a `TypeError`. |
| `format` | `string` | Template. Defaults to `'{{datetime}} [{{level}}] {{loggerName}} - {{m}}\n'`. |

```js
import { PlainTextAppender } from 'logger-journal';

const appender = new PlainTextAppender({ filePath: './app.log' });
// ...
appender.close();
```

`close()` closes the underlying stream and disables further writes. Because the appender uses a stream, writes are asynchronous: a message may not reach the file if the process exits immediately after a log call.

### Creating custom appenders

Extend `Appender`, call `super` with a template, and implement `append`.

```js
import { Appender } from 'logger-journal';

export class JsonAppender extends Appender {
  constructor() {
    super('{"time":"{{datetime}}","level":"{{level}}","logger":"{{loggerName}}","message":"{{m}}"}');
  }

  append(data) {
    process.stdout.write(`${this.formatMessage(data)}\n`);
  }
}
```

Register it like any built-in appender:

```js
import { LogManager } from 'logger-journal';
import { JsonAppender } from './jsonAppender.js';

const logManager = new LogManager({
  appenders: { json: new JsonAppender() },
  root: { level: 'debug', appenders: ['json'] },
});
```

Notes:

- ANSI placeholders write escape sequences. Avoid them in formats meant for files.
- `LogManager` does not manage appender lifecycle. If your appender opens resources, expose a `close()` method and call it explicitly.

## Full example

```js
import { LogManager, ConsoleAppender } from 'logger-journal';

const logManager = new LogManager({
  appenders: {
    console: new ConsoleAppender(),
  },
  root: { level: 'info', appenders: ['console'] },
  loggers: {
    'app.db': { level: 'debug' },
    'app.db.queries': { level: 'trace' },
  },
});

const log = logManager.getLogger('app.db');
if (log.isDebugEnabled()) { // true
  /* expensive operation: runs only when debug is enabled, to avoid hurting performance */
  log.debug('emitted: app.db has a debug threshold');
}
log.info('emitted');

// 'app' has no entry, so it inherits the info threshold from root.
logManager.getLogger('app').warn('emitted: inherits the info threshold from root');
logManager.getLogger('app').debug('not emitted: debug is above the info threshold');
```