function YoxUsersList(users){
    this.users = users;

    var isInit = false,
        firstNameHash,
        lastNameHash;

    function init(){
        var nameSplit,
            currentLetter;

        for(var i= 0, user; user = this.users[i]; i++){
            nameSplit = user.name.split(" ");
            currentLetter = firstNameHash[nameSplit[0][0]];
            if (!currentLetter){
                currentLetter = firstNameHash[nameSplit[0][0]] = [];

            }

            currentLetter.push(user);
        }
    }

    this.search = function(term){
        if (!isInit)
            init();
    }
}