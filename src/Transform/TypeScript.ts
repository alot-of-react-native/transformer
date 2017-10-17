/**
 *
 */

import * as appRootPath from 'app-root-path';
import * as jju from 'jju';
import { SourceMapConsumer, SourceMapGenerator } from 'source-map';
import * as ts from 'typescript';

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as upstream from './Babel';
import { CacheKeyFn, Params, Transformer, TransformFn } from './Types';

const TSCONFIG_PATH = process.env.TSCONFIG_PATH;

function loadJsonFile(jsonFilename: string) {
  if (!fs.existsSync(jsonFilename)) {
    throw new Error(`Input file not found: ${jsonFilename}`);
  }

  const buffer = fs.readFileSync(jsonFilename);
  try {
    return jju.parse(buffer.toString());
  } catch (error) {
    throw new Error(
      `Error reading "${jsonFilename}":${os.EOL}  ${error.message}`,
    );
  }
}

function composeRawSourceMap(tsMap, babelMap) {
  const tsConsumer = new SourceMapConsumer(tsMap);
  const composedMap = [];
  babelMap.forEach(
    ([generatedLine, generatedColumn, originalLine, originalColumn, name]) => {
      if (originalLine) {
        const tsOriginal = tsConsumer.originalPositionFor({
          column: originalColumn,
          line: originalLine,
        });
        if (tsOriginal.line) {
          if (typeof name === 'string') {
            composedMap.push([
              generatedLine,
              generatedColumn,
              tsOriginal.line,
              tsOriginal.column,
              name,
            ]);
          } else {
            composedMap.push([
              generatedLine,
              generatedColumn,
              tsOriginal.line,
              tsOriginal.column,
            ]);
          }
        }
      }
    },
  );
  return composedMap;
}

function composeSourceMaps(tsMap, babelMap, tsFileName, tsContent, babelCode) {
  const tsConsumer = new SourceMapConsumer(tsMap);
  const babelConsumer = new SourceMapConsumer(babelMap);
  const map = new SourceMapGenerator();
  map.setSourceContent(tsFileName, tsContent);
  babelConsumer.eachMapping(
    ({
      source,
      generatedLine,
      generatedColumn,
      originalLine,
      originalColumn,
      name,
    }) => {
      if (originalLine) {
        const original = tsConsumer.originalPositionFor({
          column: originalColumn,
          line: originalLine,
        });
        if (original.line) {
          map.addMapping({
            generated: { line: generatedLine, column: generatedColumn },
            name,
            original: { line: original.line, column: original.column },
            source: tsFileName,
          });
        }
      }
    },
  );
  // @ts-ignore
  return map.toJSON();
}

const tsConfig = (() => {
  if (TSCONFIG_PATH) {
    const resolvedTsconfigPath = path.resolve(TSCONFIG_PATH);
    if (fs.existsSync(resolvedTsconfigPath)) {
      return loadJsonFile(resolvedTsconfigPath);
    }
    console.warn(
      'tsconfig file specified by TSCONFIG_PATH environment variable was not found',
    );
    console.warn(`TSCONFIG_PATH = ${TSCONFIG_PATH}`);
    console.warn(`resolved = ${resolvedTsconfigPath}`);
    console.warn('looking in app root directory');
    throw TSCONFIG_PATH;
  }

  // Attempt platform target resolution next:
  if (typeof process.env.PLATFORM_TARGET === 'string') {
    const tsConfigPath = appRootPath.resolve(path.join(process.env.PLATFORM_TARGET, 'tsconfig.json'));
    if (fs.existsSync(tsConfigPath)) {
      return loadJsonFile(tsConfigPath);
    }

    console.warn('PLATFORM_TARGET specified but no tsconfig.json was found.');
    console.warn(`PLATFORM_TARGET = ${process.env.PLATFORM_TARGET}`);
    console.warn(`resolved path = ${tsConfigPath}`);
  }

  {
    const tsConfigPath = appRootPath.resolve('tsconfig.json');
    if (fs.existsSync(tsConfigPath)) {
      return loadJsonFile(tsConfigPath);
    }

    throw new Error(`Unable to find tsconfig.json at ${tsConfigPath}`);
  }
})();

const compilerOptions = {
  ...tsConfig.compilerOptions,
  inlineSources: true,
  sourceMap: true,
};

export let transform: TransformFn = ({src, filename, options}) => {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) {
    const tsCompileResult = ts.transpileModule(src, {
      compilerOptions,
      fileName: filename,
      reportDiagnostics: true,
    });

    const errors = tsCompileResult.diagnostics.filter(
      ({ category }) => category === ts.DiagnosticCategory.Error,
    );

    if (errors.length) {
      // report first error
      const error = errors[0];
      const message = ts.flattenDiagnosticMessageText(error.messageText, '\n');
      if (error.file) {
        const { line, character } = error.file.getLineAndCharacterOfPosition(
          error.start,
        );
        if (error.file.fileName === 'module.ts') {
          console.error({ error, filename, options });
        }
        throw new Error(
          `${error.file.fileName} (${line + 1},${character + 1}): ${message}`,
        );
      } else {
        throw new Error(message);
      }
    }

    const babelCompileResult = upstream.transform({
      filename,
      options,
      src: tsCompileResult.outputText,
    });

    const composedMap = Array.isArray(babelCompileResult.map)
      ? composeRawSourceMap(
          tsCompileResult.sourceMapText,
          babelCompileResult.map,
        )
      : composeSourceMaps(
          tsCompileResult.sourceMapText,
          babelCompileResult.map,
          filename,
          src,
          babelCompileResult.code,
        );

    return {...babelCompileResult,
            map: composedMap};
  } else {
    return upstream.transform({ src, filename, options });
  }
}

export let getCacheKey: CacheKeyFn = () => {
  const cacheKeyParts = [
    fs.readFileSync(__filename),
    upstream.getCacheKey(),
  ];

  const key = crypto.createHash('md5');
  cacheKeyParts.forEach((part) => key.update(part));
  return key.digest('hex');
}
