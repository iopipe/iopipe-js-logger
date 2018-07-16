# IOpipe JS Logger Plugin

[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

This is a logging plugin for use with [IOpipe](https://iopipe.com) and AWS Lambda. Automatically records output from `console` for viewing in the IOpipe dashboard.

## Installation

With [yarn](https://yarnpkg.com/) (recommended) in project directory:

`yarn add @iopipe/logger`

With npm in project directory:

`npm install @iopipe/logger`

Then include the plugin with IOpipe in your serverless function:

```js
const iopipeLib = require('@iopipe/iopipe');
const logger = require('@iopipe/logger');

const iopipe = iopipeLib({
  token: process.env.IOPIPE_TOKEN,
  plugins: [logger({ enabled: true })]
});

exports.handler = iopipe(async (event) => {
  console.log('This will show up in IOpipe!');
  // supported methods include log, debug, info, warn, error, and dir
  return 'Hello world!'
});
```

## Config

#### `enabled` (bool: optional = false)

By default, this plugin is disabled. To automatically record output of calls to `console`, set this value to `true`. You can also use an environment variable like this: `IOPIPE_LOGGER_ENABLED=true`.

## License

Apache-2.0 see [LICENSE](https://www.apache.org/licenses/LICENSE-2.0.html)

Copyright 2018, IOpipe, Inc.
