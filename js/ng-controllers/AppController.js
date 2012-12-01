function AppController($scope, state){
    var views = ["home", "sources", "albums", "thumbnails"],
        userUrlRegex = /\?\/(\w+)\/user\/([^\/\?$]+)/,
        tagUrlRegex = /\?\/(\w+)\/tag\/([^\/\?$]+)/;

    $scope.view = views[0];

    $scope.$on("titleChange", function(e, path){
        $scope.path = path;
    });

    function broadcastLogin(loginStatus){
        $scope.$broadcast(loginStatus ? "login" : "loginError", { source: $scope.currentSource });
    }

    $scope.login = function(){
        $scope.currentSource.provider.login(broadcastLogin);
    };

    $scope.selectUser = function(target){
        var userMatch = target.href && target.href.match(userUrlRegex);
        if (userMatch){
	        state.pushState({
		        source: userMatch[1],
		        user: userMatch[2]
	        });
        }
    };

    $scope.selectTag = function(target){
        var tagMatch = target.href && target.href.match(tagUrlRegex);
        if (tagMatch){
            state.pushState({
                source: tagMatch[1],
	            feed: {
		            tag: tagMatch[2],
		            name: "#" + tagMatch[2]
	            },
                tag: tagMatch[2]
            });
        }
    }

    state.onModeChange.addListener(function(e){
        $scope.safeApply(function(){
            $scope.view = e.mode;
        });
    });

    state.onFeedChange.addListener(function(e){
        $scope.safeApply(function(){
            $scope.currentFeed = e.feed.name;
        });
    });

    $scope.home = function(){
        state.pushState({ home: true });
    };

    $scope.togglePanel = function(btn){
        $scope.$apply(function(){
            var panel = btn.getAttribute("data-panel");
            $scope.openPanel = $scope.openPanel === panel ? null : panel;
        });
    };

    $scope.closePanel = function(){
        $scope.$apply(function(){
            $scope.openPanel = null;
        });
    };

    // By Alex Vanston, https://coderwall.com/p/ngisma:
    $scope.safeApply = function(fn) {
        var phase = this.$root.$$phase;
        if(phase == '$apply' || phase == '$digest') {
            fn();
        } else {
            this.$apply(fn);
        }
    };

    /* TEMPORARY!!! */
    document.getElementById("testFBUpload").onclick = function(){
        var dfd = yox.data.sources.facebook.create.image(document.getElementById("fbUpload").files[0], {
            title: "Testing image",
            albumId: "272785752838268"
        });
        dfd.done(function(e){
            console.log("DONE", e);
        });
    }
}

AppController.$inject = ["$scope", "state"];
