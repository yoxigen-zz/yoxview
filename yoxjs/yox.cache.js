yox.cache = function(options){
    this.options = options || {};
    this.data = {};
    this.id = options.id;
};

yox.cache.prototype = {
    getKey: function(keyName){
        return ["yox_cache", this.id, keyName].join("_");
    },
    getItem: function(keyName, options){
        var dataStr = localStorage.getItem(this.getKey(keyName));

        if (!dataStr)
            return null;

        var dataObj = JSON.parse(dataStr);

        if (dataObj && dataObj.expires && dataObj.expires < new Date().valueOf()){
            this.removeItem(keyName);
            return null;
        }

        var data = dataObj && dataObj.data;

        if (options && options.hold)
            this.data[keyName] = data;

        return data;
    },
    removeItem: function(keyName){
        localStorage.removeItem(this.getKey(keyName));
        if (this.data[keyName])
            delete this.data[keyName];
    },
    setItem: function(keyName, data, options){
        options = options || {};
        var storageData = { data: data };
        if (options.expires)
            storageData.expires = options.expires;
        else if (options.expiresIn)
            storageData.expires = new Date().valueOf() + options.expiresIn * 1000;

        localStorage.setItem(this.getKey(keyName), JSON.stringify(storageData));
        if (options.hold)
            this.data[keyName] = data;
    }
};