function NavController($scope, path, apis, state){
    var availableSources = ["facebook", "instagram", "picasa"];

    $scope.sources = getSources();
    var modeNavs = {
        home: 0,
        thumbnails: 1,
        albums: 2
    };

    $scope.currentNav = modeNavs.home;
    getSourceUsers();

    function getSources(){
        var sources = [];
        for(var i= 0, sourceId; sourceId = availableSources[i]; i++){
            sources.push({
                provider: yox.data.sources[sourceId]
            });
        }
        
        return sources;
    }

    function getSourceUsers(){
        angular.forEach($scope.sources, function(source){
            if (source.provider.getUser){
                source.provider.getUser(function(user){
                    if (user){
                        $scope.safeApply(function(){
                            source.currentUser = user;
                        });
                    }
                });
            }
        });
    }

    function findSource(sourceName){
        for(var i= 0, source; source = $scope.sources[i]; i++){
            if (source.provider.name === sourceName)
                return source;
        }

        return null;
    }

    state.onSourceChange.addListener(function(e){
        var source = findSource(e.source.name);
        if (source){
            if ($scope.currentSource)
                $scope.currentSource.selected = false;

            source.selected = true;
            $scope.$parent.currentSource = $scope.currentSource = source;
            $scope.sourceFeeds = e.source.feeds;
            $scope.currentNav = 1;
        }
    });

    state.onFeedChange.addListener(function(e){
        $scope.safeApply(function(){
            if ($scope.currentFeed)
                $scope.currentFeed.selected = false;

            for(var i= 0, feed; feed = $scope.sourceFeeds[i]; i++){
                if (feed.id === e.feed.id){
                    feed.selected = true;
                    $scope.currentFeed = feed;
                    break;
                }
            }

            if (e.feed.hasChildren){
                $scope.currentNav = 2;
            }
            else{
                $scope.currentNav = 1;
            }
        });
    });

    state.onUserSelect.addListener(function(e){
        $scope.safeApply(function(){
            if (e.user){
                $scope.user = e.user;
                $scope.user.feeds = e.source.getUserFeeds(e.user);
                $scope.currentSource = findSource(e.source.name);

                state.replaceState({
                    user:e.user.id,
                    source:e.source,
                    feed: $scope.user.feeds[0]
                }, { replace: true });
            }
            else
                $scope.user = null;
        });
    });

    state.onModeChange.addListener(function(e){
        var nav = modeNavs[e.mode];
        if (nav !== undefined){
            $scope.safeApply(function(){
                $scope.currentNav = nav;
            });
        }
    });

    $scope.selectSource = function(source){
        state.pushState({ source: source.provider });
        $scope.currentNav = 1;
    };

    $scope.selectFeed = function(feed, user){
        state.pushState({
            feed: feed,
            user: user.id
        });
        /*
        if (feed.childrenType === "users"){
            $scope.loading = true;
            $scope.currentSource.provider.load(feed, function(data){
                setTimeout(function(){
                        $scope.$apply(function(){
                        $scope.users = data.items;
                        $scope.currentNav = 2;
                        $scope.loading = false;
                    });
                });
            });
        }
        else{
            var sourceData = $.extend({ type: $scope.currentSource.provider.name }, feed);
            if (feed.hasChildren){
                setTimeout(function(){
                    $scope.$apply(function(){
                        $scope.currentNav = 2;
                        $scope.$parent.view = "albums";
                        $scope.albums = [];
                        $scope.loading = true;
                    });
                });

                setTimeout(function(){
                    if (state && state.child)
                        albumIdToSelectAfterLoad = state.child;

                    apis.albums.data.source(sourceData);
                }, 1);
            }
            */
        //}
    };

    var albumIdToSelectAfterLoad;
    apis.albums.data.addEventListener("loadSources", function(sources){
        $scope.$apply(function(){
            if (sources && sources.length){
                $scope.albums = sources[0].items;
                if (albumIdToSelectAfterLoad){
                    var albumToSelect;
                    for(var i= 0, album; album = $scope.albums[i]; i++){
                        if (album.data.album.id === albumIdToSelectAfterLoad){
                            albumToSelect = album;
                            break;
                        }
                    }
                    if (albumToSelect){
                        $scope.selectAlbum(albumToSelect);
                        $scope.$parent.view = "thumbnails";
                    }
                    else
                        $scope.$parent.view = "albums";
                }
                else
                    $scope.$parent.view = "albums";
            }

            $scope.loading = false;
        });
    });

    apis.albums.addEventListener("click", function(e){
        $scope.selectAlbum($scope.albums[e.index]);
    });

    $scope.selectAlbum = function(item, state){
        if ($scope.currentAlbum)
            delete $scope.currentAlbum.selected;

        if (!state)
            path.pushState({ source: $scope.currentSource.provider.name, feed: $scope.currentFeed.id, child: item.data.album.id });

        apis.albums.triggerEvent("openAlbum", { provider: item.source.sourceType, album: item.data.album });

        item.selected = true;
        $scope.currentAlbum = item;
        $scope.$emit("titleChange", [$scope.currentFeed, { name: item.data.album.name }]);
    };

    apis.albums.addEventListener("openAlbum", function(){
        $scope.safeApply(function(){
            $scope.$parent.view = "thumbnails";
        });
    });

    $scope.back = function(){
        state.back();
    };

    $scope.getDirection = yox.utils.strings.getDirection;

    $scope.$on("login", function(e, args){
        $scope.selectSource(args.source, true);
    });
}

NavController.$inject = ["$scope", "path", "apis", "state"];