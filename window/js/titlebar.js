const $ = require("jquery");
const electron = require("electron");

const {remote} = electron;

const win = remote.getCurrentWindow();

window.addEventListener("DOMContentLoaded", function(){
	if(win.isMaximized()){
		$("body").attr("maximized", "");
	}
	$("header#windows-titlebar #min-button").on("click", function(){
		win.minimize();
	});
	$("header#windows-titlebar #max-button").on("click", function(){
		if(!win.resizable) return;
		win.maximize();
	});
	$("header#windows-titlebar #restore-button").on("click", function(){
		if(!win.resizable) return;
		win.restore();
	});
	$("header#windows-titlebar #close-button").on("click", function(){
		win.close();
	});
	win.on("maximize", function(){
		$("body").attr("maximized", "");
	});
	win.on("unmaximize", function(){
		$("body").removeAttr("maximized", "");
	});
	window.addEventListener("beforeunload", function(){
		win.removeAllListeners("maximize");
		win.removeAllListeners("restore");
	});
});