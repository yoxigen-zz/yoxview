yox.view.transitions.none = function(){
    var panels,
        currentPanelIndex = 1;

    this.create = function($container){
        panels = [];
        for(var i=0; i<2; i++){
            var $panel = $("<div>", { src: "", "class": "yoxviewImg" });
            if (i > 0)
                $panel.css({ opacity: "0" });

            $panel.css({ transform: "translateZ(0)" });
            panels.push($panel.appendTo($container));
        }
    };

    this.destroy = function(){
        for(var i=0; i < panels.length; i++){
            panels[i].remove();
        }
    };

    this.getCurrentPanel = function(){
        return panels[currentPanelIndex];
    };
    this.getNotCurrentPanel = function(){
        return panels[currentPanelIndex ? 0 : 1];
    }
    this.getPanel = function(item){
        currentPanelIndex = currentPanelIndex ? 0 : 1;
        return panels[currentPanelIndex];
    };

    this.setTransitionTime = function(){};

    this.transition = function(options){
        if (!options.item && !options.isUpdate)
            return false;

        panels[currentPanelIndex].css(options.position);
        if (this.options.enlarge && this.options.resizeMode === "fill")
            panels[1].css({ opacity: currentPanelIndex });
        else{
            panels[currentPanelIndex ? 0 : 1].css({ opacity: 0 });
            panels[currentPanelIndex].css({ opacity: 1 });
        }
    };

    this.update = function(updateData){
        if (updateData.resizeMode && updateData.resizeMode !== this.options.resizeMode){
            panels[currentPanelIndex].css(this.getPosition(this.currentItem, this.containerDimensions, this.options));
        }
    };
};

yox.view.transitions.none.prototype = new yox.view.transition("none");