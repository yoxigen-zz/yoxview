(function($, undefined){
    yox.thumbnails = function(container, options){
        var self = this;
        
        this.container = container instanceof jQuery ? container[0] : container;
        this.container.classList.add("yox-thumbnails-empty");
        this.options = $.extend(true, {}, this.defaults, options);
        this.itemCount = 0;

        var eventBus = this.options.eventBus || new yox.eventBus();
        $.extend(this, eventBus);

        this.triggerEvent = function(eventName, data){
            eventBus.triggerEvent.call(self, eventName, data, self);
        }

        if (this.options.events){
            for(var eventName in this.options.events){
                this.addEventListener(eventName, this.options.events[eventName]);
            }
        }
        this.options.data && this.addDataSources(this.options.data);

        if (this.options.handleClick !== false){
            function onClick(e){
                var index = this.getAttribute("data-yoxthumbIndex"),
                    isSelected;

                if (/^\d+$/.test(index))
                    index = parseInt(index, 10);
                else
                    index = null;

                e.preventDefault();

                if (this.classList && self.options.selectedThumbnailClass)
                    isSelected = this.classList.contains(self.options.selectedThumbnailClass);
                else
                    isSelected = $(this).hasClass(self.options.selectedThumbnailClass);

                self.triggerEvent("click", { originalEvent: e, index: index, target: this, isSelected: isSelected });

                if (!isSelected)
                    self.select(index);
            }
            $(this.container).on("click", "[data-yoxthumbindex]", onClick);
            this.addEventListener("beforeDestroy", function(){
                $(this.container).off("click", "." + self.options.thumbnailClass, onClick);
            });
        }
    }

    yox.thumbnails.prototype = {
        addDataSources: function(dataSource){
            var self = this;
            function renderSources(sources){
                for(var i=0; i < sources.length; i++){
                    var source = sources[i];
                        self.createThumbnails(source);
                }
            }

            var dataSources = dataSource.getData();
            if (dataSources && dataSources.length)
                renderSources(dataSources);

            function onLoadSources(sources){
                if (!self.options.allowAppend){
                    self.clear();
                    this.itemCount = 0;
                }
                renderSources(sources);
            }

            dataSource.addEventListener("loadSources", onLoadSources);
            this.addEventListener("beforeDestroy", function(){
                dataSource.removeEventListener("loadSources", onLoadSources);
            });

            dataSource.addEventListener("clear", function(){
                self.clear();
                this.itemCount = 0;
            });
        },
        clear: function(){
            this.thumbnails && this.thumbnails.remove();
            this.itemCount = 0;
            this.currentSelectedThumbnail = null;
            this.thumbnails = $();
            this.container.classList.add("yox-thumbnails-empty");
        },
        createThumbnail: function(item){
            var self = this,
                $thumbnail = $("<a>", {
                    href: self.options.createUrl ? self.options.createUrl(item) : item.link || item.url,
                    title: this.options.renderThumbnailsTitle !== false ? item.title : undefined,
                    "class": self.options.thumbnailClass
                });

            $thumbnail.append($("<img>", {
                src: this.options.useFullImages ? item.url : item.thumbnail.src,
                alt: item.title
            }));

            return $thumbnail[0];
        },
        createThumbnails: function(source){
            var self = this,
                thumbnailElements,
                dfds,
                addedThumbnailsCount = 0,
                wasEmpty = !this.thumbnails || !this.thumbnails.length;

            function setThumbnailToItem(thumbnailElement, item, itemIndex){
                thumbnailElement.setAttribute("data-yoxthumbindex", itemIndex);
                item.thumbnail.element = thumbnailElement;
                item.thumbnail.generated = true;
                var thumbnailImages = thumbnailElement.getElementsByTagName("img");
                if (thumbnailImages.length)
                    item.thumbnail.image = thumbnailImages[0];
            }

            this.thumbnails = this.thumbnails || $();
            if (source.createThumbnails !== false){
                if (self.options.createThumbnails){
                    var thumbnails = self.options.createThumbnails(source.items, this.container);
                    $.each(thumbnails, function(i, thumbnail){
                        setThumbnailToItem(thumbnail, source.items[i], self.itemCount++);
                    });

                    this.thumbnails = this.thumbnails.add(thumbnails);
                    self.triggerEvent("create", { thumbnails: thumbnails, items: source.items });
                }
                else if (!self.options.createThumbnail && $.tmpl){
                    var thumbs = $.tmpl($.template(this.template), source.items, { options: this.options, getIndex: function(){ return self.itemCount++; } });
                    thumbs.appendTo(this.container);
                    this.thumbnails = thumbs;
                }
                else{
                    var documentFragment = document.createDocumentFragment(),
                        addThumbnail = function(item, itemIndex, thumbnailEl){
                            setThumbnailToItem(thumbnailEl, item, itemIndex);
                            documentFragment.appendChild(thumbnailEl);
                        };

                    var createThumbnail = self.options.createThumbnail || function(itemIndex, item){ self.createThumbnail(item); };
                    for(var i = 0, count = source.items.length; i < count; i++, this.itemCount++){
                        var item = source.items[i];
                        if (item.thumbnail){
                            addedThumbnailsCount++;
                            var thumbnailEl = createThumbnail.call(self, i, item, count);
                            if (thumbnailEl.resolve){
                                if (!dfds)
                                    dfds = [];

                                dfds.push(thumbnailEl)
                            }
                            else{
                                addThumbnail(item, this.itemCount, thumbnailEl);
                            }
                        }
                    }

                    if (dfds){
                        $.when.apply(this, dfds).done(function () {
                            var initialCount = self.itemCount - source.items.length;
                            for(var thumbnailIndex=0; thumbnailIndex < arguments.length; thumbnailIndex++){
                                addThumbnail(source.items[thumbnailIndex], initialCount + thumbnailIndex, arguments[thumbnailIndex]);
                            }

                            self.thumbnails = self.thumbnails.add(documentFragment.childNodes);
                            self.container.appendChild(documentFragment);
                            setThumbnailElements();
                            self.triggerEvent("create", { thumbnails: thumbnailElements, items: source.items });
                        });
                    }
                    else{
                        this.thumbnails = this.thumbnails.add(documentFragment.childNodes);
                        this.container.appendChild(documentFragment);
                    }
                }

                function setThumbnailElements(){
                    var totalThumbs = self.container.childNodes,
                        totalThumbsCount = totalThumbs.length;

                    thumbnailElements = Array.prototype.slice.call(totalThumbs, totalThumbsCount - addedThumbnailsCount);
                }

                setThumbnailElements();
            }
            else{
                var $thumbnails = $("a:has(img)", this.container)
                    .attr("data-yoxthumbindex", function(i){
                        return self.itemCount++;
                    });

                this.thumbnails = this.thumbnails.add($thumbnails);
                thumbnailElements = $thumbnails.get();
            }

            if (wasEmpty && addedThumbnailsCount)
                this.container.classList.remove("yox-thumbnails-empty");

            if (!dfds)
                this.triggerEvent("create", { thumbnails: thumbnailElements, items: source.items });
        },
        defaults: {
            allowAppend: true, // If true, new data sources cause thumbnails to be added rather than replace the existing thumbnails.
            handleClick: true, // If true, the module adds a click event for thumbnails, and links won't be followed.
            renderThumbnailsTitle: true,
            selectedThumbnailClass: "selectedThumbnail",
            thumbnailClass: "yoxthumbnail"
        },
        destroy: function(){
            this.triggerEvent("beforeDestroy");
            this.clear();
        },
        reset: function(){
        },
        select: function(itemIndex){
            this.unselect();
            if (this.thumbnails)
                this.currentSelectedThumbnail = this.thumbnails.eq(itemIndex).addClass(this.options.selectedThumbnailClass);
        },
        template: "<a class='${$item.options.thumbnailClass}' href='${link || url}'{{if $item.options.renderThumbnailsTitle}} title='title'{{/if}} data-yoxthumbIndex='${$item.getIndex()}'><img src='${thumbnail.src}' alt='${title}' /></a>",
        unselect: function(){
            if (this.currentSelectedThumbnail){
                this.currentSelectedThumbnail.removeClass(this.options.selectedThumbnailClass);
                this.currentSelectedThumbnail = null;
            }
        }
    };

    window.yox.thumbnails = yox.thumbnails;
})(jQuery);