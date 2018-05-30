
var modules = {
    require: require,
    exports: {}
};

function require(name){
    return modules[name];
}

var pending = {};

function define(requires, factory, name){
    var hasAll = true;
    for(var i = 0; i < requires.length ; i++){
        var item = requires[i];
        item = bridge.resolveName(name, item);
        if(!modules[item]){
            hasAll = false;
            if(!pending[item]){
                var fx = function(){
                    define(requires, factory, item);
                };
                pending[item] = fx;
                bridge.executeScript(item, fx);
            }
        }
    }

    if(hasAll) {
        var mExports = {};
        factory(require,mExports);
        modules[name || "exports"] = mExports;
    }
}

define.amd = true;