const config = require("../../backend/config");
const events = require("./events");

const {RAMInput} = require("./components");

window.addEventListener("DOMContentLoaded", function(){
	var ri = new RAMInput(false);
	$("div#app>div#settings h3:nth-of-type(1)").after(ri.minimumInput)
	$("div#app>div#settings h3:nth-of-type(2)").after(ri.maximumInput)
	$("div#app>div#settings>input#custom-arguments").val(config.client.customArguments);
	ri.minimumValue = config.client.minimumRam;
	ri.maximumValue = config.client.maximumRam;
	events.on("page", function(page, oldPage){
		if(oldPage == "settings"){
			config.client.minimumRam = ri.minimumValue;
			config.client.maximumRam = ri.maximumValue;
			config.client.customArguments = $("div#app>div#settings>input#custom-arguments").val();
			config.save();
		}
	});
	window.addEventListener("beforeunload", function(){
		config.client.minimumRam = ri.minimumValue;
		config.client.maximumRam = ri.maximumValue;
		config.client.customArguments = $("div#app>div#settings>input#custom-arguments").val();
		config.client.instances = config.client.instances.filter(v => v.type);
		config.save();
	});
});