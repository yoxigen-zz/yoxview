function AppController($scope, state){
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
	        state.pushState({
		        source: userMatch[1],
		        user: userMatch[2]
	        });
        }
    };

    state.onModeChange.addListener(function(e){
        setTimeout(function(){
            $scope.$apply(function(){
                $scope.view = e.mode;
            });
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
}

AppController.$inject = ["$scope", "state"];
