angular.module('StateModule', ["PathModule"])
    .factory('state', function($timeout, path) {
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
                    if (initialState.isOauthResponse)
                        public.replaceState(initialState);
                    else
                        public.pushState(initialState, false);
                }


                path.onPopState.addListener(function(pathState){
                    if (pathState && !pathState.user)
                        cancelCurrentUser();

                    if (setLastStateOnPop && stateHistory.length){
                        public.pushState(stateHistory.pop(), false);
                        setLastStateOnPop = false;
                    }
                    else if (pathState){
                        public.pushState(pathState, false);
                    }
                    else if (currentMode !== "home"){
                        if (currentMode !== "home")
                            eventBus.triggerEvent("modeChange", { mode: currentMode = "home" });

                        stateHistory.length && stateHistory.pop();
                        cancelCurrentUser();
                        currentFeed = currentSource = null;
                        viewOpen = false;
                    }

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

        function getBaseState(state){
            var baseState = {};
            baseState.user = state.user;
            if (state.source)
                baseState.source = Object(state.source) === state.source ? state.source.name : state.source;

            if (state.feed){
                baseState.feed = Object(state.feed) === state.feed ? state.feed.id : state.feed;

                if (state.feed.album)
                    baseState.album = Object(state.feed.album) === state.feed.album ? state.feed.album.id : state.feed.album;
            }

            if (state.view)
                baseState.view = state.view;

            if (state.itemIndex !== undefined)
                baseState.itemIndex = state.itemIndex;

            if (state.home)
                baseState.home = state.home;

	        if (state.tag)
	            baseState.tag = state.tag;

            return baseState;
        }

        function statesAreEqual(state1, state2){
            var baseState1 = getBaseState(state1), baseState2 = getBaseState(state2);

            if (baseState1.source !== baseState2.source)
                return false;

            if (baseState1.feed !== baseState2.feed)
                return false;

            if (baseState1.view !== baseState2.view)
                return false;

            if (baseState1.user !== baseState2.user)
                return false;

            if (baseState1.itemIndex !== baseState2.itemIndex)
                return false;

            if (baseState1.home !== baseState2.home)
                return false;

	        if (baseState1.tag !== baseState2.tag)
	            return false;

            if (baseState1.album !== baseState2.album)
                return false;

            return true;
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
                var sourceData = angular.extend({ type: currentSource.name }, feed);
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
            var pathState = {
                source: state.source && state.source.name,
                feed: state.feed && state.feed.id,
                view: state.view,
                itemIndex: state.itemIndex,
                home: state.home || !state.source,
                user: state.user || currentUser && currentUser.id,
	            tag: state.tag || (state.feed && state.feed.tag),
                album: state.feed && state.feed.album
            };

            if (Object(pathState.album) === pathState.album)
                pathState.album = pathState.album.id;

            return pathState;
        }

        function setFeed(feed, state){
            function doSetFeed(){
                if (currentFeed &&
	                state.source.name === currentSource.name &&
	                feed.id === currentFeed.id &&
	                feed.tag === currentFeed.tag &&
                    feed.album === currentFeed.album &&
	                (!currentUser || currentUser.id !== state.user)
                ) return;

                feedAuthAndLoad(feed, function(){
                    if (state.view && currentMode === "thumbnails"){
                        currentMode = "view";
                        eventBus.triggerEvent("modeChange", { mode: "view" });
                    }
                    else if (!state.view && currentMode === "view"){
                        currentMode = /albums/i.test(feed.id) ? "albums" : "thumbnails";
                        eventBus.triggerEvent("modeChange", { mode: currentMode, isAlbum: !!feed.album });
                    }
                });
            }

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
                    eventBus.triggerEvent("modeChange", { mode: newMode, isAlbum: !!state.feed.album });
                    // When a mode changes, it's necessary to wait until the UI changes before loading data, to avoid a situation where the thumbnails are not displayed and get a width/height of 0.
                    $timeout(doSetFeed, 1);
                }
                else
                    doSetFeed();
            }
        }

        function cancelCurrentUser(){
            if (currentUser){
                currentUser = null;
                eventBus.triggerEvent("userSelect", { source: currentSource });
            }
        }

        function setState(state){
            if (stateHistory.length && statesAreEqual(stateHistory[stateHistory.length - 1], state))
                return false;

            if (state.home){
                if (currentMode !== "home")
                    eventBus.triggerEvent("modeChange", { mode: currentMode = "home" });

                cancelCurrentUser();
            }
            else {
                if (!state.source && (state.feed || state.view))
                    state.source = currentSource;

                if (state.view && !state.feed){
                    state.feed = currentFeed;
                    if (currentUser)
                        state.user = currentUser.id;
                }

                if (state.source){
                    if (typeof(state.source) === "string")
                        state.source = yox.data.sources[state.source];

                    if (!state.feed && !state.user){
	                    if (state.tag)
	                        state.feed = { tag: state.tag, name: "#" + state.tag };
	                    else
                            state.feed = state.source.feeds[0];
                    }
                    setSource(state.source, function(){
                        if (state.user){
                            if (currentUser && state.user === currentUser.id && state.feed)
                                setFeed(state.feed, state);
                            else{
                                currentSource.getUser(state.user, function(userData){
                                    currentUser = userData;
                                    eventBus.triggerEvent("userSelect", { source: currentSource, user: userData });

                                    if (state.feed)
                                        setFeed(state.feed, state);
                                });
                            }
                        }
                        else{
                            setFeed(state.feed, state);
                            cancelCurrentUser();
                        }
                    });
                }
                else if (currentSource) {
                    state.source = currentSource;
                    state.feed = getLastHistory("feed");
                    console.log("State feed: ", state.feed);
                }
            }

            var stateView = !!state.view;
            if (stateView !== viewOpen){
                eventBus.triggerEvent("viewStateChange", { isOpen: stateView, itemIndex: state.itemIndex || 0 });
                eventBus.triggerEvent("modeChange", { mode: currentMode = (stateView ? "view" : "thumbnails"), isAlbum: state.feed && !!state.feed.album });
                viewOpen = stateView;
            }

            return state;
        }

        var public = {
            back: function(){
                if (stateHistory.length > 1){
                    stateHistory.pop();
                    setLastStateOnPop = true;
                    path.back();
                }
                else{
                    path.top();
                    if (currentMode !== "home")
                        eventBus.triggerEvent("modeChange", { mode: "home" });

                    cancelCurrentUser();
                }
            },
            getLastState: function(){
                return angular.extend(true, {}, getLastHistory());
            },
            get mode(){
                return currentMode;
            },
            onFeedChange: eventBus.getEventPair("feedChange"),
            onModeChange: eventBus.getEventPair("modeChange"),
            onSourceChange: eventBus.getEventPair("sourceChange"),
	        onUserSelect: eventBus.getEventPair("userSelect"),
            onViewStateChange: eventBus.getEventPair("viewStateChange"),
            pushState: function(state, setUrl){
                state = setState(state);

                if (state){
                    if (setUrl !== false)
                        path.pushState(getPathState(state));

                    if (stateHistory.length === maxHistory)
                        stateHistory.shift();

                    stateHistory.push(state);
                }
            },
            replaceState: function(state){
                state = setState(state);
                if (state){
                    path.replaceState(getPathState(state));
                    if (stateHistory.length)
                        stateHistory[stateHistory.length - 1] = state;
                    else
                        stateHistory.push(state);
                }
            }
        };

        init();
        return public;
    });