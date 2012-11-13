/**
 * Data module, responsible for retrieving and holding data used by other modules.
 * Data is retrieved through data sources, which are sub-modules of the data module.
 * Each data source retrieves data from an external resource, such as external APIs, the DOM or HTML5 APIs (such as the File API).
 * Data can be cache in localStorage to improve loading times on recurring uses from external APIs.
 * yox.data can be used independently as an easy interface to external API's.
 *
 * @constructor
 * @param options
 */
yox.data = function(options){
    this.data = [];
    this.options = $.extend(true, {}, this.defaults, options);

    var eventBus = this.options.eventBus || new yox.eventBus();
    $.extend(this, eventBus);

    if (this.options.events){
        for(var eventName in this.options.events)
            this.addEventListener(eventName, this.options.events[eventName]);
    }

    this.options.source && this.addSources(this.options.source);
}

yox.data.prototype = {
    defaults: {
        cache: false, // Set this to true to enable caching on localStorage. Cache is used only for external sources - it saves the data retrieved from the source (what's return from the source's load() method).
        sortFunction: null // A sorting function that's used when a source is loaded, on the source's items array. It's a regular array sorting function.
    },
    /**
     * Add sources to the data object.
     * When the added sources are finished loading (when all the data sources' load() methods calls their callbacks),
     * the 'loadSources' event is fired.
     *
     * @param {Object[]|Object} sourceArr An array of source data objects (or a single object) to add.
     */
    addSources: function(sourceArr, callback){
        var deferredPromises = [],
            sources = sourceArr instanceof Array ? sourceArr : arguments,
            self = this;

        this.triggerEvent("loadSourcesStart", sources);
        this.isLoading = true;

        for(var i=0, source; source = sources[i]; i++){
            var promise = this.loadSource(source);
            if (promise)
                deferredPromises.push(promise);
        }

        $.when.apply(this, deferredPromises).done(function () {
            var totalItemsCount = self.countItems(),
                dataSources = Array.prototype.slice.call(arguments, 0);

            for(var sourceIndex=0, source; sourceIndex < arguments.length; sourceIndex++){
                source = arguments[sourceIndex];
                source.id = self.data.length;
                source.parent = self;
                if (!source.paging || !source.paging.next)
                    self.triggerEvent("loadedLastPage");

                for(var itemIndex = 0, item; item = source.items[itemIndex]; itemIndex++){
                    item.id = ++totalItemsCount;
                    item.indexInSource = itemIndex;
                    item.source = source;
                    source.items[itemIndex] = new yox.data.item(item);
                }

                self.data.push(source);
            }

            self.isLoading = false;
            self.triggerEvent("loadSources", dataSources);

            callback && callback(dataSources)
        });
    },
    addNextSource: function(){
        if (this.data.length){
            var lastSource = this.data[this.data.length - 1];
            if (lastSource && lastSource.paging && lastSource.paging.next){
                this.addSources(lastSource.paging.next);
            }
        }
    },
    /**
     * Clears the data object of all data.
     * Triggers two events: 'removeSources', with the removed data, and 'clear', with no data.
     */
    clear: function(){
        this.triggerEvent("removeSources", this.data);
        this.triggerEvent("clear");
        this.data = [];
    },
    /**
     * Returns a count of the total items in the data object (from all sources).
     * @return {Number}
     */
    countItems: function(){
        var totalItemsCount = 0;
        for(var i=this.data.length; i--;){
            totalItemsCount += this.data[i].items.length;
        }

        return totalItemsCount;
    },
    /**
     * Given an object with source data (the same as given to the 'addSources' method or to the yox.data constructor),
     * returns the data source sub-module which matches the source data, using the data source's 'match' method.
     *
     * @param sourceData
     * @return {Object} The data source object that matches the source data, or null if none found.
     */
    findDataSource: function(sourceData){
        for(var dataSourceName in yox.data.sources){
            var dataSource = yox.data.sources[dataSourceName];

            if (dataSource.match(sourceData))
                return dataSource;
        }

        return null;
    },
    /**
     * Returns an array of sources holding the module's data.
     * @return {Array}
     */
    getData: function(){ return this.data; },
    /**
     * Returns a data source, by name, simply gets yox.data.sources[dataSourceName].
     * @param {String} dataSourceName The name of the data source, such as 'picasa', 'flickr' or 'html'.
     * @return {*}
     */
    getDataSource: function(dataSourceName){
        return yox.data.sources[dataSourceName];
    },
    /**
     * Returns an item, by its absolute index - taking into account all the sources in the data object.
     * @param itemIndex
     * @return {*}
     */
    getItem: function(itemIndex){
        var currentSourceItemsCount;
        for(var sourceItemsCount = 0, sourceIndex = 0, source; source = this.data[sourceIndex]; sourceIndex++){
            currentSourceItemsCount = source.items.length;
            if (itemIndex < sourceItemsCount + source.items.length)
                return source.items[itemIndex - sourceItemsCount];
            else
                sourceItemsCount = currentSourceItemsCount;
        }

        return null;
    },
    loadNews: function(){
        var deferreds = [],
            sourceDeferred,
            self = this;

        this.triggerEvent("loadSourcesStart");
        for(var sourceType in yox.data.sources){
            var source = yox.data.sources[sourceType];
            if (source.getNews){
                sourceDeferred = source.getNews();
                if (sourceDeferred)
                    deferreds.push(sourceDeferred);
            }
        }

        if (deferreds.length){
            $.when.apply(this, deferreds).done(function () {
                var allItems = [];
                for(var i= 0, sourceData; sourceData = arguments[i]; i++){
                    allItems = allItems.concat(sourceData.items);
                }

                allItems.sort(function(a,b){
                    return a.time < b.time;
                });

                self.triggerEvent("loadSources", [{
                    source: "news",
                    items: allItems,
                    sourceType: yox.data.sources.facebook,
                    createThumbnails: arguments[0].createThumbnails
                }]);
            });

            return true;
        }
        else
            return false;
    },
    /**
     * Given a valid source data (a matching data source sub-module is found), returns a jQuery Deferred object
     * which resolves once the load() method of the data source sub-module called its callback.
     *
     * @param {Object} source
     * @return {jQuery.Deferred} A jQuery.Deferred object, or null if no data source sub-module exists for the given data.
     */
    loadSource: function(source){
        var dataSource = source.type ? this.getDataSource(source.type) : this.findDataSource(source),
            self = this;

        if (!dataSource)
            return null;

        var dfd = $.Deferred(),
            onLoadSource = function(sourceData){
                if (self.options.sortFunction){
                    sourceData.items.sort(self.options.sortFunction);
                }

                sourceData.sourceType = dataSource;
                self.store(source, sourceData);
                dfd.resolve(sourceData);
            },
            savedSourceData = this.store(source);

        if (savedSourceData)
            onLoadSource(savedSourceData);
        else{
            // If a property map exists in the data source, convert properies in the data to the data source's own format:
            if (source.page && source.pageSize && source.offset === undefined){
                source.offset = source.pageSize * source.page;
            }

            if (dataSource.map){
                for(var mapProperty in dataSource.map){
                    var sourceProperty = source[mapProperty];
                    if (sourceProperty){
                        source[dataSource.map[mapProperty]] = sourceProperty;
                    }
                }
            }

            dataSource.load(source, onLoadSource,
                function(error){
                    dfd.reject();
                }
            )
        }
        return dfd;
    },
    /**
     * Replaces all data in the yox.data object with the given source(s).
     * @param {Object} sources One or more source data objects (for more than one, pass the method multiple params).
     */
    source: function(sources, callback){
        this.clear();
        this.addSources.apply(this, arguments);
    },
    /**
     * Saves or retrieves from localStorage a source's data object.
     * options.cache must be set to true and to use this method, otherwise it just returns false.
     * If there is no window.localStorage object, the method also returns false.
     * If no data is specified, the method returns the available data for the given source.
     *
     * @param {Object} source The source data object to store (defines the localStorage key name)
     * @param {object} data The source's data to save to localStorage.
     * @return {Boolean|Object} true: data was saved, false: the method failed, JSON: the retrieved data.
     */
    store: function(source, data){
        if (!this.options.cache || !window.localStorage || !source || !source.url)
            return false;

        var keyName = this.namespace + ".source." + source.url;

        if (!data){
            var item = window.localStorage.getItem(keyName);
            if (item)
                return JSON.parse(item);

            return null;
        }
        window.localStorage.setItem(keyName, JSON.stringify(data));
        return true;
    }
};