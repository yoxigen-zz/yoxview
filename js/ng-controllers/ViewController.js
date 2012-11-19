function ViewController($scope, apis, path, state){
    $scope.viewEnabled = false;

    var loadingFeed = false,
        itemIndexToLoadOnFeedLoad,
        currentItemSource;

    function openView(itemIndex){
        if (!apis.viewer)
            apis.createViewer(itemIndex);
        else
            apis.viewer.modules.view.selectItem(itemIndex);

        apis.viewer.triggerEvent("resize");
    }

    state.onViewStateChange.addListener(function(e){
        setTimeout(function(){
            $scope.$apply(function(){
                $scope.viewEnabled = e.isOpen;
                if (e.isOpen){
                    if (loadingFeed)
                        itemIndexToLoadOnFeedLoad = e.itemIndex;
                    else {
                        setTimeout(function(){
                            openView(e.itemIndex);
                        }, 10);
                    };
                }
            });
        });
    });

    function onLoadData(){
        loadingFeed = false;
        if (!isNaN(itemIndexToLoadOnFeedLoad)){
            openView(itemIndexToLoadOnFeedLoad);
            itemIndexToLoadOnFeedLoad = null;
        }
        apis.thumbnails.data.removeEventListener("loadSources", onLoadData);
    }

    state.onFeedChange.addListener(function(){
        loadingFeed = true;
        apis.thumbnails.data.addEventListener("loadSources", onLoadData);
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
        else{
            $scope.fixComments();
            setCurrentItemComments();
        }
    };

    $scope.minimizeBtnTitle = "Minimize";
    $scope.getCurrentItemLikeTitle = function(){
        return $scope.currentItem && $scope.currentItem.social && $scope.currentItem.social.like ? "Unlike" : "Like";
    };

    $scope.getCountStr = yox.utils.strings.formatNumber;

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

    function getLikes(){
        if ($scope.currentItem.social && $scope.currentItem.social.likesCount && $scope.currentItem.social.likes.length === 0)
            $scope.getMoreLikes();
        else {
            $scope.likes = $scope.currentItem.social.likes;
            $scope.allLikes = $scope.likes.length === $scope.currentItem.social.likesCount;
        }
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

                $scope.currentItem.social.likes = $scope.likes;
                $scope.currentItem.social.likesPaging = e.paging;
                $scope.allLikes = !e.paging;
                $scope.loadingLikes = false;
            });
        });
    };

    var linksRegex = /([@#][^\s$\:,\.\(\)\!\?\"\'@#]+|https?:\/\/[^\s$\!]+)/g;
    $scope.formatText = function(text){
        return text ? text.replace(linksRegex, function(result){
            var isExternalLink = /^h/.test(result),
                href = isExternalLink ? result : "?/" + $scope.currentItem.source.sourceType.name + "/",
                className = "innerLink";

            if (/^#/.test(result)){
                href = href + "tag/" + result.slice(1);
                className += " tag_link";
            }
            else if (/^@/.test(result)){
                href = href + "user/" + result.slice(1);
                className += " userLink";
            }

            return "<a class='" + className + "' href=\"" + href + "\"" + (isExternalLink ? " target='_blank'" : "") + ">" + result + "</a>"
        }) : null;
    };

    function setCurrentItemComments(){
        if (!$scope.commentsClosed && $scope.currentItem.social && $scope.currentItem.social.commentsCount > 0 && (!$scope.currentItem.social.comments || !$scope.currentItem.social.comments.length)){
            if (currentItemSource.getComments){
                $scope.commentsLoading = true;
                currentItemSource.getComments($scope.currentItem, function(result){
                    $scope.$apply(function(){
                        $scope.currentItem.social.comments = result.comments;
                        $scope.currentItem.social.commentsPaging = result.paging;
                        $scope.commentsLoading = false;
                    });
                });
            }
        }
    }

	var throttleSelect = false,
		throttleSelectTimeoutId;

	function selectItem(e){
		if (e.newItem){
			if (e.newItem !== $scope.currentItem){
				currentItemSource = e.newItem.source.sourceType;
				currentItemSource.getUser(function(userData){
					$scope.$apply(function(){
                        $scope.likes = null;

						$scope.currentItem = e.newItem;
						$scope.currentUser = userData;
						$scope.editingComment = false;

						setCurrentItemComments();
                        if ($scope.likesOpen)
                            getLikes();
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
	}

    apis.albums.addEventListener("createView", function(createEvent){
	    var throttleSelectTime = 500,
            throttledSelect = yox.utils.performance.throttle(selectItem, throttleSelectTime);

	    function enableSelectThrottle(){
		    throttleSelectTimeoutId = setTimeout(function(){
			    throttleSelect = false;
		    }, throttleSelectTime * 2);
	    }
	    selectItem({ newItem: createEvent.item });
        apis.viewer.addEventListener("beforeSelect", function(e){
	        if (throttleSelect){
		        clearTimeout(throttleSelectTimeoutId);
		        throttledSelect(e);
		        enableSelectThrottle();
	        }
	        else{
		        selectItem(e);
		        throttleSelect = true;
		        enableSelectThrottle();
	        }
        });
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

ViewController.$inject = ["$scope", "apis", "path", "state"];