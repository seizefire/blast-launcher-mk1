const electron = require("electron");

electron.app.whenReady().then(function(){
	var w = new electron.BrowserWindow({
		webPreferences: {
			enableRemoteModule: true,
			nodeIntegration: true
		},
		width: 800,
		height: 600,
		minWidth: 700,
		minHeight: 500,
		resizable: false,
		frame: false,
		show: false,
		title: "Blast Launcher"
	});
	w.setMenuBarVisibility(false);
	w.once("ready-to-show", function(){
		w.show();
	})
	w.loadFile("window/index.html");
});