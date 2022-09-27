const os = require("os");
const electron = require("electron").remote;
const minecraft = require("../../backend/minecraft");

const maxMemory = Math.floor(os.totalmem()/1024/1024);

const defaultIcons = [
	"images/xboxoneedition.jpg",
	"images/ps4edition.jpg",
	"images/switchedition.png"
];

var overlayName = "";
var overlayCancellable = false;

module.exports = {
	_DOMContentLoaded: function(){
		$("body>div#overlay").on("click", function(evt){
			if(evt.target.id == "overlay" && overlayCancellable){

			}
		});
	},
	ImageInput: function(parent, currentImage="default-icons://0"){
		var locked = false;
		var image = /(?<=default-icons:\/\/)\d+/.test(currentImage) ? parseInt(currentImage.match(/(?<=default-icons:\/\/)\d+/)[0]) : currentImage;
		var customImage = typeof image == "string" ? customImage : "images/unknown.png";
		image = customImage !== "images/unknown.png" ? defaultIcons.length : image;
		var images = [];
		for(let i = 0; i < defaultIcons.length; ++i){
			let iconIndex = i+0;
			let icon = defaultIcons[iconIndex];
			let img = $(`<img src="${icon}" class="image-select ${image == iconIndex ? 'active' : ""}">`);
			img.on("click", function(){
				if(locked) return;
				if(image == iconIndex) return;
				images[image].removeClass("active");
				image = iconIndex;
				images[iconIndex].addClass("active");
			});
			$(parent).append(img);
			images.push(img);
		}
		var customImg = $(`<img src="${customImage}" class="image-select ${image == defaultIcons.length ? 'active' : ""}">`);
		images.push(customImg);
		customImg.on("click", function(){
			if(locked) return;
			var paths = electron.dialog.showOpenDialogSync({
				properties: ["openFile"]
			});
			if(paths && /\.(png|gif|jpg)$/.test(paths[0])){
				customImage = paths[0];
				customImg.attr("src", paths[0]);
			}
			if(image < defaultIcons.length){
				images[image].removeClass("active");
				image = defaultIcons.length;
				customImg.addClass("active");
			}
		});
		$(parent).append(customImg);
		this.get = function(){
			return image === defaultIcons.length ? customImage : "default-icons://"+image;
		};
		this.set = function(newImage){
			images[image].removeClass("active");
			image = /(?<=default-icons:\/\/)\d+/.test(newImage) ? parseInt(newImage.match(/(?<=default-icons:\/\/)\d+/)[0]) : newImage;
			if(typeof image == "string"){
				customImage = image+"";
				customImg.attr("src", customImage);
				image = defaultIcons.length;
			}
			images[image].addClass("active");
		}
		this.lock = function(){
			locked = true;
		};
		this.unlock = function(){
			locked = false;
		};
	},
	RAMInput: class RAMInput {
		minimumInput;
		maximumInput;
		#checkbox;
		#minInput;
		#maxInput;
		#minCheckbox;
		#maxCheckbox;

		constructor(checkbox=false){
			var $nb = $(document.createElement("div"));
			var $nib = $(document.createElement("div"));
			var $ni = $(document.createElement("input"));
			var $nl = $(document.createElement("span"));
			var $xb = $(document.createElement("div"));
			var $xib = $(document.createElement("div"));
			var $xi = $(document.createElement("input"));
			var $xl = $(document.createElement("span"));
			$nb.css("display", "flex");
			$nb.css("flex-direction", "row");
			$nb.css("padding-left", "16px");
			$xb.css("display", "flex");
			$xb.css("flex-direction", "row");
			$xb.css("padding-left", "16px");
			$nl.css("display", "inline-block");
			$nl.css("width", "80px");
			$nl.css("text-align", "center");
			$nl.css("z-index", "999");
			$xl.css("display", "inline-block");
			$xl.css("width", "80px");
			$xl.css("text-align", "center");
			$xl.css("z-index", "999");
			$nb.append($nib);
			$nib.append($nl);
			$nib.append("<br>");
			$nib.append($ni);
			$ni.attr("type", "range");
			$ni.attr("min", 256);
			$ni.attr("max", maxMemory);
			$ni.attr("step", 64);
			$ni.on("input", function(){
				var width = $xi.width();
				var value = parseInt($ni.val());
				$nl.html(value.toLocaleString()+" MB");
				$nl.css("margin-left", (value/maxMemory*width-40)+"px");
				if(value > parseInt($xi.val())){
					$xi.val(value);
					$xi.trigger("input");
				}
			});
			$xb.append($xib);
			$xib.append($xl);
			$xib.append("<br>");
			$xib.append($xi);
			$xi.attr("type", "range");
			$xi.attr("min", 256);
			$xi.attr("max", maxMemory);
			$xi.attr("step", 64);
			$xi.on("input", function(){
				var width = $xi.width();
				var value = parseInt($xi.val());
				$xl.html(value.toLocaleString()+" MB");
				$xl.css("margin-left", (value/maxMemory*width-40)+"px");
				if(value < parseInt($ni.val())){
					$ni.val(value);
					$ni.trigger("input");
				}
			});
			if(checkbox){
				let $nc = $(document.createElement("input"));
				let $ncb = $(document.createElement("div"));
				let $xc = $(document.createElement("input"));
				let $xcb = $(document.createElement("div"));
				$nc.attr("type", "checkbox");
				$xc.attr("type", "checkbox");
				$nc.css("z-index", "1000");
				$xc.css("z-index", "1000");
				$nc.prop("checked", false);
				$xc.prop("checked", false);
				$ncb.css("padding-right", "16px");
				$xcb.css("padding-right", "16px");
				$ncb.css("text-align", "center");
				$xcb.css("text-align", "center");
				$ncb.append($nc);
				$ncb.append("<br><span>Use default</span>");
				$xcb.append($xc);
				$xcb.append("<br><span>Use default</span>");
				$nb.prepend($ncb);
				$xb.prepend($xcb);
				$nc.on("change", function(){
					$ni.prop("disabled", $nc.prop("checked"));
				});
				$xc.on("change", function(){
					$xi.prop("disabled", $xc.prop("checked"));
				});
				this.#minCheckbox = $nc;
				this.#maxCheckbox = $xc;
			}
			this.minimumInput = $nb;
			this.maximumInput = $xb;
			this.#minInput = $ni;
			this.#maxInput = $xi;
			this.#checkbox = checkbox;
		}
		get minimumValue(){
			return parseInt(this.#minInput.val().toString());
		}
		set minimumValue(value){
			this.#minInput.val(value);
			this.#minInput.trigger("input");
		}
		get maximumValue(){
			return parseInt(this.#maxInput.val().toString());
		}
		set maximumValue(value){
			this.#maxInput.val(value);
			this.#maxInput.trigger("input");
		}
		get minimumDefault(){
			return this.#checkbox ? this.#minCheckbox.prop("checked") : false;
		}
		set minimumDefault(value){
			this.#minCheckbox.prop("checked", value);
			this.#minCheckbox.trigger("change");
		}
		get maximumDefault(){
			return this.#checkbox ? this.#maxCheckbox.prop("checked") : false;
		}
		set maximumDefault(value){
			this.#maxCheckbox.prop("checked", value);
			this.#maxCheckbox.trigger("change");
		}
		lock(){
			if(this.#checkbox){
				this.#minCheckbox.attr("disabled", "");
				this.#maxCheckbox.attr("disabled", "");
			}
			this.#minInput.attr("disabled", "");
			this.#maxInput.attr("disabled", "");
		}
		unlock(){
			if(this.#checkbox){
				this.#minCheckbox.removeAttr("disabled");
				this.#maxCheckbox.removeAttr("disabled");
			}
			if(!this.minimumDefault){
				this.#minInput.removeAttr("disabled");
			}
			if(!this.maximumDefault){
				this.#maxInput.removeAttr("disabled");
			}
		}
	},
	VersionInput: class VersionInput {
		#type;
		#version;
		#selects;
		/** @returns {"vanilla" | "forge"} */
		get type(){
			return this.#type;
		}
		/** @returns {String} */
		get version(){
			return this.#version;
		}
		/**
		 * @param {String} parent 
		 * @param {"vanilla"|"forge"} [type] 
		 * @param {String} [version] 
		 */
		constructor(parent, type, version){
			this.#type = type;
			this.#version = version;
			this.#selects = [];
			let s0 = minecraft.vanillaVersions.find(v => v.id == (version == "latest-release" ? minecraft.latestReleaseVersion : (version == "latest-snapshot" ? minecraft.latestSnapshotVersion : version)));
			let s1 = type == "forge" ? version.split("-") : undefined;
			this.#selects[0] = $(`<select><option value="" disabled selected>Version Type</option><option value="vanilla">Vanilla</option><option value="forge">Forge</option></select>`);
			this.#selects[0].val(type || "");
			this.#selects[0].on("change", ()=>{
				let oldValue = this.#type == "forge" ? 2 : 1;
				let newValue = this.#selects[0].val();
				if(this.#type == newValue) return;
				this.#selects[oldValue].val("");
				this.#selects[oldValue + 2].val("");
				this.#type = newValue;
				this.#version = undefined;
				this.#refresh();
			});
			this.#selects[1] = $(`<select><option value="" disabled selected>Release Type</option><option value="release">Release</option><option value="snapshot">Snapshot</option></select>`);
			this.#selects[1].val(s0 ? s0.type : "");
			this.#selects[1].on("change", ()=>{
				let newValue = this.#selects[1].val();
				this.#selects[3].val("");
				this.#selects[3].html(`<option value="" disabled selected>Version</option>${minecraft.vanillaVersions.filter(v => v.type == newValue).map(v => `<option value="${v.id}">${v.id}</option>`).join("")}`);
				if(newValue == "release"){
					this.#selects[3].children("option:first-of-type").after(`<option value="latest-release">${minecraft.latestReleaseVersion} (Latest)</option>`);
				}else if(newValue == "snapshot"){
					this.#selects[3].children("option:first-of-type").after(`<option value="latest-snapshot">${minecraft.latestSnapshotVersion} (Latest)</option>`);
				}
				this.#version = undefined;
				this.#refresh();
			});
			this.#selects[2] = $(`<select><option value="" disabled selected>Release Version</option>${minecraft.vanillaVersions.map(v => v.id).filter(v => minecraft.forgeMetadata[v]).map(v => `<option value="${v}">${v}</option>`).join("")}</select>`);
			this.#selects[2].val(s1 ? s1[0] : "");
			this.#selects[2].on("change", ()=>{
				let newValue = this.#selects[2].val().split("-");
				this.#selects[4].val("");
				this.#selects[4].html(`<option value="" disabled selected>Build Version</option>${minecraft.forgeMetadata[newValue[0]].reverse().map(v => `<option value="${v}">${v.split("-")[1]}</option>`).join("")}`);
				this.#version = undefined;
				this.#refresh();
			});
			this.#selects[3] = $(`<select><option value="" disabled selected>Version</option>${s0 ? minecraft.vanillaVersions.filter(v => v.type == s0.type).map(v => `<option value="${v.id}">${v.id}</option>`).join("") : ""}</select>`);
			if(s0){
				if(s0.type == "release"){
					this.#selects[3].children("option:first-of-type").after(`<option value="latest-release">${minecraft.latestReleaseVersion} (Latest)</option>`);
				}else if(s0.type == "snapshot"){
					this.#selects[3].children("option:first-of-type").after(`<option value="latest-snapshot">${minecraft.latestSnapshotVersion} (Latest)</option>`);
				}
			}
			this.#selects[3].val(type == "vanilla" ? (version || "") : "");
			this.#selects[3].on("change", ()=>{
				this.#version = this.#selects[3].val();
			});
			this.#selects[4] = $(`<select><option value="" disabled selected>Build Version</option>${s1 ? minecraft.forgeMetadata[s1[0]].reverse().map(v => `<option value="${v}">${v.split("-")[1]}</option>`).join("") : ""}</select>`);
			this.#selects[4].val(type == "forge" ? (version || "") : "");
			this.#selects[4].on("change", ()=>{
				this.#version = this.#selects[4].val();
			});
			this.#refresh();
			$(parent).append(...this.#selects);
		}
		lock(){
			for(var i of this.#selects){
				i.attr("disabled", "");
			}
		}
		/**
		 * @param {"vanilla"|"forge"} [type] 
		 * @param {String} [version] 
		 */
		set(type, version){
			let s0 = minecraft.vanillaVersions.find(v => v.id == (version == "latest-release" ? minecraft.latestReleaseVersion : (version == "latest-snapshot" ? minecraft.latestSnapshotVersion : version)));
			let s1 = type == "forge" ? version.split("-") : undefined;
			this.#selects[0].val(type || "");
			this.#selects[1].val(s0 ? s0.type : "");
			this.#selects[2].html(`<option value="" disabled selected>Release Version</option>${minecraft.vanillaVersions.map(v => v.id).filter(v => minecraft.forgeMetadata[v]).map(v => `<option value="${v}">${v}</option>`).join("")}`);
			this.#selects[2].val(s1 ? s1[0] : "");
			this.#selects[3].html(`<option value="" disabled selected>Version</option>${s0 ? minecraft.vanillaVersions.filter(v => v.type == s0.type).map(v => `<option value="${v.id}">${v.id}</option>`).join("") : ""}`);
			if(s0){
				if(s0.type == "release"){
					this.#selects[3].children("option:first-of-type").after(`<option value="latest-release">${minecraft.latestReleaseVersion} (Latest)</option>`);
				}else if(s0.type == "snapshot"){
					this.#selects[3].children("option:first-of-type").after(`<option value="latest-snapshot">${minecraft.latestSnapshotVersion} (Latest)</option>`);
				}
			}
			this.#selects[3].val(type == "vanilla" ? (version || "") : "");
			this.#selects[4].html(`<option value="" disabled selected>Build Version</option>${s1 ? minecraft.forgeMetadata[s1[0]].reverse().map(v => `<option value="${v}">${v.split("-")[1]}</option>`).join("") : ""}`);
			this.#selects[4].val(type == "forge" ? (version || "") : "");
			this.#type = type;
			this.#version = version;
			this.#refresh();
		}
		unlock(){
			for(var i of this.#selects){
				i.removeAttr("disabled");
			}
		}
		redden(){
			for(var i of this.#selects){
				i.css("border", "1px solid #f00");
			}
		}
		unredden(){
			for(var i of this.#selects){
				i.css("border", "");
			}
		}
		#refresh(){
			this.#selects[1].css("display", this.#type == "vanilla" ? "inline-block" : "none");
			this.#selects[2].css("display", this.#type == "forge" ? "inline-block" : "none");
			this.#selects[3].css("display", this.#type == "vanilla" && this.#selects[1].val() ? "inline-block" : "none");
			this.#selects[4].css("display", this.#type == "forge" && this.#selects[2].val() ? "inline-block" : "none");
		}
	},
	showOverlay(name, cancellable=false){
		overlayName = name;
		overlayCancellable = cancellable;
		$("div#overlay").css("display", "block");
		$(`div#overlay div#${name}`).css("display", "block");
		$(`div#overlay div#${name} span#text`).text("");
	},
	hideOverlay(){
		$("div#overlay").css("display", "none");
		$(`div#overlay div#${overlayName}`).css("display", "none");
		$(`div#overlay div#${overlayName} span#text`).text("");
	},
	_DOMContentLoaded(){
		$("div#overlay").on("click", event=>{
			if(overlayCancellable && event.target.id == "overlay" && event.target.tagName == "DIV"){
				this.hideOverlay();
			}
		});
	}
}