'use strict';

const ivm = require('isolated-vm');
const log = require('npmlog');

class Sandbox
{
    /**
     * Create and configure an isolated environment.
     */
    constructor()
    {
        this.patches = [];

        this.isolate = new ivm.Isolate();
        this.context = this.isolate.createContextSync();

        // Expose a method to the sandbox for storing patches in this class.
        this.context.global.setSync('store', (fname, description, args) =>
        {
            this.patches.push({ fname, description, args });
            log.info('store', 'found %i patches for "%s" version "%s"', args.length, fname, description);
        });

        // Create bare minimum globals for getting the BemaniPatcher code to run.
        this.context.evalSync(
            `// Invoke event listeners immediately.
            const window = { addEventListener: (type, callback) => callback() };
            
            // Copy patches into the sandbox.
            const Patcher = function(fname, description, args) { store(fname, description, args); };
            const PatchContainer = function(patchers) {};`
        );
    }

    /**
     * Run BemaniPatcher code in the isolated environment.
     *
     * @param script Code to initialise patchers.
     * @returns {array}
     */
    run = (script) =>
    {
        this.patches = [];
        this.context.evalSync(script);

        return this.patches;
    }
}

module.exports = Sandbox;