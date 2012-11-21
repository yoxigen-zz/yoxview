yox.data.source = function(name, sourceName, options){
    this.name = name;
    this.sourceName = sourceName;
    this.isLoggedIn = false;
    this.requireAuth = options && options.requireAuth;
};
yox.data.sources = {}; // Will hold the individual data sources

(function(){
    function getNotImplementedError(methodName){
        return new Error("'" + methodName + "' method isn't implemented for this data source.");
    }

    yox.data.source.prototype = {
        feeds: [], // Pre-defined data sources for the source
        //getFollowedUsers: function(userId, callback){ throw getNotImplementedError("getFollowedUsers"); },
        //getFollowingUsers: function(userId, callback){ throw getNotImplementedError("getFollowingUsers"); },
        //getNews: function(callback){},
        getUser: function(userId, callback){ throw getNotImplementedError("getUser"); },
        getUserFeeds: function(user){ return []; },
        load: function(source, callback){
            if (!this.loadData)
                throw getNotImplementedError("loadData");
            else{
                var dfd = $.Deferred();

                if (this.isLoggedIn)
                    this.loadData(source, callback, dfd);
                else{
                    this.login(function(success){
                        if (success)
                            this.loadData(source, callback, dfd);
                        else{
                            dfd.reject({ error: this.sourceName + " authentication failed." });
                        }
                    });
                }

                return dfd;
            }
        },
        loadData: function(source, callback, deferred){ throw getNotImplementedError("loadData"); },
        login: function(callback){ throw getNotImplementedError("login"); },
        match: function(source){ throw getNotImplementedError("match"); },
        search: function(term, options){ throw getNotImplementedError("search"); },
        social: {
            comment: function(itemId, text, callback){ throw getNotImplementedError("social.comment"); },
            getComments: function(item, callback){ throw getNotImplementedError("getComments"); }
            //getLikes: function(item, callback){},
            //like: function(itemId, callback){},
            //unlike: function(itemId, callback){}
        }
    };
})();