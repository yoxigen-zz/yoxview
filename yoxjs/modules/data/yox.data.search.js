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
	        options = options || {};
            if (!searchSources)
                init();

            function searchSource(source){
	            for(var searchType in source.search){
		            if (!options.types || ~options.types.indexOf(searchType)){
			            source.search[searchType](term, options).done(function(results){
				            eventBus.triggerEvent("onResults", $.extend({ term: term, source: source }, results));
			            });
		            }
	            }
            }

            for(var i= 0, source; source = searchSources[i]; i++){
                searchSource(source);
            }
        }
    };

    return public;
})();