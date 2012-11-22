angular.module('SearchModule', [])
    .factory('search', function() {
        return {
            onResults: yox.data.search.onResults,
            search: yox.data.search.search
        }
    });