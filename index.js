const fs = require('fs');
const path = require('path');
const { stat } = require('@allegiant/common');

async function serveStatic(conn) {
    if (!conn.writable) {
        conn.status = 500;
        return false;
    }

    //transform for static file in the webroot path    
    conn.uri = conn.uri + (conn.uri.slice(-1) == '/' ? 'index.html' : '');
    conn.fname = path.join(this.webRoot, conn.uri);

    conn.stat = await stat(conn.fname);
    if (conn.stat === false) {
        console.log(conn.uri + " :: 404 Doesn't exist"); // eslint-disable-line

        conn.status = 404;
        return false;
    }

    if (conn.stat.isDirectory()) {
        console.log(conn.uri + " :: Directory Read Attempt: "); // eslint-disable-line
        conn.status = 403;

        return false;
    }

    conn.setHeader('Content-Type', conn.mime.type(path.extname(conn.fname), 'utf8'));
    if (cacheControl(conn))
        return false;

    conn.status = 200;
    conn.setHeader('Last-Modified', conn.stat.mtime.toUTCString());
    conn.setHeader('Content-Length', conn.stat.size);

    return conn.streamReadable(fs.createReadStream(conn.fname));
}

function nocache(conn) {
    conn.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    conn.setHeader('Expires', '-1');
    conn.setHeader('Pragma', 'no-cache');
}

function cacheControl(conn) {
    var cControl = conn.headers['cache-control'] || null;
    var modifiedDate = conn.headers['if-modified-since'] || null;

    if (cControl == 'no-cache') {
        nocache(conn);
    } else if (modifiedDate != null)  {
        modifiedDate = new Date(modifiedDate);

        // diff check for time < 0 should be cached: hasn't been modified since the time requested
        var diff = modifiedDate.getTime() - conn.stat.mtime.getTime();
        if (diff <= 0) {
           conn.setHeader('Last-Modified', conn.stat.mtime.toUTCString());
           conn.status = 304;
           return true;
        }
    }

    return false;
}

function configure(app, options=false) {
    var config = {};

    config.required = { '@allegiant/mime': true };
    config.enabled = (typeof options === 'boolean') ? options :
                     (typeof options === 'object' && typeof options.enabled === 'boolean') ? options.enabled : false;
    config.webRoot = (typeof options === 'object' && typeof options.webRoot !== 'undefined') ? options.webroot :
                     path.resolve(path.join(process.cwd(), 'www'));

    if (config.enabled) {
        config.bind = function(app) {
            app.on('serve', serveStatic.bind(config), 'static');
        };
    }

    return config;
}

exports = module.exports = {
    serveStatic: serveStatic,
    cacheControl: cacheControl,
    nocache: nocache,
    Configure: configure
};
