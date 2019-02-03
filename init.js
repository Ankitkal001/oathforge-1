const fs = require('fs');

// This check ensures this is the first compilation run
if (!fs.existsSync('./node_modules')) {

// Required symlink with real node_modules directory. Easier thank copying only required modules.
    fs.symlinkSync('../node_modules', './node_modules');

}
