function UploadController($scope){
    $scope.uploadFiles = function(files){
        /*
        var dfd = yox.data.sources.facebook.create.image(files, {
            title: "Testing image",
            albumId: "272785752838268"
        });
        dfd.done(function(e){
            console.log("DONE", e);
        });
        */
        console.log("Got files: ", files, " now show the upload panel.");
    }
}