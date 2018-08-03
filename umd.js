// this file helps in mapping umd module names to path

var UMD = {

    viewPrefix: "web",

    mapConfig: {

    },

    map: function(config, configValue) {
        if (typeof config === "object") {
            for (var key in config) {
                if (config.hasOwnProperty(key)) {
                    var element = config[key];
                    if (element.endsWith("/")){
                        element = element.substr(0, element.length - 1);
                    }
                    this.mapConfig[key] = element;
                }
            }
            return;
        }
        if (configValue.endsWith("/")){
            configValue = configValue.substr(0, configValue.length - 1);
        }
        this.mapConfig[config] = configValue;
    },

    resolvePath: function (path) {
        var firstChar = path[0];
        if (firstChar === "/" || firstChar === ".") {
            return path;
        }
        if (/(http|https)\:\/\//.test(path)) {
            return path;
        }
        var tokens = path.split("/");
        var package = tokens[0];
        tokens[0] = this.mapConfig[package];
        return tokens.join("/");
    },

    resolveViewPath: function(path) {
        return path.replace("{platform}", this.viewPrefix);
    },

    resolveViewClassAsync: function(path) {
        path = this.resolveViewPath(path);
        return new Promise(function (resolve, reject) {
            SystemJS.import(path)
                .then(function(r) {
                    resolve(r.default);
                })
                .catch(function(r) {
                    reject(r);
                });
        });
    },

    setup: function() {
        var config = {
            defaultExtensions: "js",
            format: "amd",
            map: {},
            meta: {

            },
            packages: {
                '.': {
                    defaultExtensions: "js",
                    format: "amd"
                }, 
            }
        };

        for (var key in this.mapConfig) {
            if (this.mapConfig.hasOwnProperty(key)) {
                var element = this.mapConfig[key];
                config.map[key] = element;

                config.packages[config.map[key]] = {
                    defaultExtensions: "js",
                    format: "amd"
                };
            }
        }

        config.meta[config.map["reflect-metadata"]] = {
            format: "global",
            exports: "Reflect"
        };

        SystemJS.config(config);

        this._initialized = true;
    },

    load: function(path, designMode) {
        if (!this._initialized) {
            this.setup();
        }

        return SystemJS.import("web-atoms-core/dist/Atom").then(function (a) {
            a.Atom.designMode = designMode;
            return SystemJS.import(path);
        });
    },

    loadView: function(path, designMode, appPath) {
        this.load(appPath || "web-atoms-core/dist/web/WebApp").then(function(m) {
            SystemJS.import("web-atoms-core/dist/Atom").then(function (a) {
                a.Atom.designMode = designMode;
                var app = new (m.default)();
                app.onReady(function(){
                    SystemJS.import(path).then(function(c) {
                        var ctrl = new (c.default)(app);
                        app.root = ctrl;
                    });
                });
            });
        });
    }
};

