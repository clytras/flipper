/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import chalk from 'chalk';
import path from 'path';
import {startFlipperServer} from './startFlipperServer';
import {startBaseServer} from './startBaseServer';
import {startSocketServer} from './startSocketServer';
import {startWebServerDev} from './startWebServerDev';

import yargs from 'yargs';
import open from 'open';
import {sleep} from 'flipper-common';

const argv = yargs
  .usage('yarn flipper-server [args]')
  .options({
    port: {
      describe: 'Port to serve on',
      type: 'number',
      default: 52342,
    },
    bundler: {
      describe:
        'Serve the UI bundle from source. This option only works for source checkouts',
      type: 'boolean',
      default: false,
    },
    open: {
      describe: 'Open Flipper in the default browser after starting',
      type: 'boolean',
      default: true,
    },
  })
  .version('DEV')
  .help()
  .parse(process.argv.slice(1));

console.log(
  `Starting flipper server with ${
    argv.bundler ? 'UI bundle from source' : 'pre-bundled UI'
  }`,
);

const rootDir = argv.bundler
  ? path.resolve(__dirname, '..', '..')
  : path.resolve(__dirname, '..'); // in pre packaged versions of the server, static is copied inside the package
const staticDir = path.join(rootDir, 'static');

async function start() {
  // supress debug messages by default. TODO: make CLI flag
  console.debug = function () {
    // Noop
  };

  const {app, server, socket} = await startBaseServer({
    port: argv.port,
    staticDir,
    entry: 'index.web.dev.html',
  });

  const [flipperServer] = await Promise.all([
    startFlipperServer(rootDir, staticDir),
    argv.bundler ? startWebServerDev(app, server, socket, rootDir) : undefined,
  ]);

  startSocketServer(flipperServer, socket);
}

start()
  .then(() => {
    const url = `http://localhost:${argv.port}/index.web${
      argv.bundler ? '.dev' : ''
    }.html`;
    console.log('Flipper server started at ' + chalk.green(chalk.bold(url)));
    if (argv.open) {
      sleep(1000);
      open(url);
    }
  })
  .catch((e) => {
    console.error(chalk.red('Server error: '), e);
    process.exit(1);
  });
