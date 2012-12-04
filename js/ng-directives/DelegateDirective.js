angular.module("DelegateModule", []).directive("delegate", function(){
    var directiveDefinitionObject = {
        priority: 0,
        transclude: false,
        restrict: 'A',
        link: function postLink($scope, element, attrs) {
            var delegates = attrs.delegate.split(/,\s?/g);

	        function prepareHandler(scopeMethod){
		        return function(e){
			        e.preventDefault();
			        scopeMethod.call(this, this, e);
		        };
	        }
            for(var i= 0, delegate; i < delegates.length; i++){
                delegate = delegates[i];

                var delegateParts = delegate.split(":"),
                    handler = delegateParts[2].replace(/\(\)$/, "");

                $(element[0]).on(delegateParts[0], delegateParts[1], prepareHandler($scope[handler]));
            }
        }
    };


    return directiveDefinitionObject;
});
