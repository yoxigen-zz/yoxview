angular.module('PathModule', []).factory('path', function() {
    var eventBus = new yox.eventBus();

    function getFeedDataFromUrl(url){
        var feedParts = url.match(/\?\/(.*)$/),
            position = 0;

        if (feedParts){
            feedParts = feedParts[1].split("/");

            var returnData = {}
            if (feedParts.length){
                returnData.source = feedParts[position++]

                if (feedParts.length > 1){
                    if (feedParts[1] === "user" && feedParts.length > 2){
                        returnData.user = feedParts[2];
                        position = 3;
                    }
                    else if (feedParts[1] === "tag" && feedParts.length > 2){
                        returnData.tag = feedParts[2];
                        position = 3;
                    }
                    if (feedParts.length > position){
                        returnData.feed = feedParts[position++];

                        if (feedParts.length > position && feedParts[position++] === "view"){
                            returnData.view = true;

                            if (feedParts.length > position){
                                returnData.itemIndex = feedParts[position];
                            }
                        }
                    }
                }
            }

            return returnData;
        }
	    else {
	        var stateUrlMatch = url.match(/[\?#&]state=(\w+)/);
	        if (stateUrlMatch){
	            return {
		            source: stateUrlMatch[1],
                    isOauthResponse: true
	            };
	        }

            return { home: true };
        }
    }

    function getUrlFromState(state){
        var url = [];
        if (state.source){
            url.push(state.source);

            if (state.user)
                url.push("user", state.user);
	        else if (state.tag)
                url.push("tag", state.tag);

            if (state.feed)
                url.push(state.feed);
            else if (state.album)
                url.push("albums", state.album);

            if (state.view){
                url.push("view");

                if (state.itemIndex)
                    url.push(state.itemIndex);
            }
        }

        return "?/" + url.join("/");
    }

    function pushState(state){
        eventBus.triggerEvent("pushState", state);
        window.history.pushState(state, state.feed || state.source || "home", getUrlFromState(state));
    }

    function onPopState(e){
        eventBus.triggerEvent("popstate", e.state || null);
    }

    var public = {
        back: function(){ window.history.back(); },
        get currentState(){
            return window.history.state;
        },
        getFeedDataFromUrl: function(url){
            return getFeedDataFromUrl(url || window.location.href);
        },
        replaceState: function(state, title){
            window.history.replaceState(state, title, getUrlFromState(state));
        },
        pushState: window.history && window.history.pushState ? yox.utils.performance.throttle(pushState, 50) : function(){},
        onPopState: {
            addListener: function(listener){
                if (!eventBus.hasEventListeners("popstate"))
                    window.addEventListener("popstate", onPopState, false);

                eventBus.addEventListener("popstate", listener);
            },
            removeListener: function(listener){
                eventBus.removeEventListener("popstate", listener);

                if (!eventBus.hasEventListeners("popstate"))
                    window.removeEventListener("popstate", onPopState, false);
            }
        },
        onPushState: {
            addListener: function(listener){
                eventBus.addEventListener("pushState", listener);
            },
            removeListener: function(listener){
                eventBus.removeEventListener("pushState", listener);
            }
        },
        top: function(){
            pushState({});
        }
    };

    return public;
});