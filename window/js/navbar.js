const events = require("./events");

var active;

window.addEventListener("DOMContentLoaded", function(){
	var currentBar = document.createElement("div");
	currentBar.id = "current-bar";
	var buttons = document.querySelectorAll("div#navbar>button");
	currentBar.style.marginLeft = buttons[0].offsetLeft+"px";
	currentBar.style.width = buttons[0].offsetWidth+"px";
	buttons[0].classList.add("active");
	active = buttons[0].getAttribute("lch-page");
	document.querySelector(`div#app>div#${active}`).style.display = "block";
	$("div#navbar").prepend(currentBar);
	setTimeout(function(){
		if(active !== buttons[0].getAttribute("lch-page")){
			return;
		}
		currentBar.style.width = buttons[0].offsetWidth+"px";
	}, 500);
	for(let button of buttons){
		button.addEventListener("click", function(event){
			var elem = event.target;
			document.querySelector(`div#navbar>button[lch-page="${active}"]`).classList.remove("active");
			document.querySelector(`div#app>div#${active}`).style.display = "none";
			events.emit("page", elem.getAttribute("lch-page"), active);
			active = elem.getAttribute("lch-page");
			currentBar.style.marginLeft = elem.offsetLeft+"px";
			currentBar.style.width = elem.offsetWidth+"px";
			elem.classList.add("active");
			document.querySelector(`div#app>div#${active}`).style.display = "block";
		});
	}
	$("div#navbar>svg").on("click", function(){
		var $e = $("div#navbar>svg");
		if($e.hasClass("cooldown")){
			return;
		}
		buttons[0].click();
		$e.addClass("cooldown");
		setTimeout(function(){
			$e.removeClass("cooldown");
		}, 1000);
	});
})