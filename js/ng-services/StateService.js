angular.module('StateModule', ["PathModule", "ApisModule"])
    .factory('state', function(path, apis) {
        var currentMode = "home", // home / thumbnails / albums / view / login
            eventBus = new yox.eventBus(),
            stateHistory = [],
            currentSource,
            viewOpen = false;

        function getLastHistory(property){
            if (stateHistory.length){
                var lastHistory = stateHistory[stateHistory.length - 1];
                if (property)
                    return lastHistory[property];

                return lastHistory;
            }
            return null;
        }
        function setSource(source, callback){
            if (typeof(source) === "String")
                source = yox.data.sources[source];

            if (!currentSource || currentSource !== source){
                currentSource = source;
                eventBus.triggerEvent("sourceChange", { source: currentSource });
                callback && callback(currentSource);
            }

            callback && callback();
        }

        function loadFeed(feed, callback){
            var sourceData = $.extend({ type: currentSource.name }, feed);
            if (feed.hasChildren)
                apis.albums.data.source(sourceData, callback);
            else
                apis.thumbnails.data.source(sourceData, callback);

            eventBus.triggerEvent("feedChange", { feed: feed });
        }

        function setFeed(feed, callback){
            if (!currentSource)
                throw new Error("Can set feed without source.");

            if (currentSource.requireAuth){
                currentSource.isLoggedIn(function(isLoggedIn){
                    if (!isLoggedIn){
                        currentMode = "login";
                        eventBus.triggerEvent("modeChange", { mode: "login" });
                    }
                    else
                        loadFeed(feed, callback);
                });
            }
            else
                loadFeed(feed, callback);
        }

        function getPathState(state){
            return {
                source: state.source && state.source.name,
                feed: state.feed && state.feed.id,
                view: state.view,
                itemIndex: state.itemIndex,
                home: state.home || !state.source
            }
        }

        var public = {
            get mode(){
                return currentMode;
            },
            onFeedChange: eventBus.getEventPair("feedChange"),
            onModeChange: eventBus.getEventPair("modeChange"),
            onSourceChange: eventBus.getEventPair("sourceChange"),
            onViewStateChange: eventBus.getEventPair("viewStateChange"),
            setState: function(state){
                if (!state.source && state.feed)
                    state.source = currentSource;

                if (state.source){
                    setSource(state.source, function(newSource){
                        var feed = state.feed || newSource && newSource.feeds[0];
                        if (feed){
                            var newMode;
                            if (feed.hasChildren && currentMode !== "albums")
                                newMode = "albums";
                            else if (!feed.hasChildren && currentMode !== "thumbnails")
                                newMode = "thumbnails";

                            function doSetFeed(){
                                setFeed(feed, function(){
                                    if (state.view && currentMode === "thumbnails"){
                                        currentMode = "view";
                                        eventBus.triggerEvent("modeChange", { mode: "view" });
                                        eventBus.triggerEvent("viewStateChange", { isOpen: true });
                                        setTimeout(function(){
                                            apis.viewer.modules.view.selectItem(state.itemIndex || 0);
                                        }, 1);
                                    }
                                });
                            }

                            if (newMode){
                                if (currentMode === "view")
                                    eventBus.triggerEvent("viewStateChange", { isOpen: false });

                                currentMode = newMode;
                                eventBus.triggerEvent("modeChange", { mode: newMode });
                                // When a mode changes, it's necessary to wait until the UI changes before loading data, to avoid a situation where the thumbnails are not displayed and get a width/height of 0.
                                setTimeout(doSetFeed, 1);
                            }
                            else
                                doSetFeed();
                        }
                    });
                }

                path.pushState(getPathState(state));
            }
        };

        return public;
    });