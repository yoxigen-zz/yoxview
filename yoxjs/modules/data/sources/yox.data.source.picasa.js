yox.data.sources.picasa = (function(){
	var dataSourceName = "picasa",
        picasaRegex = /^https?:\/\/picasaweb\.google\./,
        picasaMatchRegex = /^https?:\/\/picasaweb\.google\.\w+\/([^\/#\?]+)\/?([^\/#\?]+)?(?:\?([^#]*))?/,
        apiUrl = "https://picasaweb.google.com/data/feed/api/",
        picasaCropSizes = [32, 48, 64, 72, 104, 144, 150, 160],
        picasaUncropSizes = [94, 110, 128, 200, 220, 288, 320, 400, 512, 576, 640, 720, 800, 912, 1024, 1152, 1280, 1440, 1600].concat(picasaCropSizes).sort(function(a,b){ return a-b; }),
        clientId = "1064360251009.apps.googleusercontent.com",
        currentUser,
        accessToken = localStorage.getItem("yox_picasa_token"),
        tokenExpires = accessToken ? new Date(parseInt(localStorage.getItem("yox_picasa_token_expires"), 10)) : null,
        urlTokenMatch = /[&#\?]state=picasa[&$]/.test(window.location.href) && window.location.href.match(/access_token=([^&$]+)/);

    checkTokenExpiry();

    if (urlTokenMatch){
        accessToken = urlTokenMatch[1];
        tokenExpires = new Date(new Date().valueOf() + parseInt(window.location.href.match(/expires_in=(\d+)/)[1], 10) * 1000);

        $.ajax({
            url: "https://www.googleapis.com/oauth2/v1/tokeninfo",
            dataType: 'jsonp',
            data: { access_token: accessToken },
            success: function(data)
            {
                if (data.error){
                    console.log("Picasa authorization error: ", data.error);
                    accessToken = null;
                    tokenExpires = null;
                }
                else if (data.audience === clientId){
                    localStorage.setItem("yox_picasa_token", accessToken);
                    localStorage.setItem("yox_picasa_token_expires", tokenExpires.valueOf());
                }
            }
        });
    }

    function checkTokenExpiry(){
        if (accessToken && (!tokenExpires || tokenExpires < new Date())){
            accessToken = null;
            tokenExpires = null;
            return false;
        }

        return true;
    }

    var cacheObj;
    function cache(){
        if (!cacheObj)
            cacheObj = new yox.cache({ id: "picasa_source" });

        return cacheObj;
    }

    function getDataFromUrl(source, options){
        var data = $.extend({}, public.defaults, options),
            urlMatch;

        if (source.url){
            if (source.url.indexOf(apiUrl) === 0){
                var query = source.url.split("?");
                if (query.length > 1){
                    var fields = query[1].split("&");
                    for(var i = 0, field; i < fields.length; i++){
                        field = fields[i].split("=")
                        data[field[0]] = field[1] || true;
                    }
                }

                data.url = query[0];
            }
            else{
                urlMatch = source.url.match(picasaMatchRegex);
                delete data.url;
            }
        }
        else if (Object(source) === source)
            $.extend(data, source);

        if (urlMatch && urlMatch.length > 1)
        {
            var urlData = {
                user: urlMatch[1],
                album: urlMatch[2],
                query: urlMatch[3]
            };

            data.user = urlData.user;

            if (urlData.album)
                data.album = urlData.album;

            if (urlData.query)
                $.extend(data, yox.utils.url.queryToJson(urlData.query));
        }

        if (data.album){
            data.fields += ",entry(summary),gphoto:name,entry(gphoto:timestamp),entry(gphoto:commentCount),entry(gphoto$commentingEnabled),entry(author)";
        }
        else
            data.fields += ",entry(title),entry(gphoto:numphotos),entry(gphoto:name),entry(link[@rel='alternate']),author,entry(summary),entry(id),entry(gphoto:timestamp)";

        data.imgmax = getImgmax(picasaUncropSizes, data.imgmax);
        data.thumbsize = getImgmax(data.cropThumbnails ? picasaCropSizes : picasaUncropSizes, data.thumbsize) + (data.cropThumbnails ? "c" : "u");

        if (accessToken && checkTokenExpiry())
            data.access_token = accessToken;

        return data;
    }

    function getImgmax(picasaSizes, optionsImgmax){
        var imgmax = Math.min(optionsImgmax, Math.max(screen.width, screen.height));

        for(var i=picasaSizes.length, picasaSize; (i-- -1) && (picasaSize = picasaSizes[i]) && picasaSizes[i - 1] >= imgmax;){}
        return picasaSize;
    }

    function getFeedUrl(picasaData)
    {
        var feedUrl = apiUrl;
        if (picasaData.user && picasaData.user != "lh")
        {
            feedUrl += "user/" + picasaData.user;
            if (picasaData.album)
                feedUrl += "/album/" + picasaData.album;
        }
        else
            feedUrl += "all";

        return feedUrl;
    }

    function getImagesData(picasaData, source, authorData)
    {
        var itemsData = [];

        jQuery.each(picasaData.feed.entry, function(i, image){
            var isAlbum = image.category[0].term.match(/#(.*)$/)[1] === "album";
            if (isAlbum && !image.gphoto$numphotos.$t)
                return true;

            var imageTitle = isAlbum ? image.title.$t : image.summary.$t,
                mediaData = image.media$group.media$content[0],
                thumbnailData = image.media$group.media$thumbnail[0],
                itemData = {
                    thumbnail: {
                        src: thumbnailData.url
                    },
                    url: mediaData.url,
                    link: image.link[0].href,
                    title: imageTitle,
                    type: "image",
                    author: authorData,
                    time: new Date(parseInt(image.gphoto$timestamp.$t, 10)),
                    social: {
                        commentsCount: image.gphoto$commentCount && image.gphoto$commentCount.$t
                    }
                };
            try{
            if (!authorData && image.author){
                var author = image.author[0];
                itemData.author = {
                    id: author.gphoto$user.$t,
                    name: author.name.$t,
                    link: author.uri.$t,
                    avatar: "http://profiles.google.com/s2/photos/profile/" + author.gphoto$user.$t,
                    source: dataSourceName
                };
            }
            } catch(e){ console.log("ERROR: ", image, e)}
            if (source.cropThumbnails){
                $.extend(itemData.thumbnail, {
                    width: source.thumbsize,
                    height: source.thumbsize,
                    ratio: 1
                });
            }
            else if (!isAlbum){
                $.extend(itemData.thumbnail, {
                    width: thumbnailData.width,
                    height: thumbnailData.height,
                    ratio: thumbnailData.height / thumbnailData.width
                });
            }

            if (itemData.width){
                itemData.width = parseInt(image.gphoto$width, 10);
                itemData.height = parseInt(image.gphoto$height, 10);
                itemData.ratio = itemData.height / itemData.width;
            }

            if (isAlbum){
                itemData.data = {
                    album: {
                        id: image.gphoto$name.$t,
                        name: imageTitle,
                        imageCount: image.gphoto$numphotos.$t,
                        description: image.summary.$t,
                        url: image.link[0].href
                    }};
                itemData.isLoaded = true;
            }
            else{
                $.extend(itemData, {
                    width: mediaData.width,
                    height: mediaData.height,
                    ratio: mediaData.height / mediaData.width
                });
            }

            itemsData.push(itemData);
        });

        return itemsData;
    }

    function getUser(userId, callback){
        if (typeof(userId) === "function"){
            callback = userId;
            userId = null;
        }

        if (!callback)
            throw new Error("data.getUser requires a callback function.");

        if (!userId && currentUser)
            callback(currentUser);
        else if (accessToken && tokenExpires > new Date() && !userId){
            $.ajax({
                url:" https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=" + accessToken,
                dataType: "jsonp",
                success: function(rawData)
                {
                    var userData = {
                        name: rawData.name,
                        id: rawData.id,
                        avatar: rawData.picture,
                        source: dataSourceName
                    };

                    if (!userId)
                        currentUser = userData;

                    callback(userData);
                }
            });
        }
        else if (userId){
            $.ajax({
                url: "https://picasaweb.google.com/data/feed/api/user/" + userId,
                dataType: 'jsonp',
                data: { fields: "author,gphoto:user", alt: "json" },
                success: function(data){
                    data = data.feed;
                    callback({
                        id: data.gphoto$user.$t,
                        name: data.author[0].name.$t,
                        avatar: "http://profiles.google.com/s2/photos/profile/" + data.gphoto$user.$t,
                        source: dataSourceName
                    });
                },
                error: function(e){
                    callback({ error: e });
                }
            });
        }
    }

    function loadData(source, callback){console.log("load: ", source, new Error().stack)
        var returnData = {
            source: source,
            sourceType: dataSourceName,
            createThumbnails: true
        };

        if (source.cache){
            var cachedData = cache().getItem(source.id);
            if (cachedData){
                returnData.items = cachedData.items;
                returnData.totalItems = cachedData.totalItems;
                callback(cachedData);
                return;
            }
        }

        var picasaData = getDataFromUrl(source, source);
        delete picasaData.fields;

        $.ajax({
            url: picasaData.url || getFeedUrl(picasaData),
            dataType: 'jsonp',
            data: picasaData,
            success: function(data)
            {
                returnData.totalItems = data.feed.openSearch$totalResults.$t;

                if (!data.feed.entry || data.feed.entry.length == 0){
                    returnData.items = [];
                }
                else{
                    var kind = data.feed.category ? data.feed.category[0].term.match(/#(.*)$/)[1] : "photo",
                        author = data.feed.author && data.feed.author[0],
                        authorData;
                    if (author){
                        authorData = {
                            id: author.uri.$t.match(/\d+/)[0],
                            name: author.name.$t,
                            link: author.uri.$t,

                            source: dataSourceName
                        };

                        authorData.avatar = "http://profiles.google.com/s2/photos/profile/" + authorData.id;
                    }

                    if (kind === "user"){
                        var author = data.feed.author[0];
                        $.extend(returnData, {
                            title: data.feed.title.$t,
                            data: {
                                kind: "user",
                                author: authorData
                            }
                        });
                    }
                    returnData.createThumbnails = true;
                    returnData.items = getImagesData(data, source, authorData);

                    if (source.cache)
                        cache().setItem(source.id, { items: returnData.items, totalItems: returnData.totalItems }, { expiresIn: source.cacheTime }); // Albums are cached for 6 hours
                }

                if (callback)
                    callback(returnData);
            },
            error : function(xOptions, textStatus){
                console.log("error: ", arguments);
            }
        });
    }

    var public = {
        defaults: {
            v: 2,
            setThumbnail: true,
            setSingleAlbumThumbnails: true,
            setTitle: true, // Whether to add a header with user and/or album name before thumbnails
            alt: 'json',
            cropThumbnails: false,
            "max-results": 25,
            thumbsize: 64,
            imgmax: picasaUncropSizes[picasaUncropSizes.length - 1],
            fields: "category(@term),entry(category(@term)),title,entry(summary),entry(media:group(media:thumbnail)),entry(media:group(media:content(@url))),entry(media:group(media:content(@width))),entry(media:group(media:content(@height))),entry(link[@rel='alternate'](@href)),entry(media:group(media:credit)),openSearch:totalResults,entry(gphoto:height),entry(gphoto:width),entry(author)"
        },
        feeds: [
            { name: "My Albums", id: "userAlbums", hasChildren: true, user: "default", childrenType: "albums", cache: true, cacheTime: 6 * 3600 },
            { name: "Featured Photos", id: "featured", url: "https://picasaweb.google.com/data/feed/api/featured" }
        ],
        getUser: getUser,
        getUserFeeds: function(user){
            if (!user)
                return [];

            var firstName = user.name.split(" ")[0];
            return [
                { name: firstName + "'s Albums", id: "userAlbums", hasChildren: true, user: user.id, childrenType: "albums" }
            ];
        },
        isLoggedIn: function(callback){
            callback(checkTokenExpiry());
        },
        load: function(source, callback){
            var dfd = $.Deferred();
            if (source.user && source.user === "default" && (!accessToken || !checkTokenExpiry()))
                public.login();
            else
                loadData(source, function(data){
                    callback && callback(data);
                    dfd.resolve(data);
                });

            return dfd.promise();
        },
        login: function(callback){
            if (accessToken && checkTokenExpiry()){
                callback && callback(accessToken);
                return true;
            }

            location.href = "https://accounts.google.com/o/oauth2/auth?response_type=token&client_id=" + clientId +
                "&scope=" + encodeURIComponent("https://picasaweb.google.com/data/") + "+" + encodeURIComponent("https://www.googleapis.com/auth/userinfo.profile") +
                "&state=picasa&redirect_uri=" +
                encodeURIComponent("http://www.yoxigen.com/app/index.html");
        },
        map: { pageSize: "max-results", offset: "start-index" },
        match: function(source){ return source.url && picasaRegex.test(source.url); },
        name: dataSourceName,
        search: function(term, options, callback){
            if (options.searchType === "tags")
                options.tag = term;
            else
                options.q = term;

            var dfd = $.Deferred();
            return public.load(options, function(data){
                callback && callback(data);
                dfd.resolve(data);
            });

            return dfd.promise();
        },
        sourceName: "Picasa"
    };

    return public;
})();