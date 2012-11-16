yox.themes.cascade = function(data, options){
    var isLoading,
        columnsCount,
        columnWidth,
        columns,
        currentColumn = 0,
        elements,
        self = this;

    this.name = "cascade";

    this.config = {
        thumbnails: {
            createThumbnails: function(items){
                var thumbnails = [];

                columnsCount = Math.floor(elements.container.clientWidth / options.thumbnailsMinWidth);
                createColumns(columnsCount);

                var thumbnail;
                for(var itemIndex = 0, item; item = items[itemIndex]; itemIndex++){
                    thumbnail = createThumbnail(item);
                    columns[currentColumn].appendChild(thumbnail);
                    thumbnails.push(thumbnail);
                    currentColumn++;
                    if (currentColumn === columnsCount)
                        currentColumn = 0;
                }

                return thumbnails;
            }
        }
    };

    function createColumns(count){
        columnWidth = Math.floor((elements.container.clientWidth - options.padding * 2 - options.borderWidth * (count - 1)) / count);
        columns = [];
        for(var i= 0, column; i < count; i++){
            column = createColumn();
            column.style.width = columnWidth + "px";
            if (i < count - 1)
                column.style.marginRight = options.borderWidth + "px";

            columns.push(column);
            elements.thumbnails.appendChild(column);
        }
    }

    function createColumn(){
        var column = document.createElement("div");
        column.className = self.getThemeClass("column");
        return column;
    }

    function getThumbnailHeight(thumbnail){
        return Math.min(Math.floor(columnWidth * thumbnail.ratio), options.thumbnailsMaxHeight);
    }

    function createThumbnail(item){
        var thumbnail = document.createElement("div"),
            thumbnailLink = document.createElement("a"),
            thumbnailImage = document.createElement("img"),
            thumbnailHeightInt = getThumbnailHeight(item.thumbnail),
            thumbnailHeight = thumbnailHeightInt + "px";

        thumbnailLink.appendChild(thumbnailImage);
        thumbnailLink.className = self.getThemeClass("thumbnail")
        thumbnail.appendChild(thumbnailLink);

        thumbnail.className = self.getThemeClass("item");

        thumbnailLink.style.height = thumbnailHeight;
        thumbnailImage.src = item.thumbnail.src;
        thumbnailImage.style.width = (thumbnailHeightInt / item.thumbnail.ratio) + "px";
        thumbnailImage.style.height = thumbnailHeight;

        if (options.createComments && item.social && item.social.commentsCount && item.social.comments && item.social.comments.length){
            var comments = document.createElement("ul"),
                commentItemsHtml = [];

            comments.className = options.classes.comments;

            var getUserLink = options.getUserLink || function(){ return "";},
                userLink,
                lastCommentIndex = Math.max(0, item.social.comments.length - options.commentsInitialMaxDisplay);

            for(var i= item.social.comments.length - 1, comment; (comment = item.social.comments[i]) && i >= lastCommentIndex; i--){
                userLink = getUserLink(comment.user);
                commentItemsHtml.push(
                    "<li class='", options.classes.comment, "'>",
                        "<a class='", options.classes.avatarLink, "' href='", userLink, "'>",
                            comment.user.avatar
                                ? ["<img class=", options.classes.avatar ," src='", comment.user.avatar, "' title=\"", comment.user.username || comment.user.name, "\" />"].join("")
                                : "",
                        "</a><div class='", options.classes.commentTexts, "'>",
                            "<span class='", options.classes.timestamp, "'>", options.formatDate(comment.time), "</span>",
                            "<a class='", options.classes.userLink, "' href='", userLink, "'>", comment.user.username || comment.user.name, "</a>",
                            "<p class='", options.classes.commentText, "' dir='", yox.utils.strings.getDirection(comment.text), "'>", comment.text, "</p>",
                        "</div>",
                    "</li>"
                );
            }
            comments.innerHTML = commentItemsHtml.join("");
            thumbnail.appendChild(comments);
        }

        return thumbnail;
    }

    this.create = function(container){
        elements = {};

        elements.container = container;
        container.classList.add(self.getThemeClass());
        container.style.padding = options.padding + "px";

        elements.thumbnails = document.createElement("div");
        elements.thumbnails.className = "yoxthumbnails";
        container.appendChild(elements.thumbnails);
    }
};

yox.themes.cascade.defaults = {
    borderWidth: 7, // The size, in pixels, of the space between thumbnails
    classes: {
        comment: "yox-theme-cascade-comment",
        avatarLink: "yox-theme-cascade-comment-avatar",
        avatar: "avatar",
        commentTexts: "yox-theme-cascade-comment_texts",
        timestamp: "yox-theme-cascade-comment_timestamp",
        userLink: "yox-theme-cascade-comment_userLink",
        comments: "yox-theme-cascade-comments",
        commentText: "yox-theme-cascade-comment_text"
    },
    commentsInitialMaxDisplay: 3, // The maximum number of comments to display initially for an item
    createComments: true, // Whether to show comments below images
    formatDate: function(date){ return date ? yox.utils.date.getTimeDifference(date) : ""; }, // The function used to format comments dates
    handleResize: true, // Whether to recalculate thumbnails positions when the window is resized. Can be toggle on or off using theme.toggleHandleResize
    padding: 10, // The padding arround the thumbnails (padding for the element that contains all the thumbnails)
    thumbnailsMinWidth: 330, // The minimum width allowed for each thumbnail
    thumbnailsMaxHeight: 450 // The maximum height allowed for each thumbnail
};

yox.themes.cascade.prototype = new yox.theme();