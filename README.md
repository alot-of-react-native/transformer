# @alot/transformer

Use TypeScript and ES6+ directly in your React Native projects.

This is a fork of
[ds300/react-native-typescript-transformer](https://github.com/ds300/react-native-typescript-transformer/)
and [facebook/metro-bundler](https://github.com/facebook/metro-bundler) with an
extra environment variable, `PLATFORM_TARGET`. See <a
href="#platform-specific-builds">Platform Specific Builds</a> for more
information.

# Usage

 1. Add as a dependency:

       yarn add --dev @alot/transformer

 2. Create a `tsconfig.json` configuration in your app root if you haven't
    already, for example:

    ```json
    {
      "compilerOptions": {
        "target": "es2015",
        "jsx": "react",
        "noEmit": true,
        "moduleResolution": "node"
      },
      "exclude": [
        "node_modules"
      ]
    }
    ```

 3. Modify or create a `rn-cli.config.js` in your app to define
    `getTransformModulePath` and `getSourceExts`, as follows:

    ```js
    module.exports = {
      getTransformModulePath() {
        return require.resolve('@alot/transformer')
      },
      getSourceExts() {
        return ['ts', 'tsx'];
      }
    }
    ```

 4. That's it, add `.ts` and `.tsx` files to your project and `React Native`
    will load them!

# Platform specific builds

You might wish to specify different `tsconfig.json` or `.babelrc` configurations
for different platform targets, one for `android`, one for `web`, and so on. Set
an environment variable `PLATFORM_TARGET` before running your build to search
for these configuration files in that folder. If `.babelrc` and `tsconfig.json`
aren't found there, the app root will be searched afterward.

An example `package.json` script might look like:

```json
  {
    "scripts": {
      "expo": "cross-env PLATFORM_TARGET=expo react-native-scripts start --reset-cache"
    }
  }
```

This will cause the transformer to search the `expo` folder for `.babelrc` and
`tsconfig.json`. This might be necessary because
[expo](https://github.com/expo/expo-sdk) uses a custom babel configuration,
which might be incompatible with other platforms.


# Smaller bundles with `tslib`

Instead of defining helper functions in each transpiled module, TypeScript can
use a shared library like Babel's use of a polyfill library.

 1. Add tslib:

    `yarn add tslib`

 2. Add `"importHelpers": "true"` to the `compilerOptions` of your
    `tsconfig.json`:


    ```diff
     {
      "compilerOptions": {
        ...
    +    "importHelpers": true,
        ...
      }
     }
    ```
