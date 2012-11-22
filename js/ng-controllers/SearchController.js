function SearchController($scope, search){
    var isInit;

    $scope.results = {};

    function init(){
        search.onResults.addListener(onResults);
        isInit = true;
    }

    function onResults(response){
        if (response.term !== $scope.searchTerm)
            return false;

        $scope.$apply(function(){
            var resultsType = $scope.results[response.type],
                result;

            if (!resultsType)
                resultsType = $scope.results[response.type] = [];

            for(var i=0; i < response.results.length; i++){
                result = response.results[i];
                result.source = response.source;
                resultsType.push(result);
            }
        });
    }

    function clearResults(){
        for(var searchType in $scope.results){
            $scope.results[searchType] = [];
        }
    }

    $scope.search = function(){
        if ($scope.searchTerm){
            if (!isInit)
                init();

            clearResults();
            search.search($scope.searchTerm);
        }
    }
}

SearchController.$inject = ["$scope", "search"];