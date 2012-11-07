function HeaderController($scope){
    /*
    var appName = "yoxview";

    $scope.path = [];

    function updatePath(pathParts){
        setTimeout(function(){
            $scope.$apply(function(){
                var path = [];
                Array.prototype.push.apply(path, pathParts);
                $scope.path = path;

                var titleParts = [appName];
                for(var i=0; i < path.length; i++){
                    titleParts.push(path[i].name);
                }
                document.title = titleParts.join(" - ");
            });
        }, 1);
    }

    albumsApi.data.addEventListener("loadSources", function(source){
        source = source[0];
        updatePath([{ name: source.sourceType.sourceName }]);
    });

    albumsApi.addEventListener("openAlbum", function(e){
        updatePath([e.album]);
    });
    */

    /* Works only on the first image
    thumbnailsApi.data.addEventListener("loadSources", function(sources){
        if (sources && sources.length && sources[0].items && sources[0].items.length){
            $scope.$apply(function(){
                $scope.iconType = "jpg";
                $scope.iconUrl = sources[0].items[0].thumbnail.src;
            });
        }
    });
    */
}