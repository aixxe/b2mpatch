'use strict';

const vm = require('node:vm');
const log = require('npmlog');

class Sandbox
{
    /**
     * Create and configure an isolated environment.
     */
    constructor()
    {
        this.context = {
            // Expose a method to the sandbox for storing patches in this class.
            store: (fname, description, args) =>
            {
                this.patches.push({ fname, description, args });
                log.info('store', 'found %i patches for "%s" version "%s"', args.length, fname, description);
            }
        };

        vm.createContext(this.context);

        // Create bare minimum globals for getting the BemaniPatcher code to run.
        vm.runInContext(
            `// Invoke event listeners immediately.
            const window = { addEventListener: (type, callback) => callback() };
            
            // Copy patches into the sandbox.
            const Patcher = function(fname, description, args) { store(fname, description, args); };
            const PatchContainer = function(patchers) {};`,
        this.context);
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
        vm.runInContext(script, this.context);

        return this.patches;
    }
}

module.exports = Sandbox;