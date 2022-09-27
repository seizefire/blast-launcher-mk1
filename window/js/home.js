const {fs} = require("utilities");
const java = require("../../backend/java");
const path = require("path");
const config = require("../../backend/config");
const psTree = require("ps-tree");
const electron = require("electron").remote;
const minecraft = require("../../backend/minecraft");
const components = require("./components");
const curseforge = require("../../backend/curseforge");
const mainProcess = require("process");
const { sort } = require("semver");

const dirname = mainProcess.cwd();

const defaultIcons = [
	"images/xboxoneedition.jpg",
	"images/ps4edition.jpg",
	"images/switchedition.png"
];

/** @type {Object.<string, import("child_process").ChildProcess>} */
var childProcesses = {};
var showingInstance;
var takenInstanceNames = [];
var deleteClicksLeft = 4;
var deleteClickTimeout;

var generateInstanceName = function(base, checkBase=true){
	var arr = config.client.instances.map(v => v.name);
	if(checkBase && !arr.includes(base)){
		return base;
	}
	var num = 1;
	while(arr.includes(`${base} (${num})`)){
		++num;
	}
	return `${base} (${num})`;
};

window.addEventListener("DOMContentLoaded", async function(){
	var elements = [];
	try {
		await minecraft.loadVanillaMetadata();
		for(let inst of config.client.instances){
			if(inst.tag == "latest-release" && inst.version != minecraft.latestReleaseVersion){
				inst.version = minecraft.latestReleaseVersion;
				inst.displayVersion = minecraft.latestReleaseVersion+" (Latest)";
			}else if(inst.tag == "latest-snapshot" && inst.version != minecraft.latestSnapshotVersion){
				inst.version = minecraft.latestSnapshotVersion;
				inst.displayVersion = minecraft.latestSnapshotVersion+" (Latest)";
			}
		}
	}catch(err){
		console.log(err);
		err.toString();
	}
	try {
		await minecraft.loadForgeMetadata();
	}catch(err){
		console.log(err);
		err.toString();
	}
	/** @type {config.PartialClientInstance[]} */
	var sortedInstances;
	switch(config.client.instances.length){
		case 1:
			sortedInstances = config.client.instances;
			break;
		case 2:
			sortedInstances = config.client.instances[0].lastUsed < config.client.instances[1].lastUsed ? config.client.instances.reverse() : config.client.instances;
			break;
		default:
			sortedInstances = config.client.instances.sort((a,b)=>a.lastUsed < b.lastUsed);
			break;
	}
	var versionInput = new components.VersionInput("div#app>#home>#instance-settings>table tr:nth-of-type(2) td:nth-of-type(2)");
	var imageInput = new components.ImageInput("div#app>#home>#instance-settings>table tr:nth-of-type(4) td:nth-of-type(2)");
	var ramInput = new components.RAMInput(true);
	$("div#app>#home>#instance-settings>table tr:nth-of-type(5) td:nth-of-type(2)").append(ramInput.minimumInput);
	$("div#app>#home>#instance-settings>table tr:nth-of-type(6) td:nth-of-type(2)").append(ramInput.maximumInput);
	var bindClientInstance = function(inst, $e, $img, $pb){
		$img.on("click", async function(){
			$("input#edit-instance-name").val(inst.name);
			$("input#edit-author").val(inst.author);
			versionInput.set(inst.type, inst.tag || inst.version);
			imageInput.set(inst.image.replace("{instance_path}", path.join(dirname, "instances", inst.name)));
			versionInput.unredden();
			if(inst.minimumRam){
				ramInput.minimumValue = inst.minimumRam;
				ramInput.minimumDefault = false;
			}else{
				ramInput.minimumValue = config.client.minimumRam;
				ramInput.minimumDefault = true;
			}
			if(inst.maximumRam){
				ramInput.maximumValue = inst.maximumRam;
				ramInput.maximumDefault = false;
			}else{
				ramInput.maximumValue = config.client.maximumRam;
				ramInput.maximumDefault = true;
			}
			$("input#edit-additional-arguments").val(inst.customArguments);
			if(childProcesses[inst.name]){
				$("input#edit-instance-name").attr("disabled", "");
				versionInput.lock();
				imageInput.lock();
				ramInput.lock();
				$("input#edit-additional-arguments").attr("disabled", "");
			}else{
				$("input#edit-instance-name").removeAttr("disabled");
				versionInput.unlock();
				imageInput.unlock();
				ramInput.unlock();
				$("input#edit-additional-arguments").removeAttr("disabled");
			}
			$("button#edit-instance-delete").html(`<i class="trash icon"></i> Delete`);
			if(deleteClickTimeout !== undefined){
				clearTimeout(deleteClickTimeout);
				deleteClickTimeout = undefined;
			}
			takenInstanceNames = config.client.instances.map(v => v.name);
			$("button#edit-back-button").css("display", "inline-block");
			$("div#instance-list").css("display", "none");
			$("div#instance-settings").css("display", "block");
			showingInstance = inst.name;
		});
		$pb.on("click", async function(){
			if(childProcesses[inst.name]){
				let proc = childProcesses[inst.name];
				psTree(proc.pid, function(err, children){
					if(err) return console.log(err);
					if(children.length){
						for(let j of children){
							mainProcess.kill(parseInt(j.PID), "SIGTERM");
						}
					}
					childProcesses[inst.name].kill();
				});
			}else{
				if(!minecraft.defaultAccount){
					$(`button[lch-page="accounts"]`).trigger("click");
					return;
				}
				components.showOverlay("alert-window");
				$("div#alert-window span#task").text("Loading Version Data");
				var version = inst.type == "vanilla" ? (await minecraft.loadVanillaVersion(inst.version)) : (await minecraft.loadForgeBuild(inst.version));
				$("div#alert-window span#task").text("Downloading Libraries");
				var result = await version.downloadLibraries();
				console.log(result);
				if(result.value != result.max){
					$("div#alert-window span#task").css("color", "#f00");
					$("div#alert-window span#task").text("Failed to download libraries");
					setTimeout(function(){
						$("div#alert-window span#task").removeAttr("style");
						components.hideOverlay();
					}, 5000);
					return;
				}
				$("div#alert-window span#task").text("Downloading Assets");
				result = await version.downloadAssets();
				if(result.value != result.max){
					$("div#alert-window span#task").css("color", "#f00");
					$("div#alert-window span#task").text("Failed to download assets");
					setTimeout(function(){
						$("div#alert-window span#task").removeAttr("style");
						components.hideOverlay();
					}, 5000);
					return;
				}
				$("div#alert-window span#task").text("Downloading Client");
				try {
					await version.downloadClient();
				}catch(err){
					console.log(err);
					err.toString();
					$("div#alert-window span#task").css("color", "#f00");
					$("div#alert-window span#task").text("Failed to download client");
					setTimeout(function(){
						$("div#alert-window span#task").removeAttr("style");
						components.hideOverlay();
					}, 5000);
					return;
				}
				if(fs.filetypeSync(path.join(dirname, "launcher", "jre8")) != "directory"){
					$("div#alert-window span#task").text("Downloading JRE");
					try {
						await fs.remove(path.join(dirname, "launcher", "jre8"));
						await java.download(8);
					}catch(err){
						console.log(err);
						err.toString();
						$("div#alert-window span#task").css("color", "#f00");
						$("div#alert-window span#task").text("Failed to download JRE");
						setTimeout(function(){
							$("div#alert-window span#task").removeAttr("style");
							components.hideOverlay();
						}, 5000);
						return;
					}
				}
				$("div#alert-window span#task").text("Extracting Native Libraries");
				try {
					await version.extractNatives();
				}catch(err){
					console.log(err);
					err.toString();
					$("div#alert-window span#task").css("color", "#f00");
					$("div#alert-window span#task").text("Failed to extract");
					setTimeout(function(){
						$("div#alert-window span#task").removeAttr("style");
						components.hideOverlay();
					}, 5000);
					return;
				}
				$("div#alert-window span#task").text("Refreshing Account");
				try {
					await minecraft.defaultAccount.refresh();
				}catch(err){
					console.log(err);
					err.toString();
				}
				$("div#alert-window span#task").text("Launching...");
				try {
					var proc = await version.launch(inst.name);
					childProcesses[inst.name] = proc;
					proc.on("close", function(){	
						delete childProcesses[inst.name];
						$pb.removeAttr("style");
						$pb.html(`<i class="play icon"></i> Play`);
						if(showingInstance === inst.name){			
							$("input#edit-instance-name").removeAttr("disabled");
							versionInput.unlock();
							imageInput.unlock();
							ramInput.unlock();
							$("input#edit-additional-arguments").removeAttr("disabled");
						}
					});
					$pb.css("background-color", "#900");
					$pb.html(`<i class="stop icon"></i> Stop`);
					$("div#instance-list").prepend($e);
					components.hideOverlay();
				}catch(err){
					console.log(err);
					err.toString();
					$("div#alert-window span#task").css("color", "#f00");
					$("div#alert-window span#task").text("Failed to launch");
					setTimeout(function(){
						$("div#alert-window span#task").removeAttr("style");
						components.hideOverlay();
					}, 5000);
				}
			}
		});
	};
	$("input#edit-instance-name").on("input", function(){
		let val = $("input#edit-instance-name").val();
		if((showingInstance != val && takenInstanceNames.includes(val)) || /[/\\:*?"<>|]/.test(val)){
			$("input#edit-instance-name").css("border", "1px solid #f00");
		}else{
			$("input#edit-instance-name").removeAttr("style");
		}
	});
	$("button#edit-instance-save").on("click", function(){
		if(childProcesses[showingInstance]) return;
		let val = $("input#edit-instance-name").val();
		if((showingInstance != val && takenInstanceNames.includes(val)) || /[/\\:*?"<>|]/.test(val)) return;
		if(!versionInput.version){
			versionInput.redden();
			return;
		}
		components.showOverlay("alert-window");
		$("div#alert-window span#task").text("Saving Instance");
		var inst = config.client.instances.find(v => v.name == showingInstance);
		inst.name = val;
		inst.type = versionInput.type;
		var originalDisplayVersion = inst.displayVersion+"";
		if(versionInput.version.startsWith("latest-")){
			inst.tag = versionInput.version;
			if(inst.tag == "latest-release" && inst.version != minecraft.latestReleaseVersion){
				inst.version = minecraft.latestReleaseVersion;
				inst.displayVersion = minecraft.latestReleaseVersion+" (Latest)";
			}else if(inst.tag == "latest-snapshot" && inst.version != minecraft.latestSnapshotVersion){
				inst.version = minecraft.latestSnapshotVersion;
				inst.displayVersion = minecraft.latestSnapshotVersion+" (Latest)";
			}
		}else{
			inst.version = versionInput.version;
			delete inst.tag;
			if(inst.type == "forge"){
				inst.displayVersion = "Forge "+inst.version;
			}else{
				inst.displayVersion = inst.version;
			}
		}
		if(inst.modpack){
			inst.displayVersion = originalDisplayVersion;
		}
		inst.image = imageInput.get().replace(path.join(dirname, "instances", showingInstance), "{instance_path}");
		inst.minimumRam = ramInput.minimumDefault ? undefined : ramInput.minimumValue;
		inst.maximumRam = ramInput.maximumDefault ? undefined : ramInput.maximumValue;
		inst.customArguments = $("input#edit-additional-arguments").val();
		if(inst.name !== showingInstance){
			if(fs.filetypeSync(path.join(dirname, "instances", showingInstance)) == "directory"){
				fs.renameSync(path.join(dirname, "instances", showingInstance), path.join(dirname, "instances", inst.name));
			}
		}
		var element = elements[sortedInstances.indexOf(inst)];
		element.children("div").children("span").html(`${inst.name}<br>${inst.displayVersion||inst.version}<br>By ${inst.author}`);
		let $img = element.children("div").children("img");
		switch(true){
			case /(?<=default-icons:\/\/)\d+/.test(inst.image):
				$img.attr("src", defaultIcons[parseInt(inst.image.match(/(?<=default-icons:\/\/)\d+/)[0])]);
				break;
			default:
				$img.attr("src", "file:///"+path.resolve(inst.image.replace("{instance_path}", path.join(dirname, "instances", inst.name))))
				break;
		}
		showingInstance = undefined;
		components.hideOverlay();
		$("div#instance-settings").css("display", "none");
		$("div#instance-list").css("display", "block");
		config.save();
	});
	$("button#edit-instance-delete").on("click", function(){
		if(childProcesses[showingInstance]) return;
		if(deleteClicksLeft === 4){
			deleteClickTimeout = setTimeout(function(){
				deleteClicksLeft = 4;
				deleteClickTimeout = undefined;
				$("button#edit-instance-delete").html(`<i class="trash icon"></i> Delete`);
			}, 6000);
		}
		--deleteClicksLeft;
		if(deleteClicksLeft === 0){
			clearTimeout(deleteClickTimeout);
			deleteClickTimeout = undefined;
			deleteClicksLeft = 4;
			components.showOverlay("alert-window");
			$("div#alert-window span#task").text("Deleting Instance");
			let index = sortedInstances.findIndex(v => v.name == showingInstance);
			delete sortedInstances[index];
			let index2 = config.client.instances.findIndex(v => v === undefined || v === null);
			if(index2 > -1){
				config.client.instances.splice(index2, 1);
			}
			index2 = sortedInstances.findIndex(v => v === undefined || v === null);
			if(index2 > -1){
				sortedInstances.splice(index2, 1);
			}
			config.save();
			elements[index].remove();
			elements.splice(index, 1);
			fs.remove(path.join(dirname, "instances", showingInstance)).then(function(){
				showingInstance = undefined;
				$("div#instance-settings").css("display", "none");
				$("div#instance-list").css("display", "block");
				components.hideOverlay();
			});
		}else{
			$("button#edit-instance-delete").html(`<i class="trash icon"></i> Click ${deleteClicksLeft} more time${deleteClicksLeft == 1 ? "" : "s"}`);
		}
	});
	$("button#open-folder").on("click", async function(){
		let dir = path.join(dirname, "instances", showingInstance);
		if(fs.filetypeSync(dir) != "directory"){
			await fs.remove(dir);
			await fs.mkdir(dir, {recursive: true});
		}
		console.log("[electron.shell.openPath] "+electron.shell.openPath(dir));
	});
	$("button#edit-back-button").on("click", async function(){
		showingInstance = undefined;
		$("div#instance-settings").css("display", "none");
		$("div#instance-list").css("display", "block");
	});
	$("div#create-new-instance-box").on("click", async function(){
		components.showOverlay("create-instance-window", true);
	});
	$("button#create-new-instance").on("click", function(){
		components.hideOverlay();
		components.showOverlay("alert-window");
		$("div#alert-window span#task").text("Creating Instance");
		var name = generateInstanceName("New Instance", false);
		var inst = {
			name: name,
			author: "You",
			lastUsed: new Date().getTime(),
			customArguments: ""
		};
		sortedInstances.push(inst);
		let $e = $(document.createElement("div"));
		let $ie = $(document.createElement("div"));
		let $pb = $(document.createElement("button"));
		$e.addClass("client-instance");
		let $img = $(document.createElement("img"));
		bindClientInstance(inst, $e, $img, $pb);
		$ie.append($img);
		$ie.append(`<span></span>`);
		$pb.html(`<i class="play icon"></i> Play`);
		$ie.append($pb);
		$e.append($ie);
		elements.push($e);
		$("div#instance-list").prepend($e);
		$("input#edit-instance-name").val(name);
		$("input#edit-author").val("You");
		versionInput.set();
		imageInput.set("default-icons://0");
		versionInput.unredden();
		ramInput.minimumValue = config.client.minimumRam;
		ramInput.minimumDefault = true;
		ramInput.maximumValue = config.client.maximumRam;
		ramInput.maximumDefault = true;
		$("input#edit-additional-arguments").val("");
		$("input#edit-instance-name").removeAttr("disabled");
		versionInput.unlock();
		imageInput.unlock();
		ramInput.unlock();
		$("input#edit-additional-arguments").removeAttr("disabled");
		$("button#edit-instance-delete").html(`<i class="trash icon"></i> Delete`);
		if(deleteClickTimeout !== undefined){
			clearTimeout(deleteClickTimeout);
			deleteClickTimeout = undefined;
		}
		takenInstanceNames = config.client.instances.map(v => v.name);
		$("button#edit-back-button").css("display", "none");
		$("div#instance-list").css("display", "none");
		$("div#instance-settings").css("display", "block");
		showingInstance = name;
		components.hideOverlay();
	});
	$("button#import-local-modpack").on("click", async function(){
		var dialogResult = await electron.dialog.showOpenDialog({
			properties: ["openFile"]
		});
		if(!dialogResult.filePaths || !dialogResult.filePaths[0]){
			return;
		}
		components.hideOverlay();
		components.showOverlay("alert-window");
		$("div#alert-window span#task").text("Importing Modpack");
		var filePath = dialogResult.filePaths[0];
		try {
			var inst = await curseforge.installZip(filePath);
			sortedInstances.push(inst);
			config.save();
			let $e = $(document.createElement("div"));
			let $ie = $(document.createElement("div"));
			let $pb = $(document.createElement("button"));
			$e.addClass("client-instance");
			let $img = $(document.createElement("img"));
			bindClientInstance(inst, $e, $img, $pb);
			$ie.append($img);
			switch(true){
				case /(?<=default-icons:\/\/)\d+/.test(inst.image):
					$img.attr("src", defaultIcons[parseInt(inst.image.match(/(?<=default-icons:\/\/)\d+/)[0])]);
					break;
				default:
					$img.attr("src", "file:///"+path.resolve(inst.image.replace("{instance_path}", path.join(dirname, "instances", inst.name))))
					break;
			}
			$ie.append(`<span>${inst.name}<br>${inst.displayVersion||inst.version}<br>By ${inst.author}</span>`);
			$pb.html(`<i class="play icon"></i> Play`);
			$ie.append($pb);
			$e.append($ie);
			elements.push($e);
			$("div#instance-list").prepend($e);
			components.hideOverlay();
		}catch(err){
			err.toString();
			console.log(err);
			$("div#alert-window span#task").css("color", "#f00");
			$("div#alert-window span#task").text("Failed to import");
			setTimeout(function(){
				$("div#alert-window span#task").removeAttr("style");
				components.hideOverlay();
			}, 5000);
		}
	});
	components._DOMContentLoaded();
	for(var instance of sortedInstances){
		let $e = $(document.createElement("div"));
		let $ie = $(document.createElement("div"));
		let $pb = $(document.createElement("button"));
		$e.addClass("client-instance");
		let $img = $(document.createElement("img"));
		switch(true){
			case /(?<=default-icons:\/\/)\d+/.test(instance.image):
				$img.attr("src", defaultIcons[parseInt(instance.image.match(/(?<=default-icons:\/\/)\d+/)[0])]);
				break;
			default:
				$img.attr("src", "file:///"+path.resolve(instance.image.replace("{instance_path}", path.join(dirname, "instances", instance.name))))
				break;
		}
		$ie.append($img);
		$ie.append(`<span>${instance.name}<br>${instance.displayVersion||instance.version}<br>By ${instance.author}</span>`);
		$pb.html(`<i class="play icon"></i> Play`);
		bindClientInstance(instance, $e, $img, $pb);
		$ie.append($pb);
		$e.append($ie);
		elements.push($e);
		$("div#create-new-instance-box").before($e);
	}
});