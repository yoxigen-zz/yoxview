angular.module('StateModule', ["PathModule"])
    .factory('state', function(path) {
        var currentMode = "home", // home / thumbnails / albums / view / login
            eventBus = new yox.eventBus(),
            stateHistory = [],
            currentSource,
            currentFeed,
            currentUser,
            viewOpen = false,
            maxHistory = 20,
            setLastStateOnPop;

        function init(){
            function setInitialState(){
                var initialState = path.getFeedDataFromUrl();

                if (initialState){
                    public.setState(initialState, false);
                }


                path.onPopState.addListener(function(pathState){
                    if (setLastStateOnPop){
                        public.setState(stateHistory.pop(), false);
                        setLastStateOnPop = false;
                    }
                    else if (pathState)
                        public.setState(pathState, false);
                });
            }
            function onInitialState(){
                window.removeEventListener("popstate", onInitialState, false);
                setTimeout(setInitialState, 5);
            }

            if (!~navigator.userAgent.indexOf("Chrome")){
                setTimeout(function(){
                    setInitialState();
                }, 5);
            }
            else
                window.addEventListener("popstate", onInitialState, false);
        }

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
            if (typeof(source) === "string")
                source = yox.data.sources[source];

            if (!currentSource || currentSource !== source){
                currentSource = source;
                eventBus.triggerEvent("sourceChange", { source: currentSource });
                callback && callback(currentSource);
            }
            else if (callback)
                callback();
        }

        function loadFeed(feed, callback){
            if (currentFeed !== feed){
                var sourceData = $.extend({ type: currentSource.name }, feed);
                eventBus.triggerEvent("feedChange", { feed: sourceData, onLoad: callback });
                currentFeed = feed;
            }
        }
        function feedAuthAndLoad(feed, callback){
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
                home: state.home || !state.source,
                user: state.user || currentUser && currentUser.id
            }
        }

        function setFeed(feed, state){
            if (typeof(feed) === "string"){
                var feeds = currentUser ? currentSource.getUserFeeds(currentUser) : currentSource.feeds;
                for(var feedIndex = 0, sourceFeed; sourceFeed = feeds[feedIndex]; feedIndex++){
                    if (sourceFeed.id === feed){
                        feed = sourceFeed;
                        break;
                    }
                }
            }

            if (feed && Object(feed) === feed){
                var newMode;
                if (feed.hasChildren && currentMode !== "albums")
                    newMode = "albums";
                else if (!feed.hasChildren && currentMode !== "thumbnails")
                    newMode = "thumbnails";

                if (newMode){
                    currentMode = newMode;
                    eventBus.triggerEvent("modeChange", { mode: newMode });
                    // When a mode changes, it's necessary to wait until the UI changes before loading data, to avoid a situation where the thumbnails are not displayed and get a width/height of 0.
                    setTimeout(doSetFeed, 1);
                }
                else
                    doSetFeed();

                function doSetFeed(){
                    feedAuthAndLoad(feed, function(){
                        console.log("loaded feed: ", feed);
                        if (state.view && currentMode === "thumbnails"){
                            currentMode = "view";
                            eventBus.triggerEvent("modeChange", { mode: "view" });
                        }
                        else if (!state.view && currentMode === "view"){
                            currentMode = "thumbnails";
                            eventBus.triggerEvent("modeChange", { mode: currentMode });
                        }
                    });
                }
            }
        }

        var public = {
            back: function(){
                stateHistory.pop();
                setLastStateOnPop = true;
                path.back();
            },
            get mode(){
                return currentMode;
            },
            onFeedChange: eventBus.getEventPair("feedChange"),
            onModeChange: eventBus.getEventPair("modeChange"),
            onSourceChange: eventBus.getEventPair("sourceChange"),
	        onUserSelect: eventBus.getEventPair("userSelect"),
            onViewStateChange: eventBus.getEventPair("viewStateChange"),
            setState: function(state, setUrl){
                if (!state.source && state.feed)
                    state.source = currentSource;

                if (state.source){
                    setSource(state.source, function(){
	                    if (state.user){
                            if (currentUser && state.user === currentUser.id && state.feed)
                                setFeed(state.feed, state);
                            else{
                                currentSource.getUser(state.user, function(userData){
                                    currentUser = userData;
                                    eventBus.triggerEvent("userSelect", { source: currentSource, user: userData });
                                });
                            }
                        }
	                    else{
                            setFeed(state.feed || currentSource && currentSource.feeds[0], state);
                            if (currentUser){
                                currentUser = null;
                                eventBus.triggerEvent("userSelect", { source: currentSource });
                            }
                        }
                    });
                }
                else if (currentSource) {
                    state.source = currentSource;
                    state.feed = getLastHistory("feed");
                }

                var stateView = !!state.view;
                if (stateView !== viewOpen){
                    eventBus.triggerEvent("viewStateChange", { isOpen: stateView, itemIndex: state.itemIndex || 0 });
	                eventBus.triggerEvent("modeChange", { mode: currentMode = (stateView ? "view" : "thumbnails") });
                    viewOpen = stateView;
                }

                if (setUrl !== false)
                    path.pushState(getPathState(state));

                if (stateHistory.length === maxHistory)
                    stateHistory.shift();

                stateHistory.push(state);
            }
        };

        init();
        return public;
    });