angular.module("InputDirectives", [])
	.directive("focusOnClick", function(){
		return {
			restrict: "A",
			link: function($scope, element, attrs){
				element[0].addEventListener("click", function(e){
					e.preventDefault();
					var focusElement = document.querySelector(attrs.focusOnClick);
					if (focusElement){
						setTimeout(function(){ focusElement.focus(); }, 50);
					}
				}, false);
			}
		};
	});