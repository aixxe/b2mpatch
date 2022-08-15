#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const log = require('npmlog');
const path = require('node:path');
const axios = require('axios');
const { program } = require('commander');
const sanitize = require('sanitize-filename');
const parse = require('./src/parser');
const convert = require('./src/converter');
const Sandbox = require('./src/sandbox');

program.name('b2mpatch')
    .description('Converts patches from BemaniPatcher to mempatch-hook format')
    .requiredOption('--dir <dir...>', 'directory containing executables to patch')
    .requiredOption('--url <url...>', 'full URL to a BemaniPatcher page')
    .option('-o, --output <dir>', 'directory to write output files to', '.')
    .parse();

(async () => {
    const sandbox = new Sandbox();
    const options = program.opts();

    if (options.url.length !== options.dir.length)
        return console.error('--url and --dir must have the same number of arguments');

    if (!fs.existsSync(options.output))
        fs.mkdirSync(options.output, { recursive: true });

    for (let i = 0; i < options.url.length; ++i)
    {
        const url = options.url[i];
        const dir = options.dir[i];

        log.info('query', 'querying patches from %s', url);

        const response = await axios.get(url)
            .catch(error => log.error('query', 'get url "%s" failed: %s', url, error.message));

        if (!response)
            continue;

        const script = parse(response.data);

        for (const patch of sandbox.run(script))
        {
            const result = await convert(dir, patch);

            if (!result || result.length === 0)
                continue;

            const filename = sanitize(`${patch.description}.${patch.fname}.mph`);
            const output = path.resolve(options.output, filename);

            log.info('convert', 'writing patch file "%s"...', output);
            fs.writeFileSync(output, result);
        }
    }
})();