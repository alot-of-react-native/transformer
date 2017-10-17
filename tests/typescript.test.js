import fs from 'fs';
import path from 'path';

process.env.PLATFORM_TARGET = 'tests';
const transformer = require('../dist');
const FIXTURES = '__fixtures__';

const GOOD_FIXTURES_DIR = path.join(__dirname, FIXTURES, 'good');
const BAD_FIXTURES_DIR = path.join(__dirname, FIXTURES, 'bad');

describe('@alot/transformer', () => {
  fs.readdirSync(GOOD_FIXTURES_DIR).forEach(fixture => {
    const filename = path.join(GOOD_FIXTURES_DIR, fixture);
    if (fs.statSync(filename).isFile()) {
      it(`transpiles ${filename}`, () => {
        const src = fs.readFileSync(filename, { encoding: 'utf8' });
        const result = transformer.transform({src, filename, options: {}});
        expect(result.code).toMatchSnapshot();
        expect(result.map).toMatchSnapshot();
      });
    }
  });
});
