angular.module('ApisModule', ["PathModule"])
.factory('apis', function(path) {
    var viewerApi,
        thumbnailsApi,
        albumsApi,
        homeApi;

    var viewer_view = document.getElementById("viewer_view");

    var currentAlbumId,
        currentAlbum,
        currentProvider,
        currentDataSource,
        currentFeedId;

    var eventBus = new yox.eventBus();

    function createViewerApi(itemIndexToShow){
        viewerApi = new Yox(viewer_view, {
            theme: {
                name: "classic",
                options: {
                    renderThumbnails: false,
                    renderInfo: false,
                    renderControls: false,
                    showThumbnails: false,
                    showInfo: false,
                    modules: {
                        view: {
                            loop: false,
                            transitionTime: 0
                        }
                    }
                }
            },
            data: thumbnailsApi.data,
            events: {
                close: function(e){
                    eventBus.triggerEvent("toggleView", { isEnabled: false, digesting: !e.state });

                    if (!e.state || !e.state.fromHistory){

                        path.back();
                    }
                },
                beforeSelect: function(e){
                    if (e.newItem){
                        var currentState = path.currentState;
                        console.log("CURRENT STATE: ", currentState);
                        if (currentState){
                            currentState.itemIndex = e.newItem.id - 1;
                            path.replaceState(currentState, "Slideshow");
                        }
                    }
                }
            }
        });

        albumsApi.triggerEvent("createView", { item: thumbnailsApi.data.getItem(parseInt(itemIndexToShow, 10)) });
        $("body")
            .on("focus", "#viewer textarea, #viewer input[type='text']", function(){
                viewerApi.modules.controller.disableKeyboard();
            })
            .on("blur", "#viewer textarea, #viewer input[type='text']", function(){
                viewerApi.modules.controller.enableKeyboard();
            });
    }
    function createHomeApi(){
        if (!homeApi){
            homeApi = new Yox(document.getElementById("home"), {
                theme: [
                    {
                        name: "wall",
                        options: {
                            handleResize: true,
                            thumbnailsMaxHeight: Math.round(screen.height * 0.27),
                            borderWidth: 3,
                            padding: 1,
                            scrollToElementOnSelect: true,
                            createThumbnailInfoFunc: yox.utils.support.touch() ? null : createThumbnailInfo
                        }
                    }
                ],
                data: new yox.data()
            });

            homeApi.data.loadNews();
        }
    }

    albumsApi = new Yox(document.getElementById("albumsThumbnails"), {
        theme: [
            {
                name: "wall",
                options: {
                    thumbnailsMaxHeight: Math.round(screen.height * 0.27),
                    borderWidth: 3,
                    createThumbnailInfo: true,
                    padding: 1,
                    loadItemsOnScroll: false,
                    scrollToElementOnSelect: true,
                    modules: {
                        thumbnails: {
                            createThumbnailUrl: function(item){
                                if (item.data && item.data.album)
                                    return "#album/" + item.source.sourceType.name + "/" + item.data.album.id;
                                else
                                    return "#" + item.link || item.url;
                            }
                        }
                    }
                }
            }
        ],
        data: new yox.data(),
        events: {
            click: function(e){
                var itemIndex = parseInt(e.index, 10),
                    item = albumsApi.data.getData()[0].items[itemIndex];

                if (window.history && window.history.pushState)
                    window.history.pushState({ provider: item.source.sourceType.name, album: item.data.album }, "Album", "?/" + item.source.sourceType.name + "/" + item.data.album.id);

                albumsApi.triggerEvent("openAlbum", { provider: item.source.sourceType, album: item.data.album });
            },
            openAlbum: function(){
                albumsApi.themes.wall.toggleHandleResize(false);
            },
            openFeed: function(e){
                if (e.feed.hasChildren && e.feed.childrenType === "albums"){
                    albumsApi.themes.wall.toggleHandleResize(true);
                }
            }
        }
    });

    yox.data.sources.picasa.defaults.thumbsize = 400;

    thumbnailsApi = new Yox(document.getElementById("thumbnails"), {
        theme: [
            {
                name: "wall",
                options: {
                    handleResize: false,
                    thumbnailsMaxHeight: Math.round(screen.height * 0.27),
                    borderWidth: 3,
                    padding: 1,
                    scrollToElementOnSelect: true,
                    createThumbnailInfoFunc: yox.utils.support.touch() ? null : createThumbnailInfo
                }
            }
        ],
        data: new yox.data(),
        events: {
            click: function(e){
                eventBus.triggerEvent("toggleView", { isEnabled: true });

                if (!viewerApi)
                    createViewerApi(e.index);
                else
                    viewerApi.triggerEvent("resize");

                var state = { source: currentProvider.name, view: true };
                if (path.currentState.feed)
                    state.feed = path.currentState.feed;

                if (currentAlbumId)
                    state.child = currentAlbum.id;

                if (path.currentState.user)
                    state.user = path.currentState.user;

                state.itemIndex = e.index;

                path.pushState(state);

                viewerApi.modules.view.selectItem(e.index);
            }
        }
    });

    var titleMaxLength = 150;
    function createThumbnailInfo(item){
        var thumbnailInfo = document.createElement("div");
        thumbnailInfo.className = "yox-theme-wall-info";

        var bottomInfo = document.createElement("div");
        bottomInfo.className = "yox-theme-wall-info-bottom";
        thumbnailInfo.appendChild(bottomInfo);

        if (item.title || item.description){
            if (item.title){
                var title = document.createElement("h3");
                title.className = "yox-theme-wall-info-title";
                if (yox.utils.strings.isRtl(item.title))
                    title.dir = "rtl";

                title.innerHTML = yox.utils.strings.trim(item.title, titleMaxLength, "&hellip;");
                bottomInfo.appendChild(title);
            }
        }

        var meta = document.createElement("div");
        meta.className = "yox-theme-wall-info-meta";

        if (item.social){
            var social = document.createElement("div");
            social.className = "yox-theme-wall-info-social";
            if (item.social.likesCount){
                var likes = document.createElement("span");
                likes.className = "yox-theme-wall-info-likes";
                likes.textContent = item.social.likesCount;
                social.appendChild(likes);
            }
            if (item.social.commentsCount){
                var comments = document.createElement("span");
                comments.className = "yox-theme-wall-info-comments";
                comments.textContent = item.social.commentsCount;
                social.appendChild(comments);
            }
            meta.appendChild(social);
        }

        if (item.author){
            if (item.author.avatar){
                var authorThumbnail = document.createElement("img");
                authorThumbnail.className = "yox-theme-wall-info-avatar";
                authorThumbnail.src = item.author.avatar;
                meta.appendChild(authorThumbnail);
            }

            if (item.author.name){
                var authorName = document.createElement("span");
                authorName.className = "yox-theme-wall-info-author";
                authorName.textContent = item.author.name || item.author.username;
                meta.appendChild(authorName);
            }
        }

        if (item.time){
            var time = document.createElement("span");
            time.className = "yox-theme-wall-info-time";
            time.textContent = yox.utils.date.getTimeDifference(item.time);
            meta.appendChild(time);
        }

        bottomInfo.appendChild(meta);
        return thumbnailInfo;
    }

    function getAlbumId(item){
        return (typeof(item.provider) === "string" ? item.provider : item.provider.name) + "." + item.album.id;
    }

    function enableThumbnails(){
        if (document.body.getAttribute("data-page") !== "thumbnails"){
            document.body.setAttribute("data-page", "thumbnails");
            thumbnailsApi.themes.wall.toggleHandleResize(true);
        }
    }

    function setAlbum(item){
        var albumId = getAlbumId(item);
        if (currentAlbumId !== albumId){
            setTimeout(function(){
                currentDataSource = {
                    type: item.provider.name,
                    url: item.album.url
                };

                thumbnailsApi.data.source(currentDataSource);
            }, 10);

            currentFeedId = "albums";
            currentAlbumId = albumId;
            currentAlbum = item.album;
            currentProvider = item.provider;
        }

        enableThumbnails();
    }

    function setFeed(item){
        currentFeedId = item.id;
        currentProvider = item.provider;
        if (!item.feed.hasChildren || item.feed.childrenType !== "albums"){
            enableThumbnails();
            albumsApi.themes.wall.toggleHandleResize(false);
        }
    }

    path.onPopState.addListener(function(state){
        if (!viewerApi)
            createViewerApi((state && state.itemIndex) || 0);

        var isViewerOpen = viewerApi.modules.view.isOpen(),
            stateView = state && state.view;

        if (isViewerOpen !== !!stateView){
            if (stateView){
                eventBus.triggerEvent("toggleView", { isEnabled: true });
                viewerApi.modules.view.selectItem(state.itemIndex || 0);
            }
            else
                viewerApi.modules.view.close({ fromHistory: true });
        }
    });

    albumsApi.addEventListener("openAlbum", setAlbum);
    albumsApi.addEventListener("openFeed", setFeed);
    albumsApi.addEventListener("home", function(){
        thumbnailsApi.themes.wall.toggleHandleResize(false);
    });

    function getDataFromUrl(url){
        var queryStringMatch = url.match(/\?\/(.*)/),
            urlData,
            urlFields;

        if (queryStringMatch){
            urlData = {};
            urlFields = queryStringMatch[1].split("/");

            urlData.type = urlFields[0];
            if (urlFields.length > 1)
                urlData[urlFields[1]] = decodeURIComponent(urlFields[2]);

            return urlData;
        }

        return null;
    }

        /*
    $("body").on("click", "a.innerLink", function(e){
        //if (!this.target){
            var linkData = getDataFromUrl(this.href);
            if (linkData){
                e.preventDefault();
                viewerApi.modules.view.close({ fromHistory: true });
                thumbnailsApi.data.source(linkData);
                currentDataSource = linkData;
            }
        //}
    });
          */
    return{
        addEventListener: eventBus.addEventListener,
        albums: albumsApi,
        createHomeApi: createHomeApi,
        removeEventListener: eventBus.removeEventListener,
        thumbnails: thumbnailsApi,
        get viewer(){
            return viewerApi;
        },
        openViewer: function(){
            eventBus.triggerEvent("toggleView", { isEnabled: true });
        }
    };
});