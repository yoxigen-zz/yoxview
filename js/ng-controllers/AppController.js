function AppController($scope, path, apis){
    var views = ["home", "sources", "albums", "thumbnails"],
        userUrlRegex = /\?\/(\w+)\/user\/([^\/\?$]+)/;

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
            var state = {
                source: userMatch[1],
                user: userMatch[2]
            };

            path.pushState(state);
            //$scope.$broadcast("selectUser", state);
        }
    };

    function onInitialState(){
        window.removeEventListener("popstate", onInitialState, false);
        setTimeout(function(){
            var initialState = path.getFeedDataFromUrl();
            //path.pushState(initialState);
            if (initialState)
                $scope.$broadcast("state", initialState);

            /*
            if (!initialState || initialState.home){
                apis.createHomeApi();
            }
            */

            path.onPopState.addListener(function(state){
                if (!state || !state.source || state.home){
                    $scope.$apply(function(){
                        $scope.view = "home";
                        //apis.createHomeApi();
                    });
                }

                $scope.$broadcast("state", state);
            });
        }, 5);
    }
    window.addEventListener("popstate", onInitialState, false);
}

AppController.$inject = ["$scope", "path", "apis"];
