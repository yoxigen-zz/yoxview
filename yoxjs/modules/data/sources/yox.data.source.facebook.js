yox.data.sources.facebook = (function(){
	var dataSourceName = "facebook",
        matchRegex = /^https?:\/\/(?:www|graph\.)?facebook\.com/,
        apiKey = "369774391231",
        isInit,
        isLogin = false,
        currentUser,
        loginCallback,
        initQueue = [],
        currentUserId;

	var convert = {
		album: function(fbAlbum, fbAlbumCover){
			var albumData = {
				title: fbAlbum.name,
				type: "image",
				time: new Date(parseInt(fbAlbum.created, 10) * 1000),
				link: fbAlbum.link,
				author: {
					id: fbAlbum.owner
				},
				data: { album: {
					id: fbAlbum.object_id,
					name: fbAlbum.name,
					imageCount: fbAlbum.photo_count,
					privacy: fbAlbum.visible,
					canUpload: fbAlbum.can_upload,
					url: fbAlbum.object_id + "/photos",
					type: fbAlbum.type
				}},
				source: dataSourceName
			};

			if (fbAlbumCover && fbAlbumCover.images){
				albumData.thumbnail = convert.thumbnail(fbAlbumCover.images[4]);
				if (fbAlbumCover.images.length >= 8)
					albumData.smallThumbnail = convert.thumbnail(fbAlbumCover.images[8]);
			}
			return albumData;
		},
		comments: function(fbComments){
			var comments = [];
			for (var i= 0, comment; comment = fbComments[i]; i++){
				comments.push({
					id: comment.id,
					time: yox.utils.date.parseDate(comment.created_time),
					user: convert.user(comment.from),
					text: comment.message,
					social: {
						likesCount: comment.like_count,
						like: comment.user_likes
					}
				});
			}

			return comments;
		},
		fql: {
			image: function(fqlPhoto, users){
				var image = fqlPhoto.images[0],
					itemData = {
						thumbnail: convert.fql.thumbnail(fqlPhoto.images[4]),
						link: fqlPhoto.link,
						url: image.source,
						width: parseInt(image.width, 10),
						height: parseInt(image.height, 10),
						title: fqlPhoto.caption,
						type: "image",
						time: new Date(parseInt(fqlPhoto.created, 10) * 1000),
						social: {
							comments: [],
							commentsCount: parseInt(fqlPhoto.comment_info.comment_count, 10),
							likesCount: parseInt(fqlPhoto.like_info.like_count, 10),
							like: fqlPhoto.like_info.user_likes,
							likes: []
						},
						originalId: fqlPhoto.object_id
					},
					user = users[fqlPhoto.owner];

				itemData.ratio = image.height / image.width;

				if (user)
					itemData.author = convert.fql.user(user);

				if (fqlPhoto.tags && fqlPhoto.tags.data.length){
					itemData.people = [];
					for(var i= 0, tag; tag = fqlPhoto.tags.data[i]; i++){
						itemData.people.push({ id: tag.id, name: tag.name });
					}
				}

				return itemData;
			},
			user: function(fqlUser){
				return {
					id: fqlUser.id,
					name: fqlUser.name,
					avatar: fqlUser.pic_square,
					source: dataSourceName
				};
			},
			thumbnail: function(fbImage){
				var data = {
					src: fbImage.source,
					width: parseInt(fbImage.width, 10),
					height: parseInt(fbImage.height, 10)
				};

				data.ratio = data.height / data.width;
				return data;
			}
		},
		image: function(fbPhoto){
			var image = fbPhoto.images[0],
				itemData = {
					thumbnail: convert.thumbnail(fbPhoto.images[4]),
					url: image.source,
					width: image.width,
					height: image.height,
					ratio: image.height / image.width,
					link: fbPhoto.link,
					title: fbPhoto.name,
					type: "image",
					author: convert.user(fbPhoto.from),
					time: yox.utils.date.parseDate(fbPhoto.created_time),
					social: {
						comments: fbPhoto.comments ? convert.comments(fbPhoto.comments.data) : [],
						commentsCount: fbPhoto.comments ? fbPhoto.comments.data.length : 0,
						likes: fbPhoto.likes ? convert.users(fbPhoto.likes.data) : [],
						likesCount: fbPhoto.likes ? fbPhoto.likes.data.length : 0
					},
					originalId: fbPhoto.id
				};

			if (fbPhoto.tags && fbPhoto.tags.data.length){
				itemData.people = [];
				for(var i= 0, tag; tag = fbPhoto.tags.data[i]; i++){
					itemData.people.push({ id: tag.id, name: tag.name });
				}
			}

			return itemData;
		},
		user: function(fbUser){
			return {
				id: fbUser.id,
				name: fbUser.name,
				avatar: "http://graph.facebook.com/" + fbUser.id + "/picture",
				source: dataSourceName
			};
		},
		users: function(fbUsers){
			var usersData = [];
			for (var i= 0, user; user = fbUsers[i]; i++){
				usersData.push(convert.user(user));
			}

			return usersData;
		},
		thumbnail: function(fbImage){
			return {
				src: fbImage.source,
				width: fbImage.width,
				height: fbImage.height,
				ratio: fbImage.height / fbImage.width
			};
		}
	};

	var feedsMethods = {
		albums: function(user, callback){
			function getUserAlbums(userId){
				FB.api({
					method: 'fql.multiquery',
					queries: {
						albums: "SELECT aid, object_id, cover_object_id, name, photo_count, can_upload, type, created, owner, link FROM album WHERE owner = " + userId,
						photos: "SELECT object_id, images FROM photo WHERE object_id in (SELECT cover_object_id FROM #albums)"
					}
				}, function(response){
					var albums = response[0].fql_result_set,
						photos = response[1].fql_result_set;

					function findPhoto(photoObjectId){
						for(var j= 0, photo; photo = photos[j]; j++){
							if (photo.object_id === photoObjectId){
								return photos.splice(j, 1)[0];
							}
						}

						return null;
					}

					var albumsData = [];
					for(var i= 0, album; album = albums[i]; i++){
						albumsData.push(convert.album(album, findPhoto(album.cover_object_id)));
					}

					callback(albumsData);
				}, function(e){
					console.error("Can't get Facebook albums for user " + userId + ". Error: ", e);
					callback([]);
				});
			}

			if (typeof(user) === "function"){
				callback = user;
				user = null;
			}

			if (user)
				getUserAlbums(user);
			else {
				public.getUser(function(userData){
					getUserAlbums(userData.id);
				});
			}
		},
		streamPhotos: function(source, callback){
			var sinceQuery = source.since ? " AND created_time < " + source.since.valueOf() / 1000 : "",
				queries = source.friendsOnly ?
				{
					photos: "SELECT pid, object_id, owner, caption, created, images, like_info, comment_info, link FROM photo WHERE object_id in (SELECT attachment.media.photo.fbid FROM stream WHERE filter_key = 'app_2305272732'" + sinceQuery + " AND actor_id IN (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_hidden = 0 LIMIT " + source.pageSize +") LIMIT " + source.pageSize,
					users: "SELECT id, name, pic_square FROM profile WHERE id IN (SELECT owner FROM #photos)"
				} :
				{
					photos: "SELECT pid, object_id, owner, caption, created, images, like_info, comment_info, link FROM photo WHERE object_id in (SELECT attachment.media.photo.fbid FROM stream WHERE filter_key = 'app_2305272732'" + sinceQuery + " AND is_hidden = 0 LIMIT " + source.pageSize +") LIMIT " + source.pageSize,
					users: "SELECT id, name, pic_square FROM profile WHERE id IN (SELECT owner FROM #photos)"
				};

			FB.api({
				method: 'fql.multiquery',
				queries: queries
			}, function(response){
				var photos = response[0].fql_result_set,
					users = response[1].fql_result_set,
					usersObj = {},
					itemsData = [];

				for(var i= 0, user; user = users[i]; i++){
					usersObj[user.id] = user;
				}

				users = null;

				var photo;
				for(i = 0; photo = photos[i]; i++){
					itemsData.push(convert.fql.image(photo, usersObj));
				}

				callback(itemsData);
			});
		}
	};

	function init(){
	    if (/^http/.test(window.location.href)){
	        window.fbAsyncInit = function() {
	            isInit = true;
	
	            FB.init({
	                appId      : apiKey, // App ID
	                channelUrl : '//yoxigen.github.com/yoxview/channel.html', // Channel File
	                status     : true, // check login status
	                cookie     : true, // enable cookies to allow the server to access the session
	                xfbml      : true  // parse XFBML
	            });
	
	            // listen for and handle auth.statusChange events
	            FB.Event.subscribe('auth.statusChange', function(response) {
	                console.log("auth status change: ", response);
	                if (loginCallback){
	                    if (response.authResponse) {
	                        isLogin = true;
	                        loginCallback(true);
	                    } else {
	                        loginCallback(false);
	                    }
	                }
	
	                currentUserId = response.status === "connected" && response.authResponse.userID ? response.authResponse.userID : null;
	            });
	
	            FB.getLoginStatus(function(e){
	                if (e.status === "connected")
	                    isLogin = true;
	            });
	
	            if (initQueue.length){
	                for(var i=0; i < initQueue.length; i++){
	                    initQueue[i]();
	                }
	                initQueue = null;
	            }
	        };
	
	        // Load the SDK Asynchronously
	        (function(d){
	            var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
	            if (d.getElementById(id)) {return;}
	            js = d.createElement('script'); js.id = id; js.async = true;
	            js.src = "//connect.facebook.net/en_US/all.js";
	            ref.parentNode.insertBefore(js, ref);
	        }(document));
	    }
	}
	
	init();
	
    var cacheObj;
    function cache(){
        if (!cacheObj)
            cacheObj = new yox.cache({ id: "facebook_source_" + (currentUserId || "all") });

        return cacheObj;
    }

    

    function getPhotosData(fbData, options, callback){
        var itemsData = [],
            dataFunction = convert.image,
            deferreds = [];

        for(var i=0, item; item = fbData[i]; i++){
            var data = dataFunction(item);
            if (data.promise)
                deferreds.push(data);
            else
                itemsData.push(data);
        }

        if (deferreds.length){
            $.when.apply(this, deferreds).done(function () {
                var itemData;

                for(var itemIndex=0; itemIndex < arguments.length; itemIndex++){
                    var itemData = arguments[itemIndex];
                    if (!itemData.error){
                        itemsData.push(itemData);
                    }
                }
                callback(itemsData);
            });
        }
        else
            callback(itemsData);
    }

    function isLoggedIn(callback){
        if (typeof(FB) !== "undefined" && isInit){
            FB.getLoginStatus(function(result){
                callback(result.status === "connected");
            });
        }
        else{
            initQueue.push(function(){ isLoggedIn(callback); });
        }
    }

    function login(callback){
        isLoggedIn(function(loginStatus){
            if (loginStatus)
                callback(true);
            else{
                loginCallback = callback;
                FB.login(function(){}, {scope: 'user_photos,friends_photos,publish_stream,read_stream,manage_notifications'});
            }
        });
    }

    function getFeedUrl(source){
        if (source.url)
            return source.url;

        var url;
        if (source.user)
            return source.user + "/photos";

        return null;
    }

    function loadData(source, callback, deferred){
        var fbUrl = Object(source) === source ? getFeedUrl(source) : source,
            returnData = {
                source: source,
                sourceType: dataSourceName,
                createThumbnails: true,
                isSets: fbUrl && /albums/.test(fbUrl)
            };

        if (source.cache){
            var cachedData = cache().getItem(source.id);
            if (cachedData){
                returnData.items = cachedData.items;

                callback && callback(returnData);
                deferred.resolve(cachedData);
                return;
            }
        }

        if (source.id === "friends"){
            public.getFollowedUsers(function(result){
                returnData.items = result.users;
                returnData.paging = result.paging;
                returnData.createThumbnails = false;
                if(source.cache)
                    cache().setItem(source.id, { items: returnData.items }, { expiresIn: source.cacheTime }); // Friends are cached for 6 hours

                callback && callback(returnData);
                deferred.resolve(returnData);
            });
        }
        else if (source.id === "stream" || source.id === "stream_friends"){
            source.pageSize = source.pageSize || 25;
            feedsMethods.streamPhotos(source, function(items){
                returnData.items = items;

                if (items.length > 0){
                    returnData.paging = {
                        next: $.extend({}, source, { since: items[items.length - 1].time })
                    }
                }

                callback && callback(returnData);
                deferred.resolve(returnData);
            });
        }
        else if (source.id === "albums"){
            feedsMethods.albums(source.userId, function(items){
                returnData.items = items;
                if(source.cache)
                    cache().setItem(source.id, { items: returnData.items }, { expiresIn: source.cacheTime }); // Albums are cached for 6 hours

                callback && callback(returnData);
                deferred.resolve(returnData);
            });
        }
        else {
            FB.api(fbUrl, function(fbResult){
                returnData.paging = fbResult.paging;

                getPhotosData(fbResult.data, source, function(items){
                    returnData.items = items;

                    callback && callback(returnData);
                    deferred.resolve(returnData);
                });
            });
        }
    }

    var public = {
        feeds: [
            { name: "News Feed", id: "stream", pageSize: 25 },
            { name: "News Feed (friends)", id: "stream_friends", friendsOnly: true, pageSize: 25 },
            { name: "My Photos", id: "photos", url: "me/photos/uploaded" },
            { name: "My Albums", id: "albums", cache: true, cacheTime: 6 * 3600, hasChildren: true, childrenType: "albums" },
            { name: "Photos of me", url: "me/photos", id: "userPhotos" }
        ],
        getComments: function(item, callback){
            FB.api(item.originalId + "/comments", function(result){
                var comments = convert.comments(result.data),
                    paging = comments.length < item.social.commentsCount && result.paging ? result.paging : null;

                callback({ comments: comments, paging: paging });
            });
        },
        getFollowedUsers: function(userId, callback){
            if (typeof(userId) === "function"){
                callback = userId;
                userId = null;
            }

            if (!userId){
                userId = "me";

	            var cacheUsers = cache().getItem("users");
	            if (cacheUsers){
		            return callback && callback(cacheUsers);
	            }
            }
            FB.api(userId + "/friends", function(result){
                var returnData = {
                    users: convert.users(result.data)
                };

                if (result.paging)
                    returnData.paging = result.paging;

                callback(returnData);

	            cache().setItem("users", returnData, { expiresIn: 86400 });
            });
        },
        getLikes: function(item, callback){
            if (!callback || !item || !item.originalId){
                throw new Error("Invalid call to getLikes, requires both item and callback parameters.")
            }

            FB.api(item.social.likesPaging && item.social.likesPaging.next || item.originalId + "/likes", function(result){
                var likes = convert.users(result.data),
                    paging = likes.length < item.social.likesCount && result.paging ? result.paging : null;

                callback({ likes: likes, paging: paging });
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
            else{
                isLoggedIn(function(loginStatus){
                    if (loginStatus){
                        var userFromCache = cache().getItem("user");
                        if (!userId && userFromCache){
                            currentUser = userFromCache;
                            callback(currentUser);
                            return currentUser;
                        }

                        FB.api((userId ? userId : "me") + "?fields=id,name,location", "get", {}, function(data){
                            var user = {
                                id: data.id,
                                name: data.name,
                                avatar: "http://graph.facebook.com/" + data.id + "/picture",
                                source: dataSourceName
                            };

                            if (!userId || userId === "me"){
                                currentUser = user;
	                            cache().setItem("user", user, { expiresIn: 86400 });
                            }

                            callback(user);
                        });
                    }
                    else
                        callback(null);
                });
            }
        },
        getUserFeeds: function(user){
            if (!user || !user.name)
                return [];

            var firstName = user.name.split(" ")[0];
            return [
                { name: "Photos of " + firstName, url: user.id + "/photos", id: "userPhotos" },
                { name: firstName + "'s Photos", url: user.id + "/photos/uploaded", id: "photos" },
                { name: firstName + "'s Albums", id: "albums", hasChildren: true, childrenType: "albums", userId: user.id }
            ];
        },
        isLoggedIn: isLoggedIn,
        load: function(source, callback){
            var dfd = $.Deferred();

            if (isLogin)
                loadData(source, callback, dfd);
            else{
                login(function(success){
                    if (success)
                        loadData(source, callback, dfd);
                    else{
                        loadData({ error: "Facebook authentication failed." });
                        dfd.reject({ error: "Facebook authentication failed." });
                    }
                });
            }

            return dfd;
        },
        login: login,
        loginText: "Connecting using Facebook allows you to upload, view, like and comment on Facebook photos.",
        match: function(source){
            var sourceUrl = Object(source) === source ? source.url : source;
            return sourceUrl && matchRegex.test(sourceUrl);
        },
        name: dataSourceName,
        requireAuth: true,
	    search: {
		    albums: function(term, options){
			    var deferred = $.Deferred();
			    feedsMethods.albums(function(albums){
				    var result = { type: "albums", results: [] },
					    albumNameRegExp = new RegExp(term, "i");

				    for(var i= 0, album; album = albums[i]; i++){
					    if (albumNameRegExp.test(album.title))
					        result.results.push(album);
				    }

				    deferred.resolve(result);
			    });

			    return deferred;
		    },
		    users: function(term, options){
			    var deferred = $.Deferred();
			    public.getFollowedUsers(function(results){
				    var result = { type: "users" },
					    matches = [],
					    nameParts,
					    matchRegExp = new RegExp("^" + term, "i");

				    for(var i= 0, user; (user = results.users[i]) && (!options.limit || matches.length < options.limit); i++){
					    nameParts = user.name.split(/\s/g);
					    if (matchRegExp.test(nameParts[0]))
					        matches.push(user);
					    else if (matchRegExp.test(nameParts[nameParts.length - 1]))
					        matches.push(user);
				    }

				    result.results = matches;

				    deferred.resolve(result);
			    });

			    return deferred;
		    }
	    },
        social: {
            comment: function(itemId, text, callback){
                FB.api(itemId + "/comments", "post", { message: text }, function(response){
                    if (callback){
                        if (response.error)
                            callback({ success: false, error:response.error });
                        else
                            callback({
                                success: true,
                                comment: {
                                    id: response.id,
                                    time: new Date(),
                                    user: currentUser,
                                    text: text,
                                    social: {
                                        likesCount: 0,
                                        like: 0
                                    }
                                }
                            });
                    }
                });
            },
            like: function(itemId, callback){
                FB.api(itemId + "/likes", "post", {}, function(e){
                    if (callback){
                        if (e.error)
                            callback({ success: false, error:e.error });
                        else
                            callback({ success: true });
                    }
                });
            },
            unlike: function(itemId, callback){
                FB.api(itemId + "/likes", "delete", {}, function(e){
                    if (callback){
                        if (e.error)
                            callback({ success: false, error:e.error });
                        else
                            callback({ success: true });
                    }
                });
            }
        },
        sourceName: "Facebook"
    };

	return public;
})();