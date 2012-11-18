yox.themes.wall = function(data, options){
    this.name = "wall";
    this.modules = {};

    var elements = {},
        containerWidth,
        self = this,
        isLoading, // Flag indicating whether new contents are currently being fetched
        loadedAllItems = false, // Flag indicating whether all the items have been loaded (all the possible items, after loading all pages)
        enlargeThumbnailQueue = [],
        enlargingThumbnails = 0,
        enlargeThumbnailsTimer = 100,
        concurrentEnlargingThumbnails = 3,
        imageLoadBufferSize = 5,
        currentImageLoadBufferCount = 0,
        unknownImages = [],
        rowHeights = [],
        rows = [],
        scrollHeight,
        visibleHeight,
        classes = {
            thumbnail: self.getThemeClass("thumbnail"),
            thumbnailLink: self.getThemeClass("thumbnail-link"),
            thumbnailInfo: self.getThemeClass("thumbnailInfo"),
            thumbnailInfoCount: self.getThemeClass("thumbnailInfo_count"),
            loading: self.getThemeClass("loading"),
            resizing: self.getThemeClass("resizing"),
            loadedAll: self.getThemeClass("loadedAll")
        };

    var thumbs = [],
        currentRowWidth = 0,
        throttledScrollIntoView = yox.utils.performance.throttle(function(element){
            yox.utils.dom.scrollIntoView(element, self.container, options.scrollAnimationDuration, options.scrollOffset);
        }, 300);

    this.config = {
        thumbnails: {
            createThumbnail: function(itemIndex, item, totalItems){
                var thumbnail = document.createElement("div"),
                    thumbnailLink = document.createElement("a"),
                    thumbnailImg = item.thumbnail.src ? document.createElement("img") : undefined,
                    dfd;

                thumbnail.className = classes.thumbnail;
                thumbnailLink.className = classes.thumbnailLink;
                thumbnail.image = thumbnailImg;

                if (thumbnailImg){
                    thumbnailImg.addEventListener("load", onImageLoad, false);
                    thumbnailImg.setAttribute("data-src", item.thumbnail.src);
                    thumbnailLink.appendChild(thumbnailImg);
                }

                thumbnail.style.display = "none";

                thumbnail.appendChild(thumbnailLink);
                thumbnailLink.setAttribute("href", this.options.createThumbnailUrl ? this.options.createThumbnailUrl(item) : item.link || item.url);

                var thumbnailInfo;
                if (options.createThumbnailInfoFunc){
                    thumbnailInfo = options.createThumbnailInfoFunc(item);
                    if (thumbnailInfo && thumbnailInfo.nodeType === 1)
                        thumbnail.appendChild(thumbnailInfo);
                }
                else if (options.createThumbnailInfo && (item.title || item.data && item.data.album)){
                    thumbnailInfo = document.createElement("span");
                    thumbnailInfo.className = classes.thumbnailInfo;
                    thumbnailInfo.innerHTML = item.title;
                    if (yox.utils.strings.isRtl(item.title))
                        thumbnailInfo.dir = "rtl";

                    if (item.data && item.data.album && item.data.album.imageCount !== undefined){
                        var imageCount = document.createElement("span");
                        imageCount.className = classes.thumbnailInfoCount;
                        imageCount.innerHTML = item.data.album.imageCount;
                        thumbnailInfo.appendChild(imageCount);
                    }

                    thumbnail.appendChild(thumbnailInfo);
                }

                if(item.thumbnail.ratio){
                    thumbnail.dimensions = { height: options.thumbnailsMaxHeight, width: Math.round(options.thumbnailsMaxHeight / item.thumbnail.ratio) };
                    //calculateDimensions(thumbnail, itemIndex, totalItems);
                    return thumbnail;
                }
                else{
                    dfd = new $.Deferred();
                    var img = new Image();
                    img.onload = function(){
                        item.thumbnail.ratio = this.height / this.width;
                        thumbnail.dimensions = { height: options.thumbnailsMaxHeight, width: Math.round(options.thumbnailsMaxHeight / item.thumbnail.ratio) };
                       // calculateDimensions(thumbnail, itemIndex, totalItems);
                        dfd.resolve(thumbnail);
                    };
                    img.src = item.thumbnail.src;

                    return dfd;
                }
            },
            events: {
                beforeSelect: function(e){
                    if (options.scrollToElementOnSelect && e.newItem){
                        throttledScrollIntoView(e.newItem.thumbnail.element);
                    }
                },
                "create.thumbnails": function(e){
                    getContainerWidth();

                    var thumbnail, totalItems = e.thumbnails.length;
                    for(var i= 0; i < e.thumbnails.length; i++){
                        thumbnail = e.thumbnails[i];
                        calculateDimensions(thumbnail, i, totalItems);
                    }

                    if (options.fastScroll)
                        fastScroll();
                    else
                        loadImages();
                },
	            resize: updateSize
            }
        }
    };

    if (options.loadItemsOnScroll)
        this.config.thumbnails.events.create = onScroll;

    function measureScrollHeight(){
        scrollHeight = elements.scrollElementForMeasure.scrollHeight;
    }

    function loadImages(){
        var imageLoadBuffer = unknownImages.splice(0, imageLoadBufferSize);
        if (imageLoadBuffer.length){
            currentImageLoadBufferCount = imageLoadBuffer.length;
            for(var i=0, image; image = imageLoadBuffer[i]; i++){
                image.src = image.getAttribute("data-src");
                image.removeAttribute("data-src");
            }
        }

        measureScrollHeight();
    }

    var lastRowWasFull;

    // This function does the resizing that creates the wall effect:
    function calculateDimensions(thumbnail, index, totalThumbnailsCount, isUpdate){
        currentRowWidth += thumbnail.dimensions.width;
        thumbs.push(thumbnail);

        var isLastThumbnail = index === totalThumbnailsCount - 1,
            totalBordersWidth = (thumbs.length - 1) * options.borderWidth,
            isFullRow = currentRowWidth + totalBordersWidth >= containerWidth;

        // Gathered enough thumbnails to fill the current row:
        if (isFullRow || isLastThumbnail){
            var rowAspectRatio = (containerWidth - totalBordersWidth) / currentRowWidth,
                rowHeight = Math.round(thumbs[0].dimensions.height * rowAspectRatio),
                setWidth = true,
                showThumbnail = isFullRow || isLastThumbnail,
                finalRowWidth = totalBordersWidth,
                rowElements = [];

            if (rowHeight > options.thumbnailsMaxHeight){
                rowHeight = options.thumbnailsMaxHeight;
                setWidth = false;
            }

            for(var i=0, thumb; thumb = thumbs[i]; i++){
                var width = Math.floor(thumb.dimensions.width * rowAspectRatio);
                finalRowWidth += width;

                thumb.style.height = rowHeight + "px";
                if (setWidth)
                    thumb.style.width = width + "px";
                else if (isLastThumbnail)
                    thumb.style.width = thumb.dimensions.width + "px";

                if (showThumbnail)
                    thumb.style.removeProperty("display");

                rowElements.push(thumb.image);
            }

            // Due to the rounding in image widths, a small fix is required to arrange the thumbnails pixel-perfectly:
            for(var thumbIndex = thumbs.length; thumbIndex-- && finalRowWidth < containerWidth; finalRowWidth++){
                thumb = thumbs[thumbIndex];
                thumb.style.width = (parseInt(thumb.style.width, 10) + 1) + "px";
            }

            // Finally, the last thumbnail in the row's right margin is removed and the row is closed:
            if (isFullRow){
                thumbnail.style.marginRight = "0";
                thumbs = [];
                currentRowWidth = 0;
            }

            if (options.fastScroll){
                if (lastRowWasFull === false){
                    rows[rows.length - 1] = rowElements;
                    rowHeights[rowHeights.length - 1] = rowHeight;

                    for(var rowElementIndex = 0, rowElement; rowElement = rowElements[rowElementIndex]; rowElementIndex++){
                        showThumbnailImage(rowElement);
                    }
                }
                else{
                    rows.push(rowElements);
                    rowHeights.push(rowHeight);
                }

                lastRowWasFull = isFullRow;
            }
        }
        else if (isUpdate)
            thumbnail.style.removeProperty("margin-right");
    }

    function updateThumbnails(wall){
        var thumbnails = wall.modules.thumbnails.thumbnails;
        if (!thumbnails)
            return;

        var thumbnailsCount = thumbnails.length;

        rowHeights = [];
        rows = [];

        for(var i=0, thumbnail; thumbnail = thumbnails[i]; i++){
            calculateDimensions(thumbnail, i, thumbnailsCount, true);
        }

        visibleRows = null;
        lastRowWasFull = null;

        if (options.fastScroll)
            fastScroll();
    }

    var dataSource,
        totalItems;

    setDataSource(data.getData());

    // Used for infinite scrolling to get the next batch of items.
    // TODO: Try to make this part of the data module itself, so other themes may benefit.
    function loadMoreItems(){
        if (!dataSource)
            return false;

        //dataSource.offset = data.countItems() + 1;
        data.addNextSource();
    }

    function setDataSource(loadedDataSources){
        if (loadedDataSources.length){
            var loadedDataSource = loadedDataSources[0];
            if (!dataSource){
                dataSource = loadedDataSource.source;
                totalItems = loadedDataSource.totalItems;
                dataSource.type = loadedDataSource.sourceType.name;
            }
        }
        isLoading = false;
        $(self.container).removeClass(classes.loading);
    }

    function onImageLoad(){
        if (enlargingThumbnails < concurrentEnlargingThumbnails){
            enlargingThumbnails++;
            this.style.visibility = "visible";
            this.style.setProperty(yox.utils.browser.getCssPrefix() + "transform", "scale(1)", null);
            this.removeEventListener("load", onImageLoad, false);
            setTimeout(function(){
                enlargingThumbnails--;
                if (enlargeThumbnailQueue.length){
                    onImageLoad.call(enlargeThumbnailQueue.shift());
                }
            }, enlargeThumbnailsTimer);
        }
        else{
            enlargeThumbnailQueue.push(this);
        }
    }

    function loadItems(){
        isLoading = true;
        $(self.container).addClass(classes.loading);
        loadMoreItems();
    }

    // Used for infinite scrolling:
    function onScroll(){
        // When reaching the scroll limit, check for new contents:
        if (!isLoading && elements.scrollElementForMeasure.scrollTop >= elements.scrollElementForMeasure.scrollHeight - visibleHeight - options.thumbnailsMaxHeight){
            loadItems();
        }
    }

    data.addEventListener("loadSources", setDataSource);
    data.addEventListener("clear", function(){
        dataSource = null;
        thumbs = [];
        currentRowWidth = 0;
        rows = [];
        rowHeights = [];
        visibleRows = null;
        lastRowWasFull = null;

        getContainerWidth();
        measureScrollHeight();

        if (loadedAllItems){
            loadedAllItems = false;
            if (options.loadItemsOnScroll)
                elements.scrollElement.addEventListener("scroll", onScroll, false);

            data.addEventListener("loadSources", setDataSource);
            $(self.container).removeClass(classes.loadedAll);
        }
    });
    data.addEventListener("loadedLastPage", function(){
        self.triggerEvent("loadedAllItems");
    });

    function getContainerWidth(){
        containerWidth = self.container.clientWidth - options.padding * 2;
        visibleHeight = elements.scrollElementForMeasure.clientHeight;
    }

    function getScrollElement(element){
        var computedStyle = window.getComputedStyle(element, null),
            overflowY = computedStyle.overflowY,
            isOverflow = overflowY === "auto" || overflowY === "scroll";

        if (isOverflow)
            return element;

        var parentNode = element.parentNode;
        if (parentNode && parentNode !== document.documentElement)
            return getScrollElement(parentNode);
        else
            return element;

    }

    var visibleRows;
    function showThumbnailImage(element){
        element.style.display = "inline";
        if (!element.src){
            element.src = element.getAttribute("data-src");
            element.removeAttribute("data-src");

        }
    }

    function showRow(row){
        for(var j = 0, element; element = row[j]; j++){
            showThumbnailImage(element);
        }
    }
    function hideRow(row){
        for(var j = 0, element; element = row[j]; j++){
            element.style.display = "none";
            //element.classList.remove("visible");
        }
    }

    function hideRows(from, to){
        for(var i = from, row; (row = rows[i]) && i <= to; i++){
            hideRow(row);
        }
    }

    function getVisibleRows(scrollTop){
        var totalHeight = 0,
            bottomHeight = scrollTop + visibleHeight,
            length = rowHeights.length,
            firstRow = 0, lastRow = length - 1;

        for(var rowIndex = 0; rowIndex < length; rowIndex++){
            totalHeight += rowHeights[rowIndex];
            if (totalHeight > scrollTop){
                firstRow = rowIndex;
                break;
            }
        }

        for(rowIndex = firstRow + 1; rowIndex < length; rowIndex++){
            totalHeight += rowHeights[rowIndex];
            if (totalHeight > bottomHeight){
                lastRow = rowIndex;
                break;
            }
        }

        return {
            first: firstRow,
            last: lastRow
        };
    }

    if (options.fastScroll){
        var fastScroll = yox.utils.performance.throttle(function(){
            var visibleRowsIndexes = getVisibleRows(elements.scrollElementForMeasure.scrollTop);

            if (visibleRowsIndexes.first === undefined)
                return;

            if (visibleRows && visibleRowsIndexes.first > visibleRows.firstRow){
                hideRows(visibleRows.firstRow, Math.min(visibleRows.lastRow, visibleRowsIndexes.first - 1));
            }

            for(var rowIndex = visibleRowsIndexes.first; rowIndex <= visibleRowsIndexes.last; rowIndex++){
                if (!visibleRows || rowIndex > visibleRows.lastRow || rowIndex < visibleRows.firstRow){
                    showRow(rows[rowIndex]);
                }
            }

            if (visibleRows && visibleRowsIndexes.last < visibleRows.lastRow){
                hideRows(Math.max(visibleRowsIndexes.last + 1, visibleRows.firstRow), visibleRows.lastRow);
            }

            visibleRows = { firstRow: visibleRowsIndexes.first, lastRow: visibleRowsIndexes.last };
        }, 200);
    }
    var handleResize = false,
        onResize;

	function updateSize(){
		self.container.classList.add(classes.resizing);
		getContainerWidth();
		thumbs = [];
		currentRowWidth = 0;
		updateThumbnails(self);

		setTimeout(function(){
			self.container.classList.remove(classes.resizing);
		}, 5);
	}

    this.toggleHandleResize = function(handle){
        if (handle && !handleResize){
            if (!onResize){
                onResize = yox.utils.performance.throttle(updateSize, 250);
            }
            handleResize = true;
            window.addEventListener("resize", onResize, false);
        }
        else if (!handle && handleResize){
            handleResize = false;
            window.removeEventListener("resize", onResize, false);
        }
    };

    this.create = function(container){
        this.container = container;
        var containerClass = this.getThemeClass();

        //$(container).addClass(containerClass).addClass(loadingClass);
        elements.wall = document.createElement("div");
        elements.wall.className = this.getThemeClass("thumbnails") + " yoxthumbnails";
        elements.wall.style.padding = options.padding + "px";
        container.appendChild(elements.wall);

        elements.scrollElement = getScrollElement(container);
        elements.scrollElementForMeasure = elements.scrollElement;

        getContainerWidth();

        var styleEl = document.createElement("style"),
            thumbnailStyle = [
                "margin-right: " + options.borderWidth + "px",
                "margin-bottom: " + options.borderWidth + "px"
            ];

        styleEl.innerHTML = " ." + containerClass + "-thumbnail{ " + thumbnailStyle.join("; ") + " }";
        document.getElementsByTagName("head")[0].appendChild(styleEl);

        if (options.handleResize)
            self.toggleHandleResize(true);

        // All non-webkit browsers measure scrollTop for the body element in the HTML element rather than the document (Firefox 13, IE9, Opera 11.62):
        if (elements.scrollElement === document.body){
            if ($.browser.webkit)
                elements.scrollElement = document;
        }

	    elements.loaderBox = document.createElement("div");
	    elements.loaderBox.className = this.getThemeClass("loader-box");

        elements.loader = document.createElement("div");
        elements.loader.className = this.getThemeClass("loader");
        elements.loader.style.paddingBottom = (options.borderWidth + options.padding) + "px";

        elements.loaderBox.appendChild(elements.loader);
        container.appendChild(elements.loaderBox);

        if (options.loadItemsOnScroll){
            elements.scrollElement.addEventListener("scroll", onScroll, false);
        }

        if (options.fastScroll){
            self.container.classList.add(this.getThemeClass("fastScroll"));
            elements.scrollElement.addEventListener("scroll", fastScroll, false);
        }

        self.addEventListener("loadedAllItems", function(){
            if (options.loadItemsOnScroll)
                elements.scrollElement.removeEventListener("scroll", onScroll, false);
            data.removeEventListener("loadSources", setDataSource);
            loadedAllItems = true;
            $(container).addClass(classes.loadedAll);
        });
    };
}

yox.themes.wall.defaults = {
    borderWidth: 7, // The size, in pixels, of the space between thumbnails
    createThumbnailInfo: false, // Whether to render item information in thumbnails
    handleResize: true, // Whether to recalculate thumbnails positions when the window is resized. Can be toggle on or off using theme.toggleHandleResize.
    fastScroll: !('ontouchstart' in window) || document.documentElement.clientWidth <= 800, // If true, out-of-view thumbnails are hidden (display: none) to improve rendering.
    loadItemsOnScroll: true, // Whether to get more results from the data source when scrolling down
    padding: 10, // The padding arround the thumbnails (padding for the element that contains all the thumbnails)
    scrollAnimationDuration: 500, // The time, in milliseconds, for the scroll animation, when a thumbnail is brought into view.
    scrollOffset: 60, // When scrolling a thumbnail into view, this number of pixels will be added to the scroll distance, so the thumbnail isn't at the very limit of the visible area.
    scrollToElementOnSelect: false, // If set to true, the theme's container will be scrolled to the selected thumbnail when its item is selected
    thumbnailsMaxHeight: 200 // The maximum height allowed for each thumbnail
};

yox.themes.wall.prototype = new yox.theme();