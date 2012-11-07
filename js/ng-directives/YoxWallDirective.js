var ngYoxModule = angular.module("ngYox", []);
ngYoxModule.directive("yoxWall", function(){
    var yoxApi, viewerApi;

    var directiveDefinitionObject = {
        priority: 0,
        transclude: false,
        restrict: 'A',
        link: function postLink(scope, element, attrs) {
            yoxApi = new Yox(element[0], {
                theme: {
                    name: "wall",
                    options: {
                        //loadItemsOnScroll: false,
                        thumbnailsMaxHeight: Math.round(screen.height * 0.27),
                        borderWidth: 3,
                        padding: 3,
                        scrollToElementOnSelect: true
                    }
                },
                data: new yox.data()
            });

            yoxApi.addEventListener("click", function(e){
                var viewer = document.getElementById("viewer");
                viewer.style.display = "block";

                if (!viewerApi){
                    viewerApi = new Yox(viewer, {
                        theme: "classic",
                        data: yoxApi.data,
                        events: {
                            close: function(e){
                                viewer.style.display = "none";
                            }
                        }
                    });
                }

                viewerApi.modules.view.selectItem(e.index);
            });

            scope.$watch("dataSource", function(value, oldValue) {
                setTimeout(function(){console.log("SOURCE: ", value);
                    yoxApi.data.source(value);
                }, 10);
            }, function(){ console.log("equal: ", arguments) });
        }
    };


    return directiveDefinitionObject;
});