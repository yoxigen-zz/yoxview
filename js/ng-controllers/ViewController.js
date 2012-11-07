function ViewController($scope, apis, path){
    $scope.viewEnabled = false;
    apis.addEventListener("toggleView", function(e){
        if (e.digesting)
            $scope.viewEnabled = e.isEnabled;
        else
            $scope.$apply(function(){
                $scope.viewEnabled = e.isEnabled;
            });
    });
    path.onPushState.addListener(function(state){
        if(!!state.view !== $scope.viewEnabled){
            setTimeout(function(){
                $scope.$apply(function(){
                    $scope.viewEnabled = !!state.view;
                });
            }, 1);
        }
    });

    $scope.commentsClosed = document.documentElement.clientWidth <= 1024;
    $scope.openComments = function(){
        $scope.commentsClosed = false;
    };
    $scope.closeComments = function(){
        $scope.commentsClosed = true;
        $scope.likesOpen = false;

        setTimeout(function(){
            apis.viewer.triggerEvent("resize");
        }, 1);
        $scope.minimizeBtnTitle = "Open";
    };
    $scope.fixComments = function(e){
        if (e)
            e.stopPropagation();

        $scope.commentsClosed = false;
        setTimeout(function(){
            apis.viewer.triggerEvent("resize");
        }, 1);
        $scope.minimizeBtnTitle = "Minimize";

    };
    $scope.toggleCommentsFix = function(e){
        if (e)
            e.stopPropagation();

        if (!$scope.commentsClosed)
            $scope.closeComments();
        else
            $scope.fixComments();
    };

    $scope.minimizeBtnTitle = "Minimize";
    $scope.getCurrentItemLikeTitle = function(){
        return $scope.currentItem && $scope.currentItem.social && $scope.currentItem.social.like ? "Unlike" : "Like";
    };

    $scope.getCountStr = function(count){
        if (isNaN(count))
            return "";

        if (!$scope.commentsClosed || count < 1000)
            return count;

        return (count / 1000).toFixed(1) + "k";
    };

    $scope.getDirection = function(text){
        return yox.utils.strings.isRtl(text) ? "rtl" : "ltr";
    };

    $scope.getLikeCommand = function(lowercase){
        if (!$scope.currentItem)
            return null;

        var likeCommand = $scope.currentItem.social.like ? "Unlike" : "Like";
        if (lowercase)
            likeCommand = likeCommand.toLowerCase();

        return likeCommand;
    };

    $scope.toggleLike = function(e){
        e.stopPropagation();

        if (!$scope.currentItem.social.like)
            $scope.currentItem.source.sourceType.social.like($scope.currentItem.originalId, function(result){
                if (result.success){
                    $scope.$apply(function(){
                        $scope.currentItem.social.like = true;
                        $scope.currentItem.social.likesCount++;
                    });
                }
            });
        else{
            $scope.currentItem.source.sourceType.social.unlike($scope.currentItem.originalId, function(result){
                if (result.success){
                    $scope.$apply(function(){
                        $scope.currentItem.social.like = false;
                        $scope.currentItem.social.likesCount--;
                    });
                }
            });
        }
    };

    $scope.toggleLikesOpen = function(){
        $scope.likesOpen = !$scope.likesOpen;
        if ($scope.likesOpen && !$scope.likes)
            getLikes();
    };

    // TODO: Really get likes async from the source, if required.
    function getLikes(){
        $scope.likes = $scope.currentItem.social.likes;
        $scope.allLikes = $scope.likes.length === $scope.currentItem.social.likesCount;
    }

    $scope.editingComment = false;
    $scope.writeComment = function(){
        $scope.editingComment = true;
    };
    $scope.postComment = function(){
        if (!$scope.commentWriteText)
            return false;

        $scope.postingComment = true;
        $scope.currentItem.source.sourceType.social.comment($scope.currentItem.originalId, $scope.commentWriteText, function(result){
            $scope.$apply(function(){
                if (result.success){
                    $scope.commentWriteText = "";
                    $scope.currentItem.social.commentsCount++;
                    if (!$scope.currentItem.social.comments)
                        $scope.currentItem.social.comments = [];

                    $scope.currentItem.social.comments.push(result.comment);
                    $scope.editingComment = false;
                }

                $scope.postingComment = false;
            });
        });
    };

    $scope.close = function(){
        apis.viewer.modules.view.close();
    };

    $scope.getListItemSeparator = function(index, total){
        if (index === total - 1)
            return "";

        if (index === total - 2)
            return " and";

        return ",";
    };


    $scope.getMoreLikes = function(){
        if ($scope.loadingLikes)
            return false;

        $scope.loadingLikes = true;
        $scope.currentItem.getLikes(function(e){
            $scope.$apply(function(){
                if (e.append)
                    $scope.likes = $scope.likes.concat(e.likes);
                else
                    $scope.likes = e.likes;

                if (!e.pagination)
                    $scope.allLikes = true;

                $scope.loadingLikes = false;
            });
        });
    };

    var linksRegex = /([@#][^\s$\:,\.\(\)\!\?\"\'@#]+|https?:\/\/[^\s$\!]+)/g;
    $scope.formatText = function(text){
        return text ? text.replace(linksRegex, function(result){
            var isExternalLink = /^h/.test(result),
                href = isExternalLink ? result : "?/" + $scope.currentItem.source.sourceType.name + "/";

            if (/^#/.test(result))
                href = href + "tag/" + result.slice(1);
            else if (/^@/.test(result)){
                href = href + "user/" + result.slice(1);
            }

            return "<a class='innerLink' href=\"" + href + "\"" + (isExternalLink ? " target='_blank'" : "") + ">" + result + "</a>"
        }) : null;
    };

    apis.albums.addEventListener("createView", function(createEvent){
        var throttledSelect = yox.utils.performance.throttle(function(e){
            if (e.newItem){
                if (e.newItem !== $scope.currentItem){
                    var source = e.newItem.source.sourceType;
                    source.getUser(function(userData){
                        $scope.$apply(function(){
                            if ($scope.likesOpen){
                                $scope.likes = e.newItem.social && e.newItem.social.likes;
                                $scope.allLikes = e.newItem.social && e.newItem.social.likesCount !== undefined ? $scope.likes.length === e.newItem.social.likesCount : true;
                            }
                            else
                                $scope.likes = null;


                            $scope.currentItem = e.newItem;
                            $scope.currentUser = userData;
                            $scope.editingComment = false;

                            if (!$scope.commentsClosed && e.newItem.social && e.newItem.social.commentsCount > 0 && (!e.newItem.social.comments || !e.newItem.social.comments.length)){
                                if (source.getComments){
                                    $scope.commentsLoading = true;
                                    source.getComments(e.newItem, function(result){
                                        $scope.$apply(function(){
                                            $scope.currentItem.social.comments = result.comments;
                                            if (result.paging)
                                                $scope.currentItem.social.commentsPaging = result.paging;

                                            $scope.commentsLoading = false;
                                        });
                                    });
                                }
                            }
                        });
                    });
                }
            }
            else{
                $scope.$apply(function(){
                    $scope.currentItem = null;
                    $scope.editingComment = false;
                    $scope.likesOpen = false;
                });
            }
        }, 500);

        throttledSelect({ newItem: createEvent.item });
        apis.viewer.addEventListener("beforeSelect", throttledSelect);
    });

    $scope.formatDate = function(date){
        return date ? yox.utils.date.getTimeDifference(date) : "";
    }

    $scope.$on("state", function(e, state){
        if (state && !!state.view !== $scope.viewEnabled){
            $scope.viewEnabled = !!state.view;
        }
    });


}

ViewController.$inject = ["$scope", "apis", "path"];