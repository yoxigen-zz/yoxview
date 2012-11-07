yox.data.sources.flickr = (function($){
    var dataSourceName = "flickr",
        flickrUrl = "http://www.flickr.com/",
        flickrApiUrl = "http://api.flickr.com/services/rest/",
        apiKey = "9a220a98ef188519fb87b08d310ebdbe", // yox.js API key @flickr
        flickrUserIdRegex = /\d+@N\d+/,
        flickrUrlRegex = /^http:\/\/(?:www\.)?flickr\.com\/(\w+)\/(?:([^\/]+)\/(?:(\w+)\/?(?:([^\/]+)\/?)?)?)?(?:\?(.*))?/,
        fixedOptions = {
            api_key: apiKey,
            format: 'json'
        },
        defaults = {
            imageSize: "medium", // medium/large/original, for large, your images in Flickr must be 1280 in width or more. For original, you must allow originals to be downloaded
            thumbsize: "thumbnail", // smallSquare (75x75) / thumbnail (100) / small (240) / largeSquare (150x150) / medium (500) / large (1024) / original
            setThumbnail: true,
            setSinglePhotosetThumbnails: true,
            setTitle: true,
            method: 'flickr.photosets.getList',
            extras: 'description',
            per_page: 25
        },
        accessToken = localStorage.getItem("yox_flickr_token"),
        isLogin = !!accessToken;

    var FlickrOauth = function(){
        var token,
            yahooLoginApiUrl = "http://www.flickr.com/services/oauth/request_token",
            yahooAccessTokenUrl = "https://api.login.yahoo.com/oauth/v2/get_token",
            yahooConsumerKey = "9a220a98ef188519fb87b08d310ebdbe",
            yahooConsumerSecret = "5d53ad7616da575a&",
            yahooRedirectCallback = "http://www.yoxigen.com/app/index.html",
            yahooLoginUrl = "https://api.login.yahoo.com/oauth/v2/request_auth?oauth_token=",
            numberRegex = /^\d+$/,
            onToken,
            tempTokenData,
            loading, // Boolean, specifies that a token is in the process
            oauthData = {
                oauth_consumer_key: yahooConsumerKey,
                oauth_signature_method: "HMAC-SHA1",
                oauth_version: "1.0"
            },
            nonceChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
            nonceLength = 20;


        function getTimestamp(){
            return Math.round((new Date()).valueOf() / 1000);
        }
        function getNonce(){
            var nonce = [];
            for( var i=0; i < nonceLength; i++)
                nonce.push(nonceChars.charAt(Math.floor(Math.random() * nonceChars.length)));

            return nonce.join("");
        }

        function getUrlData(url){
            var dataObj = {},
                params = url.split("&");

            for(var i= 0, param; param = params[i]; i++){
                var keyValue = param.split("="),
                    objPropertyName = decodeURIComponent(keyValue[0]);

                dataObj[objPropertyName] = decodeURIComponent(keyValue[1]);

                if (numberRegex.test(dataObj[objPropertyName]))
                    dataObj[objPropertyName] = parseInt(dataObj[objPropertyName], 10);
            }

            return dataObj;
        }

        function getRequestToken(callback, onError){
            var data = {
                callback:"jsonFlickrApi",
                format: "json",
                oauth_nonce: getNonce(),
                oauth_timestamp: getTimestamp(),
                oauth_consumer_key: yahooConsumerKey,
                oauth_signature_method: "HMAC-SHA1",
                oauth_version: "1.0",
                oauth_callback: yahooRedirectCallback
            };

            data.oauth_signature = getSignature(yahooLoginApiUrl, "GET", data);
            delete data.callback;
            $.ajax(yahooLoginApiUrl, {
                cache: true,
                dataType: 'jsonp',
                jsonpCallback: "jsonFlickrApi",
                data: data,
                success: function(data){
                    console.log("request token: ", data);
                    callback(getUrlData(data));
                },
                error: function(e){
                    console.error("request token error: ", e);
                    if (onError)
                        onError(e);
                }
            });
        }

        function getShaBaseString(baseUrl, method, data){
            var parameters = [];
            for(var i in data){
                var value = data[i];
                if (Object(value) === value)
                    value = JSON.stringify(value);
                parameters.push([encodeURIComponent(i), encodeURIComponent(value)].join("="));
            }

            parameters.sort();
            parameters = parameters.join("&");

            return [method.toUpperCase(), encodeURIComponent(baseUrl), encodeURIComponent(parameters)].join("&");
        }
        function getSignature(baseUrl, method, data){
            var key = yahooConsumerSecret + (token && token.oauth_token_secret ? token.oauth_token_secret : ""),
                baseString = getShaBaseString(baseUrl, method, data),
                sha = new jsSHA(baseString, "ASCII");

            console.log("getSignature", baseString, "key: ", key, "result: ", sha.getHMAC(key, "ASCII", "SHA-1", "B64"));
            return sha.getHMAC(key, "ASCII", "SHA-1", "B64") + "=";
        }

        function getAccessToken(tokenData){
            $.ajax(yahooAccessTokenUrl, {
                dataType: 'jsonp',
                jsonpCallback: "jsonFlickrApi",
                data: {
                    oauth_consumer_key: yahooConsumerKey,
                    oauth_signature_method: "PLAINTEXT",
                    oauth_version: "1.0",
                    oauth_verifier: tokenData.verifier,
                    oauth_token: tokenData.requestToken,
                    oauth_timestamp: getTimestamp(),
                    oauth_nonce: getNonce(),
                    oauth_signature: yahooConsumerSecret + tempTokenData.oauth_token_secret
                },
                success: function(data){
                    console.log("DATA:", accessData);
                    var accessData = token = getUrlData(data);

                    oauthData.oauth_token = accessData.oauth_token;
                    oauthData.oauth_timestamp = getTimestamp();
                    oauthData.oauth_nonce = getNonce();

                    for(var i=0; i < onToken.length; i++){
                        onToken[i](oauthData);
                    }
                },
                error: function(e){
                    console.log("getAccessToken error: ", arguments);
                }
            });
        }

        function onTabUpdateHandler(tabId, changeInfo, tab) {
            var tokenRegex = /\/getu.com\/yahoo_mail\?oauth_token=([^$&]+)&oauth_verifier=([^$&]+)$/;

            if (changeInfo.status == 'complete') {
                var tokenMatch = tab.url.match(tokenRegex);
                if (tokenMatch){
                    var tokenData = {
                        requestToken: tokenMatch[1],
                        verifier: tokenMatch[2]
                    };

                    chrome.tabs.remove(tabId);
                    chrome.tabs.onUpdated.removeListener(onTabUpdateHandler);

                    getAccessToken(tokenData);
                }
            }
        }

        this.withOauthData = function(callback){
            if (token){
                oauthData.oauth_timestamp = getTimestamp();
                oauthData.oauth_nonce = getNonce();

                callback(oauthData);
                return true;
            }

            onToken = onToken || [];
            onToken.push(callback);

            if (loading)
                return false;

            loading = true;
            getRequestToken(function(tokenData){
                tempTokenData = tokenData;
                console.log("TOKEN: ", tokenData);
                location.href = yahooLoginUrl + tokenData.oauth_token;
            });
        }

        this.signData = function(baseUrl, method, data){
            delete data.oauth_signature;
            console.log("SIGN: ", data);
            data.oauth_signature = getSignature(baseUrl, method, data);
        };
    };

    var dataTypes = {
        sets: function(source, id){
            return {
                method: id || source.photoset_id ? "flickr.photosets.getPhotos" : "flickr.photosets.getList",
                photoset_id: id
            };
        },
        galleries: function(source, id){
            return {
                method: id ? "flickr.galleries.getPhotos" : "flickr.galleries.getList",
                gallery_id: id
            };
        },
        collections: function(source, id){
            return {
                method: "flickr.collections.getTree",
                collection_id: id
            };
        },
        "default": function(){
            return {
                method: "flickr.photos.search"
            };
        }
    };

    var oauth = new FlickrOauth();

    var flickrImageSizes = {
            smallSquare : "_s", // 75x75
            thumbnail : "_t", // 100px
            small : "_m", // 240px
            medium : "", // 500px
            large : "_b", // 1024px
            original : "_o"
        };
    function getImageUrl(photoData, size){
        return "http://farm" + photoData.farm + ".static.flickr.com/" + photoData.server + "/" + (photoData.primary || photoData.id) + "_" + photoData.secret + size + ".jpg";
    }

    function getPhotosetUrl(userid, photosetId){
         return prepareUrl(flickrUrl + "photos/" + userid + "/sets/" + photosetId + "/");
    }

    // makes sure a string can be used as a Flickr url
    function prepareUrl(url){
        return url.replace(/\s/g, "_");
    }

    function getAvatarImageUrl(photo){
        return ["http://www.flickr.com/buddyicons/", photo.owner, ".jpg"].join("");
    }

    function getImagesDataFromJson(data, datasourceOptions){
        var isPhotos = data.photoset || data.photos,
            photos,
            imagesData = [],
            inSet = data.photoset ? "/in/set-" + data.photoset.id : "";

        if (isPhotos)
            photos = data.photoset ? data.photoset.photo : data.photos.photo;
        else if (data.photosets)
            photos = data.photosets.photoset;
        else if (data.collections)
            photos = data.collections.collection[0].set;

        // Photos:
        if (photos)
        {
            var thumbSuffix = flickrImageSizes[datasourceOptions.thumbsize],
                imageSuffix = flickrImageSizes[datasourceOptions.imageSize];

            $.each(photos, function(i, photo){
                var imageData = {
                    thumbnail: {
                        src : getImageUrl(photo, thumbSuffix),
                        width: 500, height: 500, ratio: 1
                    },
                    link: prepareUrl(flickrUrl + "photos/" + (photo.owner || datasourceOptions.user_id) + "/" + photo.id + inSet),
                    url: getImageUrl(photo, imageSuffix),
                    title: isPhotos ? photo.title : photo.title._content,
                    type: "image",
                    description: photo.description ? photo.description._content : undefined,
                    author: {
                        id: photo.owner,
                        avatar: getAvatarImageUrl(photo),
                        username: photo.owner
                    }
                };

                if (!isPhotos)
                    imageData.data = { photoset_id: photo.id };

                imagesData.push(imageData);
            });
        }

        return imagesData;
    }

    function login(callback){
        if (accessToken){
            callback({ token: accessToken });
            return true;
        }

        location.href = "https://instagram.com/oauth/authorize/?client_id=" + clientId + "&redirect_uri=" + redirectUri + "&response_type=token&state=instagram&scope=basic+likes+comments+relationships";
    }

    return {
        name: dataSourceName,
        sourceName: "Flickr",
        defaults: defaults,
        map: { pageSize: "per_page" },
        match: function(source){
            return source.url && flickrUrlRegex.test(source.url);
        },
        load: function(source, callback){
            var requireLookup = true,
                urlMatch = source.url && source.url.match(flickrUrlRegex),
                queryData,
                fromDataUrl = {},
                lookupData = {
                    method: "flickr.urls.lookupUser",
                    onData: function(data)
                    {
                        return {
                            user_id: data.user.id,
                            username: data.user.username._content
                        };
                    }
                };

            function getData(){
                $.ajax({
                    url: flickrApiUrl,
                    dataType: 'jsonp',
                    data: datasourceOptions,
                    jsonpCallback: "jsonFlickrApi",
                    success: function(data)
                    {console.log("FLICKR DATA: ", data);
                        var returnData = {
                            source: source,
                            sourceType: dataSourceName,
                            createThumbnails: true
                        };

                        returnData.items = getImagesDataFromJson(data, datasourceOptions);

                        if (data.photosets || data.collections)
                            $.extend(returnData, {
                                createGroups: true
                            });

                        if (returnData.items.length > 0 && ((datasourceOptions.setThumbnail && !datasourceOptions.setSinglePhotosetThumbnails) || source.isSingleLink))
                        {
                            $.extend(returnData, {
                                isGroup: true,
                                link: getPhotosetUrl(data.photoset.owner, data.photoset.id),
                                thumbnailSrc: source.isSingleLink ? undefined : getImageUrl(data.photoset.photo[0], flickrImageSizes[datasourceOptions.thumbsize]),
                                title: "None"
                            });
                        }

                        if (callback)
                            callback(returnData);
                    },
                    error : function(xOptions, textStatus){
                        if (options.onLoadError)
                            options.onLoadError("Flickr plugin encountered an error while retrieving data");
                    }
                });
            }

            if (source.url && !urlMatch)
                return false;

            if (urlMatch){
                var urlData = {
                    inputType: urlMatch[1],
                    user: urlMatch[2],
                    dataType: urlMatch[3],
                    id: urlMatch[4],
                    query: urlMatch[5]

                };

                if (urlData.query)
                {
                    queryData = yox.utils.url.queryToJson(urlData.query);
                    $.extend(fromDataUrl, queryData);
                }

                if (urlData.inputType == "search"){
                    fromDataUrl.method = "flickr.photos.search";
                    fromDataUrl.text = queryData.q;
                    if (queryData.w)
                    {
                        queryData.w = queryData.w.replace("%40", "@");
                        if (queryData.w.match(flickrUserIdRegex))
                            fromDataUrl.user_id = queryData.w;
                    }
                    if (!queryData || !queryData.sort)
                        fromDataUrl.sort = "relevance";

                    requireLookup = false;
                }
                else{
                    if (urlData.dataType){
                        $.extend(fromDataUrl, dataTypes[urlData.dataType || "default"](source, urlData.id));

                        if (urlData.dataType === "galleries"){
                            if (urlData.id){
                                requireLookup = true;
                                lookupData = {
                                    method: "flickr.urls.lookupGallery",
                                    onData: function(data)
                                    {
                                        return {
                                            gallery_id: data.gallery.id,
                                            title: data.gallery.title
                                        };
                                    }
                                };
                            }
                        }
                    }
                    else
                        fromDataUrl.method = "flickr.people.getPublicPhotos";

                    fromDataUrl.username = urlData.user;
                    fromDataUrl.type = urlData.dataType;
                }
            }

            var datasourceOptions = jQuery.extend({}, defaults, fromDataUrl,source, fixedOptions);

            datasourceOptions.media = "photos";
            if (datasourceOptions.user && datasourceOptions.photoset_id)
                datasourceOptions.method = "flickr.photosets.getPhotos";

            var screenSize = screen.width > screen.height ? screen.width : screen.height;

            // Save resources for smaller screens:
            if (!datasourceOptions.imageSize || (screenSize.width <= 800 && datasourceOptions.imageSize != "medium"))
                datasourceOptions.imageSize = "medium";

            if (requireLookup){
                var url = source.url;
                if (!url && source.user)
                    url = "http://www.flickr.com/photos/" + source.user + "/";

                $.ajax({
                    url: flickrApiUrl,
                    dataType: 'jsonp',
                    data: $.extend({ url: url, method: lookupData.method }, fixedOptions),
                    jsonpCallback: "jsonFlickrApi",
                    success: function(data)
                    {console.log("lookup: ", data);
                        $.extend(datasourceOptions, lookupData.onData(data));
                        getData();
                    }
                });
            }
            else
                getData();
        },
        login: function(callback){ oauth.withOauthData(callback); }
    };
})(jQuery);