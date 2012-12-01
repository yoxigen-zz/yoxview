angular.module("DragAndDropModule", []).directive("dragAndDrop", function(){
    var directiveDefinitionObject = {
        priority: 0,
        transclude: false,
        restrict: 'AC',
        link: function postLink($scope, element, attrs) {
            var dropZone = element[0],
                dropZoneTarget = dropZone.querySelector(".drag-and-drop-zone"),
                leaveTimeoutId,
                isDragging,
                onDropMethod = $scope[attrs.onDrop];

            function preventDefault(e){
                e.preventDefault();
                e.stopPropagation();
            }

            function onMouseMove(e){
                if (isDragging)
                    endDrag();
            }

            function endDrag(){
                dropZone.classList.remove("drag-and-drop-dragging");
                isDragging = false;
                window.removeEventListener("mousemove", onMouseMove);
            }

            function onDrop(e){
                preventDefault(e);
                onDropMethod({ files: e.dataTransfer.files })
                endDrag();
            }

            // Drag and drop:
            document.body.addEventListener("dragenter", function(e){
                preventDefault(e);
                if (!isDragging){
                    isDragging = true;
                    dropZone.classList.add("drag-and-drop-dragging");
                    window.addEventListener("mousemove", onMouseMove);
                }
            }, false);
            document.body.addEventListener("dragover", function(e){
                preventDefault(e);
                e.dataTransfer.dropEffect = "none";
            }, false);

            document.body.addEventListener("dragleave", function(e){
                preventDefault(e);
            });

            dropZoneTarget.addEventListener("drop", onDrop, false);

            dropZoneTarget.addEventListener("dragenter", function(e){
                preventDefault(e);
                clearTimeout(leaveTimeoutId);
                this.classList.add("drag-and-drop-over");
                e.dataTransfer.dropEffect = "copy";
            }, false);
            dropZoneTarget.addEventListener("dragleave", function(e){
                preventDefault(e);
                var toElement = e.toElement || e.relatedTarget;
                if (toElement.nodeType === 1 && (toElement !== dropZone || e.toElement))
                    dropZoneTarget.classList.remove("drag-and-drop-over");
            }, false);
            dropZoneTarget.addEventListener("dragover", function(e){
                preventDefault(e);
                e.dataTransfer.dropEffect = "copy";
            }, false);
        }
    };


    return directiveDefinitionObject;
});
