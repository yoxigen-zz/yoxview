yox.data.sources.html = (function(){
    var dataSourceName = "html";

    return {
        name: dataSourceName,
        match: function(source){
            return yox.utils.dom.isElement(source) || source instanceof jQuery || (source.element && yox.utils.dom.isElement(source.element) || source.element instanceof jQuery);
        },
        load: function(source, callback){
            var items = [];

            if (source.selector && source.element){
                var elements = source.element.querySelectorAll(source.selector);
                for(var i=0, count=elements.length; i < count; i++){
                    var el = elements[i];
                    items.push({
                        element: el,
                        name: el.id,
                        type: "html",
                        title: el.title || el.getAttribute("data-title"),
                        width: el.clientWidth,
                        height: el.clientHeight,
                        thumbnail: {
                            src: el.getAttribute("data-thumbnail"),
                            className: source.thumbnailsClass || "yox-thumbnail"
                        }
                    });
                    el.parentNode.removeChild(el);
                }
            }
            else if (source.items){
                items = Array.prototype.slice.call(source.items, 0);
                for(var i=0, count = items.length; i < count; i++){
                    items[i].type = "html";
                }
            }

            var data = {
                items: items,
                source: source,
                sourceType: dataSourceName,
                createThumbnails: true
            };

            callback(data);
        }
    };
})();