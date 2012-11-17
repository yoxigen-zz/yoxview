yox.data.sources.instagram = (function(){
	var dataSourceName = "instagram",
        defaults = {
            user: "me"
        },
        apiUrl = "https://api.instagram.com/v1/",
        clientId = "d5030467b47e4d9691e566b5a47d5e81",
        redirectUri = "http://yoxigen.github.com/yoxview/",
        accessToken = localStorage.getItem("yox_instagram_token"),
        isLogin = !!accessToken,
        currentUser,
        cachedUsers,
        urlTokenMatch = /state=instagram/.test(window.location.href) && window.location.href.match(/access_token=([^&$]+)/);

    if (urlTokenMatch){
        accessToken = urlTokenMatch[1];
        localStorage.setItem("yox_instagram_token", accessToken);
        isLogin = true;
    }

    function getCachedUsers(callback){
        if (!cachedUsers){
            var storageData = localStorage.getItem("yox_instagram_users");
            if (storageData)
                cachedUsers = JSON.parse(storageData);
            else
                cachedUsers = {};
        }

        callback(cachedUsers);
    }

    var maxCachedUsers = 200;
    function cacheUser(user){
        if (!cachedUsers[user.username]){
            if (Object.keys && Object.keys(cachedUsers).length >= maxCachedUsers){
                cachedUsers = {};
            }

            cachedUsers[user.username] = user;
            localStorage.setItem("yox_instagram_users", JSON.stringify(cachedUsers));
        }
    }

    function getUser(username, callback){
        getCachedUsers(function(users){
            var userData = users[username];
            if (userData)
                callback(userData);
            else{
                $.ajax({
                    url: apiUrl + "users/search?q=" + username + "&count=1&access_token=" + accessToken,
                    dataType: 'jsonp',
                    jsonpCallback: "callback",
                    success: function(instagramData)
                    {
                        if (instagramData.data && instagramData.data.length){
                            userData = getUserData(instagramData.data[0]);
                            cacheUser(username, userData);
                            callback(userData);
                        }
                        else
                            callback(null);
                    },
                    error: function(e){
                        console.error("User '" + username + "' not found. Error: ", e);
                        callback(null);
                    }
                });
            }
        })
    }

    function getUserData(instagramUser){
        return {
            name: instagramUser.full_name,
            id: instagramUser.id,
            avatar: instagramUser.profile_picture,
            username: instagramUser.username,
            website: instagramUser.website,
            source: dataSourceName
        };
    }

    function getComments(instagramComments){
        var comments = [];
        for (var i= 0, comment; comment = instagramComments[i]; i++){
            comments.push({
                id: comment.id,
                time: new Date(comment.created_time * 1000),
                user: getUserData(comment.from),
                text: comment.text
            });
        }
        
        return comments;
    }

    function getLikes(instagramLikes){
        var likes = [];
        for (var i= 0, user; user = instagramLikes[i]; i++){
            likes.push(getUserData(user));
        }
        
        return likes;
    }
        
    function getImageData(imageData, options){
        var image = imageData.images.standard_resolution,
            itemData = {
                originalId: imageData.id,
                thumbnail: getThumbnailData(imageData.images.low_resolution),
                url: image.url,
                width: image.width,
                height: image.height,
                ratio: image.height / image.width,
                link: imageData.link,
                title: imageData.caption ? imageData.caption.text : null,
                type: "image",
                time: new Date(imageData.created_time * 1000),
                social: {
                    commentsCount: imageData.comments.count,
                    comments: getComments(imageData.comments.data),
                    likesCount: imageData.likes.count,
                    like: imageData.user_has_liked,
                    likes: getLikes(imageData.likes.data)
                },
                author: getUserData(imageData.user)
            };

        return itemData;
    }

    function getAlbumData(data, options){
        var albumData = {
            title: data.name,
            id: data.id,
            type: "image",
            link: data.name,
            data: { album: {
                name: data.name,
                url: data.url,
                id: data.id
            }},
            thumbnail: {
                src: "",
                width: 306,
                height: 306,
                ratio: 1
            }
        };

        return albumData;
    }

    function getThumbnailData(photo){
        return {
            src: photo.url,
            width: photo.width,
            height: photo.height,
            ratio: photo.height / photo.width
        };
    }

    function getItemsData(instagramData, options){
        var itemsData = [];
        if (instagramData){
            for(var i=0, item; item = instagramData[i]; i++){
                itemsData.push(getImageData(item));
            }
        }
        return itemsData;
    }

    function getAlbumsData(source, callback, deferred){
        var albums = [
                { name: "My feed", url: "users/self/feed", id: "feed" },
                { name: "Most popular", url: "media/popular", id: "popular" },
                { name: "Images I liked", url: "users/self/media/liked", id: "liked" },
                { name: "Recent", url: "users/self/media/recent", id: "recent" }
            ],
            albumsData = {
                source: source,
                sourceType: dataSourceName,
                createThumbnails: true,
                items: []
            };

        for(var i=0; i < albums.length; i++){
            albumsData.items.push(getAlbumData(albums[i], source));
        }

        callback && callback(albumsData);
        deferred.resolve(albumsData);
    }

    function prepareGetUsers(endpoint){
        return function(userId, callback){
            if (typeof(userId) === "function"){
                callback = userId;
                userId = null;
            }

            if (!userId)
                userId = "self";

            getUsers(endpoint, userId, callback);
        }
    }

    function getUsers(endpoint, userId, callback){
        $.ajax({
            url: apiUrl + "users/" + userId + "/" + endpoint + "?access_token=" + accessToken,
            dataType: 'jsonp',
            jsonpCallback: "callback",
            success: function(instagramData)
            {
                var returnData = {
                        users: []
                    };

                if (instagramData.data && instagramData.data.length){
                    for(var i= 0, user; user = instagramData.data[i]; i++){
                        returnData.users.push(getUserData(user));
                    }
                    callback(returnData);
                }
                else
                    callback(returnData);
            },
            error: function(e){
                callback({ error: "Can't retrieve user '" + endpoint + "' list.", originalError: e });
            }
        });
    }

    function login(callback){
        if (accessToken){
            callback({ token: accessToken });
            return true;
        }

        location.href = "https://instagram.com/oauth/authorize/?client_id=" + clientId + "&redirect_uri=" + redirectUri + "&response_type=token&state=instagram&scope=basic+likes+comments+relationships";
    }

    function getFeedUrl(source, callback){
        var url = apiUrl;

        if (source.url){
            if (/\?access_token=/.test(source.url)){
                callback(source.url);
                return source.url;
            }

            url += source.url;
        }

        if (source.user && !/^\d+$/.test(source.user)){
            getUser(source.user, function(userData){
                if (userData)
                    callback(url += "users/" + userData.id + "/media/recent?access_token=" + accessToken);
            });
        }
        else {
            if (source.user)
                url += "users/" + source.user + "/media/recent";
            else if (source.tag)
                url += "tags/" + source.tag + "/media/recent";
            else if (source.location)
                url += "locations/" + source.location + "/media/recent";

            url += "?access_token=" + accessToken;
            callback(url);
        }
    }

    function loadData(source, callback, deferred){
        if (source.url === "albums"){
            getAlbumsData(source, callback, deferred);
        }
        else{
            getFeedUrl(source, function(url){
                $.ajax({
                    url: url,
                    dataType: 'jsonp',
                    jsonpCallback: "igcallback",
                    success: function(instagramData)
                    {
                        var returnData = {
                            source: source,
                            sourceType: dataSourceName,
                            createThumbnails: true,
                            items: getItemsData(instagramData.data)
                        };

                        if (instagramData.pagination){
                            returnData.paging = {
                                next: { url: instagramData.pagination.next_url, type: dataSourceName }
                            }
                        }

                        if (callback)
                            callback(returnData);

                        deferred.resolve(returnData);
                    }
                });
            });
        }
    }

    var public = {
        feeds: [
            { name: "My feed", url: "users/self/feed", id: "feed" },
            { name: "Images I liked", url: "users/self/media/liked", id: "liked" },
            { name: "My Uploads", url: "users/self/media/recent", id: "recent" },
            { name: "Most popular", url: "media/popular", id: "popular" }
        ],
        getFollowedUsers: prepareGetUsers("follows"),
        getFollowingUsers: prepareGetUsers("followed-by"),
        getLikes: function(item, callback){
            if (!callback || !item || !item.originalId){
                throw new Error("Invalid call to getLikes, requires both item and callback parameters.")
            }

            $.ajax({
                url: apiUrl + "media/" + item.originalId + "/likes?access_token=" + accessToken,
                dataType: "jsonp",
                jsonpCallback: "callback",
                success: function(instagramData){
                    var likes;
                    if (instagramData.data)
                        likes = getLikes(instagramData.data);
                    else
                        likes = [];

                    callback({ likes: likes });
                },
                error: function(e){
                    callback({ error: e });
                }
            });
        },
        getNews: function(callback){
            return isLogin ? public.load(public.feeds[0], callback) : null;
        },
        getUser: function(userId, callback){
            if (typeof(userId) === "function"){
                callback = userId;
                userId = null;
            }

            if (!callback)
                throw new Error("data.getUser requires a callback function.");

            if (!userId && currentUser)
                callback(currentUser);
            else if (isLogin){
                if (!userId){
                    var storageUser = localStorage.getItem("yox_instagram_user");
                    if (storageUser){
                        currentUser = JSON.parse(storageUser);
                        callback(currentUser);
                        return currentUser;
                    }
                }

                console.log("AJAX get user: ", userId);
                $.ajax({
                    url: apiUrl + "users/" + (userId || "self") + "?access_token=" + accessToken,
                    dataType: "jsonp",
                    jsonpCallback: "callback",
                    success: function(instagramData)
                    {
                        if (instagramData.data)
                            var userData = getUserData(instagramData.data);
                        else
                            userData = { id: userId, source: dataSourceName };

                        if (!userId){
                            currentUser = userData;
                            localStorage.setItem("yox_instagram_user", JSON.stringify(userData));
                        }

                        callback(userData);
                    }
                });
            }
            else
                callback(null);
        },
        getUserFeeds: function(user){
            if (!user)
                return [];

            var firstName = user.name ? user.name.split(" ")[0] : user.username;
            return [
                { name: (firstName || user.id) + "'s Uploads", url: "users/" + user.id + "/media/recent", id: "recent" }
            ];
        },
        isLoggedIn: function(callback){
            callback(isLogin);
        },
        load: function(source, callback){
            var dfd = $.Deferred();

            if (isLogin)
                loadData(source, callback, dfd);
            else{
                login(function(success){
                    if (success)
                        loadData(source, callback, dfd);
                    else{
                        loadData({ error: "Instagram authentication failed." });
                        dfd.reject({ error: "Instagram authentication failed." });
                    }
                });
            }

            return dfd;
        },
        login: login,
        loginText: "Signing in with Instagram allows you to view, like and comment on Instagram images.",
        match: function(source){
            return source.type === "instagram";
        },
        name: dataSourceName,
        requireAuth: true,
        search: function(term, options, callback){
            var dfd = $.Deferred();
            if (!isLogin)
                dfd.resolve(null);

            public.load({ url: "tags/" + term + "/media/recent" }, function(data){
                callback && callback(data);
                dfd.resolve(data);
            });
            return dfd.promise();
        },
        social: {
            like: function(itemId, callback){
                var formData = new FormData(),
                    returned = false;

                formData.append("access_token", accessToken);

                var xhr = new XMLHttpRequest();
                xhr.open("POST", apiUrl + "media/" + itemId + "/likes");
                xhr.onreadystatechange = function(e){
                    if (!returned){
                        returned = true;

                        // I haven't found any way to verify that the request went through successfully, but it seems to work properly.
                        callback && callback({ success: true });
                    }
                };

                xhr.send(formData);
            },
            unlike: function(itemId, callback){
                var formData = new FormData(),
                    returned = false;

                formData.append("access_token", accessToken);

                var xhr = new XMLHttpRequest();
                xhr.open("DELETE", apiUrl + "media/" + itemId + "/likes");
                xhr.onreadystatechange = function(e){
                    if (!returned){
                        returned = true;

                        // I haven't found any way to verify that the request went through successfully, but it seems to work properly.
                        callback && callback({ success: true });
                    }
                };

                xhr.send(formData);
            }
        },
        sourceName: "Instagram"
    };

	return public;
})();