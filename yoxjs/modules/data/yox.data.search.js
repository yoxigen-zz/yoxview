yox.data.search = (function(){
    var searchSources,
        eventBus;

    function init(){
        var source;

        searchSources = [];
        eventBus = new yox.eventBus();

        for(var sourceName in yox.data.sources){
            source = yox.data.sources[sourceName];
            if (source.search)
                searchSources.push(source);
        }
    }

    var public = {
        abortSearch: function(){
            for(var i= 0, source; source = searchSources[i]; i++){
                source.abortSearch();
            }
        },
        onResults: {
            addListener: function(handler){
                if (!eventBus)
                    init();

                eventBus.addEventListener("onResults", handler);
            },
            removeListener: function(handler){
                eventBus.removeEventListener("onResults", handler);
            }
        },
        search: function(term, options){
            if (!searchSources)
                init();

            function searchSource(source){
                searchDeferreds = source.search(term, options || {});
                for(var deferredIndex = 0; deferredIndex < searchDeferreds.length; deferredIndex++){
                    searchDeferreds[deferredIndex].done(function(results){
                        eventBus.triggerEvent("onResults", $.extend({ term: term, source: source }, results));
                    });
                }
            }

            var searchDeferreds;
            for(var i= 0, source; source = searchSources[i]; i++){
                searchSource(source);
            }
        }
    };

    return public;
})();