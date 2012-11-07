angular.module("DelegateModule", []).directive("delegate", function(){
    var directiveDefinitionObject = {
        priority: 0,
        transclude: false,
        restrict: 'A',
        link: function postLink($scope, element, attrs) {
            var delegateParts = attrs.delegate.split(":"),
                handler = delegateParts[2].replace(/\(\)$/, "");

            $(element[0]).on(delegateParts[0], delegateParts[1], function(e){
                e.preventDefault();
                $scope[handler].call(this, this, e);
            });
        }
    };


    return directiveDefinitionObject;
});
