window.onload = function(){
    var inputs =  document.getElementsByTagName("input");
    for(var i = 0;i < inputs.length; i++){
        if(inputs[i].type == "checkbox"){
            inputs[i].onclick = function() {
                this.checked = !this.checked;
            }
        }
    }
}
