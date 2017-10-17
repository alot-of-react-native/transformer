/** Copyright (c) 2017-present, Aaron Friel.
 *
 * This is a fork of metro-bundler/src/transformer.js
 *
 */

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * Note: This is a fork of the fb-specific transform.js
 *
 * @flow
 * @format
 */
import { TransformOptions } from 'babel-core';
import babel = require('babel-core');
import generate from 'babel-generator';
import externalHelpersPlugin = require('babel-plugin-external-helpers');
import inlineRequiresPlugin = require('babel-preset-fbjs/plugins/inline-requires');
import makeHMRConfig = require('babel-preset-react-native/configs/hmr');
import resolvePlugins = require('babel-preset-react-native/lib/resolvePlugins');
import crypto = require('crypto');
import fs = require('fs');
import json5 = require('json5');
import path = require('path');

import { Options, Params, Transformer } from './Types';

// @ts-ignore
import {compactMapping} from 'metro-bundler/src/Bundler/source-map';

const cacheKeyParts = [
  fs.readFileSync(__filename),
  // tslint:disable-next-line:no-var-requires
  require('babel-plugin-external-helpers/package.json').version,
  // tslint:disable-next-line:no-var-requires
  require('babel-preset-fbjs/package.json').version,
  // tslint:disable-next-line:no-var-requires
  require('babel-preset-react-native/package.json').version,
];

// tslint:disable-next-line:no-any
type BabelPlugins = any[];

/**
 * Return a memoized function that checks for the existence of a
 * project level .babelrc file, and if it doesn't exist, reads the
 * default RN babelrc file and uses that.
 */
const getBabelRC = (() => {
  let babelRC: TransformOptions | null = null;

  return function _getBabelRC(projectRoot: string) {
    if (babelRC !== null) {
      return babelRC;
    }

    babelRC = {plugins: []};
    let projectBabelRCPath;

    if (projectRoot) {
      // Let's look in the platform target folder first.
      if (typeof process.env.PLATFORM_TARGET === 'string') {
        projectBabelRCPath = path.resolve(projectRoot, process.env.PLATFORM_TARGET, '.babelrc');
      }

      // Let's look for the .babelrc in the project root.
      // In the future let's look into adding a command line option to specify
      // this location.
      if (!projectBabelRCPath || !fs.existsSync(projectBabelRCPath)) {
        if (projectRoot) {
          projectBabelRCPath = path.resolve(projectRoot, '.babelrc');
        }
      }
    }

    // If a .babelrc file doesn't exist in the project,
    // use the Babel config provided with react-native.
    if (!projectBabelRCPath || !fs.existsSync(projectBabelRCPath)) {
      babelRC = json5.parse(
        fs.readFileSync(require.resolve('metro-bundler/rn-babelrc.json')),
      );

      if (babelRC == null || babelRC.presets == null) {
        throw new Error('Error: unable to load rn-babelrc.json');
      }

      // Require the babel-preset's listed in the default babel config
      babelRC.presets = babelRC.presets.map((preset: string) =>
        // $FlowFixMe: dynamic require can't be avoided
        require('babel-preset-' + preset),
      );
      babelRC.plugins = resolvePlugins(babelRC.plugins);
    } else {
      // if we find a .babelrc file we tell babel to use it
      babelRC.extends = projectBabelRCPath;
    }

    return babelRC;
  };
})();

/**
 * Given a filename and options, build a Babel
 * config object with the appropriate plugins.
 */
function buildBabelConfig(filename: string, options: Options) {
  const babelRC = getBabelRC(options.projectRoot);

  const extraConfig = {
    babelrc:
      typeof options.enableBabelRCLookup === 'boolean'
        ? options.enableBabelRCLookup
        : true,
    code: false,
    filename,
  };

  let config = {...babelRC, ...extraConfig};

  // Add extra plugins
  const extraPlugins = [externalHelpersPlugin];

  const inlineRequires = options.inlineRequires;
  const blacklist =
    typeof inlineRequires === 'object' ? inlineRequires.blacklist : null;
  if (inlineRequires && !(blacklist && filename in blacklist)) {
    extraPlugins.push(inlineRequiresPlugin);
  }

  config.plugins = extraPlugins.concat(config.plugins);

  if (options.dev && options.hot) {
    const hmrConfig = makeHMRConfig(options, filename);
    config = {...config, ...hmrConfig};
  }

  return {...babelRC, ...config};
}

export function transform({filename, options, src}: Params<{retainLines?: boolean}>) {
  options = options || {platform: '', projectRoot: '', inlineRequires: false};

  const OLD_BABEL_ENV = process.env.BABEL_ENV;
  process.env.BABEL_ENV = options.dev ? 'development' : 'production';

  try {
    const babelConfig = buildBabelConfig(filename, options);
    const {ast, ignored} = babel.transform(src, babelConfig);

    if (ignored) {
      return {
        ast: null,
        code: src,
        filename,
        map: null,
      };
    } else {
      const result = generate(
        ast,
        {
          comments: false,
          compact: false,
          filename,
          retainLines: !!options.retainLines,
          sourceFileName: filename,
          sourceMaps: true,
        },
        src,
      );

      return {
        ast,
        code: result.code,
        filename,
        map: options.generateSourceMaps
          ? result.map
          : result.rawMappings.map(compactMapping),
      };
    }
  } finally {
    process.env.BABEL_ENV = OLD_BABEL_ENV;
  }
}

export function getCacheKey() {
  const key = crypto.createHash('md5');
  cacheKeyParts.forEach((part) => key.update(part));
  return key.digest('hex');
}
