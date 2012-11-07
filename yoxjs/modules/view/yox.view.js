(function($){
    yox.utils.css.addJqueryCssHooks(["transition", "transitionDuration", "transform", "transformOrigin", "transformStyle", "backfaceVisibility", "perspective"]);

	yox.view = function(container, options, cache){
        var optionsEvents = $.extend({}, options.events),
            config = yox.view.config,
            platformConfig = yox.view.config.platform[yox.utils.browser.getPlatform()];

        cache = cache || yox.view.cache;
        delete options.events;

        var viewOptions = $.extend(true, {}, config.mode[options.resizeMode || platformConfig.resizeMode || config.defaults.resizeMode], config.defaults, platformConfig, options);

        // Merge the options events with the default ones:
        for(var eventName in optionsEvents){
            var eventHandlers = viewOptions.events[eventName],
                events = optionsEvents[eventName];

            if (!eventHandlers)
                eventHandlers = viewOptions.events[eventName] = [];
            else if (!(eventHandlers instanceof Array))
                eventHandlers = viewOptions.events[eventName] = [eventHandlers];

            if (events instanceof Array)
                eventHandlers = eventHandlers.concat(events);
            else if (typeof events === "function")
                eventHandlers.push(events);
        }

		this.container = container;
        this.$container = $(container);
		this.options = viewOptions;
		this.id = yox.view.id ? ++yox.view.id : 1;
        this.cache = cache;
        this.direction = 1;

        for (var property in this){
            var f = this[property];
            if (typeof f === "function"){
                this[property] = f.bind(this);
            }
        }

        this.init();
	}

    yox.view.prototype = (function(){
        function setTransition(transition){
            var transitionModeConstructor = typeof transition === "string" ? yox.view.transitions[transition] : transition;
            if (!transitionModeConstructor)
                throw new Error("Invalid transition - \"" + transition + "\" doesn't exist.");

            var transitionMode = new transitionModeConstructor();

            if (!(transitionMode instanceof yox.view.transition))
                throw new Error("Invalid transition - transition constructors must have yox.view.transition as prototype.");

            transitionMode.create.call(this, this.$container);
            this.transition = transitionMode;
        }

        function createViewer(view){
            var elements = {};

            if (view.$container.css("position") === "static")
                view.$container.css("position", "relative");

            $.extend(view, {
                getPosition: yox.utils.dimensions.resize[view.options.resizeMode],
                elements: elements
            });

            setTransition.call(view, view.options.transition);
        }

        function createInfo(){
            var $info = $("<div>", {
                "class": "yoxview_info"
            });
            return $info;
        }

        var onOptionsChange = {
            resizeMode: function(resizeMode){
                this.getPosition = yox.utils.dimensions.resize[resizeMode];
            },
            transition: function(newTransition){
                this.transition.destroy.call(this);
                setTransition.call(this, newTransition);

                var currentItemId = this.currentItem.id - 1;
                this.currentItem = null;
                this.selectItem(currentItemId);
            }
        };

        var itemTypes = {
            html: {
                clear: function(element){
                    element.innerHTML = "";
                },
                create: function(){
                    var div = document.createElement("div");
                    div.style.overflow = "hidden";
                    return div;
                },
                set: function(item, element){
                    element.loading = false;
                    if (item.element){
                        element.innerHTML = "";
                        element.appendChild(item.element);
                    }
                    else
                        element.innerHTML = item.html;

                    item.width || (item.width = this.containerDimensions.width);
                    item.height || (item.height = this.containerDimensions.height);
                    item.ratio = item.height / item.width;

                    var position = this.getPosition(item, this.containerDimensions, this.options);
                    this.transition.transition.call(this, { position: position, index: item.id - 1, item: item });
                    this.triggerEvent("select", item);
                }
            },
            image: (function(){
                function onImageLoad(e){
                    var view = e instanceof yox.view ? e : e.data.view;
                    this.loading = false;
                    if (view.currentItem && view.currentItem.url !== this.src && view.currentItem.thumbnail.src !== this.src)
                        return false;

                    if (view.currentItem && (!view.options.showThumbnailsBeforeLoad || this.loadingThumbnail)){
                        this.loadingThumbnail = false;
                        var item = view.currentItem,
                            position = view.getPosition(item, view.containerDimensions, view.options)

                        if (view.options.showThumbnailsBeforeLoad && view.previousItem &&  view.previousItem.thumbnail){

                            var previousImage = checkElementExists(view.transition.getNotCurrentPanel());
                            if (previousImage.image.src)
                                previousImage.image.src = view.previousItem.thumbnail.src;
                        }

                        view.transition.transition.call(view, { position: position, index: item.id - 1, item: item });
                    }
                    else if (view.currentItem){
                        view.triggerEvent("imageLoadEnd", { item: view.currentItem, img: this });
                    }

                    view.triggerEvent("select", item);
                }

                return {
                    checkLoading: true,
                    clear: function(element){
                        element.src = "";
                    },
                    create: function(){
                        var img = document.createElement("img");
                        img.src = "";
                        $(img).on("load", { view: this }, onImageLoad);
                        return img;
                    },
                    set: function(item, element, loadThumbnail){
                        if (this.options.showThumbnailsBeforeLoad)
                            clearTimeout(element.changeImageTimeoutId);

                        var imageUrl = loadThumbnail && item.thumbnail ? item.thumbnail.src : item.url;

                        element.loading = true;
                        if (loadThumbnail)
                            element.loadingThumbnail = true;

                        if (element.src !== imageUrl){
                            function setSrc(){
                                element.src = "";
                                element.src = imageUrl;
                            }

                            if (this.options.showThumbnailsBeforeLoad && !loadThumbnail){
                                this.triggerEvent("imageLoadStart", { item: this.currentItem, img: element });
                                clearTimeout(element.changeImageTimeoutId);
                                if (this.options.transitionTime)
                                    element.changeImageTimeoutId = setTimeout(setSrc, this.options.transitionTime + 100);
                                else
                                    setSrc();
                            }
                            else
                                setSrc();
                        }
                        else
                            onImageLoad.call(element, this);
                    }
                }
            })()
        };

        function checkElementExists($panel, itemType){
            var element = $panel.data(itemType);
            if (!element){
                element = itemTypes[itemType].create.call(this);
                if (element)
                    $panel.append(element);
                else
                    element = $panel[0];

                $panel.data(itemType, element);
                if (element !== $panel[0]){
                    element.style.height = element.style.width = "100%";
                    element.style.display = "none";
                }

                if (this.options.displayInfo){
                    var $info = createInfo();
                    $panel.append($info).data("info", $info);
                }
            }

            return element;
        }

        function loadSources(sources){
            var createItems = [],
                view = this,
                originalNumberOfItems = view.items.length;

            for(var i=0; i < sources.length; i++){
                var sourceData = sources[i];
                view.items = view.items.concat(sourceData.items);
                createItems = createItems.concat(sourceData.items);
            }

            view.triggerEvent("load", { items: createItems, sources: sources });

            if (!view.initialized){
                view.initialized = true;
                view.triggerEvent("init");
            }
        }

        function setItem(item, loadThumbnail){
            if (item !== this.currentItem)
                return false;

            if (item){
                var itemType = itemTypes[item.type],
                    $panel = itemType.checkLoading ? this.transition.getCurrentPanel() : this.transition.getPanel(),
                    currentPanelItemType = $panel.data("itemType"),
                    element = checkElementExists.call(this, $panel, item.type);

                if (currentPanelItemType !== item.type){
                    if (currentPanelItemType){
                        currentPanelItemType && itemType.clear.call(this, element);
                        $panel.data(currentPanelItemType).style.display = "none";
                    }
                    $panel.data("itemType", item.type);
                }

                if (itemType.checkLoading && !element.loading && (!this.options.showThumbnailsBeforeLoad || loadThumbnail)){
                    $panel = this.transition.getPanel(item);
                    element = checkElementExists.call(this, $panel, item.type);
                }

                if (this.options.displayInfo){
                    var $info = $panel.data("info");
                    if (item.title)
                        $info.text(item.title).removeAttr("disabled");
                    else
                        $info.text("").attr("disabled", "disabled");
                }

                element.style.display = "block";
                itemType.set.call(this, item, element, loadThumbnail);

                if (this.options.allowFastViewing && item.id !== this.fastViewingItemId){
                    this.fastViewingItemId = item.id;
                    clearTimeout(this.fastViewingTimeoutId);

                    var view = this;
                    setTimeout(function(){
                        if (!view.isFastViewing){
                            view.transition.setTransitionTime(0);
                            view.isFastViewing = true;
                        }

                        view.fastViewingTimeoutId = setTimeout(function(){
                            view.transition.setTransitionTime(view.options.transitionTime);
                            view.isFastViewing = false;
                            view.fastViewingTimeoutId = null;
                        }, view.options.transitionTime);
                    }, 10);
                }
            }
            else { // No item given, the transition should close if it can.
                var closingElement = this.transition.getPanel();

                // In case thumbnails are displayed before the full image, change back to the thumbnail when closing, for better performance.
                if (this.options.showThumbnailsBeforeLoad){
                    itemType = itemTypes[this.previousItem.type];
                    itemType.set.call(this, this.previousItem, closingElement, true);
                }
                this.transition.transition.call(this, { item: null });
                //this.triggerEvent("select");
            }
        }

        return {
            addDataSources: function(dataSource){
                var self = this,
                    dataSources = dataSource.getData();

                if (dataSources && dataSources.length){
                    loadSources.call(self, dataSources);
                }

                function onLoadSources(sources){
                    loadSources.call(self, sources);
                }

                dataSource.addEventListener("loadSources", onLoadSources);
                this.addEventListener("beforeDestroy", function(){
                    dataSource.removeEventListener("loadSources", onLoadSources);
                });

                dataSource.addEventListener("clear", function(){
                    self.removeItems();
                });
            },
            cacheCount: 0,
            /**
             * Selects a null item. Transitions that support this should close the view.
             */
            close: function(state){
                if (this.isOpen()){
                    this.selectItem(null);
                    this.triggerEvent("close", { state: state });
                }
            },
            /**
             * Removes all elements created for the view
             */
            destroy: function(){
                this.triggerEvent("beforeDestroy");
                this.transition.destroy();
            },
            first: function(){
				if (!this.currentItem)
					return false;

                this.selectItem(0);
			},
            items: [],
            init: function(){
                var self = this;

                this.options.margin = yox.utils.dimensions.distributeMeasures(this.options.margin);
                this.options.padding = yox.utils.dimensions.distributeMeasures(this.options.padding);

                var eventBus = this.options.eventBus || new yox.eventBus();
                $.extend(this, eventBus);

                // Init events:
                for(var eventName in this.options.events){
                    var eventHandlers = this.options.events[eventName];
                    if (eventHandlers instanceof Array){
                        for(var i=0; i < eventHandlers.length; i++){
                            self.addEventListener(eventName, eventHandlers[i]);
                        }
                    }
                    else
                        self.addEventListener(eventName, eventHandlers);
                }

                createViewer(this);
                this.options.data && this.addDataSources(this.options.data);

                if (this.options.controls){
                    for(var methodName in this.options.controls){
                        var method = this[methodName];
                        if (method){
                            $(this.options.controls[methodName])
                                .data("yoxviewControl", methodName)
                                .on("click", function(e){
                                    e.preventDefault(); self[$(this).data("yoxviewControl")].call(self);
                                });
                        }
                    }
                }

                this.update();
                this.triggerEvent("create");
            },
            isOpen: function(){
                return !!this.currentItem;
            },
            last: function(){
				if (!this.currentItem)
					return false;

                this.selectItem(this.items.length - 1);

			},
            next: function(slideshow){
                if (!this.currentItem)
					return false;

                this.direction = 1;
				var nextItemId = this.currentItem.id;
                if (this.currentItem.id === this.items.length){
                    this.triggerEvent("end");

                    if (this.options.loop)
                        nextItemId = this.currentItem.id = 0;
                    else
                        return false;
                }
				this.selectItem(nextItemId, undefined, slideshow);
            },
            option: function(option, value){
                var options;
                if (value === undefined && Object(option) === option)
                    options = option;
                else{
                    options = {};
                    options[option] = value;
                }

                // Some options require special treatment once changed:
                for(var opt in options){
                    var prevValue = this.options[opt],
                        newValue = options[opt];

                    if (prevValue !== newValue){
                        var onChange = onOptionsChange[opt];
                        if (onChange)
                            onChange.call(this, newValue, prevValue);
                    }
                }

                this.transition.update && this.transition.update.call(this, options);
                $.extend(true, this.options, options);
            },
            toggleSlideshow: function(){
                var view = this;

                if (this.isPlaying){
                    clearTimeout(this.playTimeoutId);
                    this.isPlaying = false;
                    this.triggerEvent("slideshowStop");
                }
                else{
                    this.isPlaying = true;
                    this.playTimeoutId = setTimeout(function(){ view.next.call(view, true) }, this.options.slideshowDelay);
                    this.triggerEvent("slideshowStart");
                }
            },
            prev: function(){
                if (!this.currentItem)
					return false;

                this.direction = -1;
                var prevItemId = this.currentItem.id - 2;
                if (this.currentItem.id === 1){
                    if (this.options.loop)
                        this.currentItem.id = this.items.length - 1;
                    else
                        return false;
                }
				this.selectItem(prevItemId);
            },
            removeItems: function(){
                this.triggerEvent("removeItems", this.items);
                this.currentItem = undefined;
                this.items = [];
            },
            removeEventListener: function(eventName, eventHandler){
                if (eventHandler && typeof(eventHandler) !== "function")
                    throw new Error("Invalid event handler, must be a function or undefined.");

                $(this.container).off(eventName + ".modules", eventHandler);
            },
            selectItem: function(item, data, slideshow){
                if (!slideshow && this.isPlaying)
                    this.toggleSlideshow();
                else if (slideshow && !this.isPlaying){
                    this.isPlaying = true;
                    this.triggerEvent("slideshowStart");
                }

                if (!isNaN(item)){
                    if (item >= this.items.length || item < 0){
                        throw new Error("Invalid item index: " + item);
                    }
                    
                    item = this.items[item];
                }
                if (String(item) === item){
                    for(var i=0, tempItem; tempItem = this.items[i]; i++){
                        if (tempItem.name && tempItem.name === item){
                            item = tempItem;
                            break;
                        }
                    }
                    tempItem = null;
                }
                else {
                    if (item instanceof HTMLElement)
                        item = $(item);

                    if (item instanceof jQuery){
                        var index = item.data("yoxviewIndex");
                        if (isNaN(index))
                            index = parseInt(item.attr("data-yoxviewIndex"), 10);

                        item = this.items[index];
                    }
                }

                var currentItem = this.currentItem,
                    view = this;

                if (currentItem && item && item.id === currentItem.id)
					return false;

                this.triggerEvent("beforeSelect", { newItem: item, oldItem: currentItem, data: data });
                this.previousItem = this.currentItem;
				this.currentItem = item;

                if (item){
                    if (view.options.showThumbnailsBeforeLoad){
                        setItem.call(view, item, true);
                    }

                    this.cache.withItem(item, this, function(loadedItem){
                        setItem.call(view, loadedItem);
                    });
                }
                else
                    setItem.call(view, item);

                return true;
            },
            update: function(force){
                if (this.options.transitionTime){
                    if (this.updateTransitionTimeoutId){
                        clearTimeout(this.updateTransitionTimeoutId);
                        this.updateTransitionTimeoutId = null;
                    }
                }

                var containerDimensions = { width: this.$container.width(), height: this.$container.height() };
                if (force || !this.containerDimensions || containerDimensions.width !== this.containerDimensions.width || containerDimensions.height !== this.containerDimensions.height){
                    this.containerDimensions = containerDimensions;
                    if (this.currentItem){
                        this.transition.transition.call(this, {
                            position: this.getPosition(this.currentItem, this.containerDimensions, this.options),
                            duration: 0,
                            isUpdate: true
                        });
                    }
                }
            }
        };
    })();

	yox.view.config = {
        defaults: {
            allowFastViewing: true, // If true, transition time changes to 0 while items are changed frequently (faster than the transition time)
            cacheImagesInBackground: true, // If true, full-size images are cached even while the gallery hasn't been opened yet.
            createInfo: undefined, // If this is set to a function, it overrides the default createInfo function, which creates the info elements for an item.
            enlarge: false, // Whether to enlarge images to fit the container
            events: { // Predefined event handlers
                init: function(){
                    if (this.options.cacheImagesInBackground && this.items.length)
                        yox.view.cache.cacheItem(this);

                    // Need to trigger init only once per view:
                    this.removeEventListener("init");
                },
                select: function(item){
                    var view = this;
                    if (this.isPlaying){
                        this.playTimeoutId = setTimeout(function(){ view.next.call(view, true); }, Number(this.options.slideshowDelay) + Number((this.options.transitionTime || 0)));
                    }
                }
            }, // A function to call when the popup's background is clicked. (Applies only in popup mode)
            container: document.body || document.getElementsByTagName("body")[0], // The element in which the viewer is rendered. Defaults to the whole window.
            loop: true, // If true, viewing never ends - the first item is shown after the last, and the last after the first.
            panelDimensions: { width: 1600, height: 1600 }, // Default width and height for panels which aren't images
            resizeMode: "fit", // The mode in which to resize the item in the container - 'fit' (shows the whole item, resized to fit inside the container) or 'fill' (fills the entire container).
            showThumbnailsBeforeLoad: false, // If set to true, the viewer will open thumbnails using the transition. When the full image is loaded, it replaces the thumbnail.
            slideshowDelay: 3000 // Time in milliseconds to display each image when in slideshow
        },
        mode: {
            fill: {
                transition: "fade",
                enlarge: true,
                margin: 0,
                padding: 0
            },
            fit: {
                transition: "morph"
            }
        },
        platform: {
            mobile: {
                cacheBuffer: 2, // The number of images to cache after the current image (directional, depends on the current viewing direction)
                margin: 0,
                padding: 0,
                showInfo: true,
                transitionTime: 0 // The time it takes to animate transitions between items or opening and closing.
            },
            desktop: {
                cacheBuffer: 5, // The number of images to cache after the current image (directional, depends on the current viewing direction)
                margin: 20, // the minimum margin between the popup and the window
                padding: 0,
                showInfo: true,
                transitionTime: 300 // The time it takes to animate transitions between items or opening and closing.
            }
        },
        keys: {
            right: "next",
            left: "prev",
            enter: "toggleSlideshow",
            escape: "close",
            home: "first",
            end: "last",
            space: "next"
        }
    };
})(jQuery);