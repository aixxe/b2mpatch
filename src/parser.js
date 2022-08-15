'use strict';

const cheerio = require('cheerio');
const log = require('npmlog');

/**
 * Filter script tags for something resembling patcher code.
 *
 * @param html A <script> block containing some JavaScript.
 * @returns {string|null}
 */
module.exports = function(html)
{
    const $ = cheerio.load(html);
    const result = [];

    for (const script of $('script').get())
    {
        const html = $(script).html();

        if (!html.includes('new PatchContainer'))
            continue;

        if (!html.includes('new Patcher'))
            continue;

        log.info('parse', 'discovered patcher code block of size %d', html.length);

        result.push(html);
    }

    return result.join("\n");
};