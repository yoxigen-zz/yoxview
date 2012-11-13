function AccountsController($scope, path, apis, state){
    var availableSources = ["facebook", "instagram", "picasa"];

    $scope.sources = getSources();
    $scope.currentNav = 0;
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
                        setTimeout(function(){
                            $scope.$apply(function(){
                                source.currentUser = user;
                            });
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

    state.onSourceChange.addListener(function(newSource){
        var source = findSource(newSource.name);
        if (source){
            if ($scope.currentSource)
                $scope.currentSource.selected = false;

            source.selected = true;
            $scope.$parent.currentSource = $scope.currentSource = source;

            $scope.sourceFeeds = newSource.feeds;
            $scope.currentNav = 1;
        }
    });

    $scope.selectSource = function(source){
        state.setState({ source: source.provider });
    };

    $scope.selectFeed = function(feed, state){
        if ($scope.currentFeed === feed){
            setTimeout(function(){
                $scope.$apply(function(){
                    if (feed.hasChildren){
                        $scope.currentNav = 2;
                        $scope.$parent.view = "albums";
                    }
                    else{
                        $scope.currentNav = 1;
                        $scope.$parent.view = "thumbnails";
                    }
                });
            });
            return;
        }

        if ($scope.currentFeed)
            $scope.currentFeed.selected = false;

        feed.selected = true;
        $scope.currentFeed = feed;

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
            else{
                setTimeout(function(){
                    $scope.$apply(function(){
                        $scope.$parent.view = "thumbnails";
                    });
                });
                setTimeout(function(){
                    apis.thumbnails.data.source(sourceData);
                }, 1);
            }
        }

        $scope.$emit("titleChange", [feed]);
        apis.albums.triggerEvent("openFeed", { provider: $scope.currentSource.provider, feed: feed });

        if (!state)
            path.pushState({ source: $scope.currentSource.provider.name, feed: feed.id });
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
        setTimeout(function(){
            $scope.$apply(function(){
                $scope.$parent.view = "thumbnails";
            });
        }, 1);
    });

    $scope.back = function(){
        if ($scope.currentNav > 0)
            $scope.currentNav--;

        if (!$scope.currentNav){
            path.pushState({ home: true });
        }
    };

    $scope.backFromUser = function(){
        $scope.user = null;
        path.back();
    };

    $scope.getDirection = yox.utils.strings.getDirection;

    $scope.$on("login", function(e, args){
        $scope.selectSource(args.source, true);
    });


    var stateUrlMatch = window.location.href.match(/[\?#&]state=(\w+)/);
    if (stateUrlMatch){
        var state = stateUrlMatch[1],
            source;

        for(var i= 0, source; source = $scope.sources[i]; i++){
            if (source.provider.name === state) {
                $scope.selectSource(source);
                break;
            }
        }
    }

    $scope.selectUser = function(user){
        $scope.user = user;
        $scope.user.feeds = yox.data.sources[user.source].getUserFeeds(user);
        $scope.currentSource = findSource(user.source);

        var feed = $scope.user.feeds[0];
        $scope.selectFeed(feed, { source: user.source, user: user.id, feed: feed.id });
    };

    function getUserFromUserId(source, userId, callback){
        yox.data.sources[source].getUser(userId, callback);
    }

    function getUserFromState(state){
        if (state && state.user && state.source && (!$scope.user || state.user !== $scope.user.id)){
            getUserFromUserId(state.source, state.user, function(userData){
                setTimeout(function(){
                    $scope.$apply(function(){
                        $scope.selectUser(userData);
                    });
                }, 0);
            });
        }
    }
    /*
    $scope.$on("selectUser", function(e, state){
        getUserFromState(state);
    });
*/
    $scope.$on("state", function(e, state){
        if (state && state.user){
            getUserFromState(state);
        }
        else if (state && state.source){
            var source = findSource(state.source);

            if (apis.viewer){
                if (state.view && !apis.viewer.modules.view.isOpen()){
                    /*
                    function onLoad(){
                        if (state.itemIndex){
                            apis.viewer.modules.view.selectItem(state.itemIndex);
                        }
                        apis.openViewer();
                        apis.thumbnails.data.removeEventListener("loadSources", onLoad);
                    }
                    apis.thumbnails.data.addEventListener("loadSources", onLoad);
                    */
                }
            }
            $scope.selectSource(source, true, state);
        }
        else{
            setTimeout(function(){
                $scope.$apply(function(){
                    $scope.currentNav = 0;
                });
            })
        }

        if ($scope.user && (!state || !state.user)){
            setTimeout(function(){
                $scope.$apply(function(){
                    $scope.user = null;
                });
            });

        }
    });

    path.onPushState.addListener(function(state){
        if (state.user){
            getUserFromState(state);
        }
    });

}

AccountsController.$inject = ["$scope", "path", "apis", "state"];