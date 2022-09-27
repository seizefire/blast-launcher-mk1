const os = require("os");
const path = require("path");
const config = require("../config");
const semver = require("semver");

const archConversions = {x32: "x86", x64: "x86"};
const dirname = process.cwd();
const osConversions = {linux: "linux", darwin: "osx", win32: "windows"};

/**
 * Evaluates an array of rules
 * @param {[]} rules The rules
 * @param {{is_demo_user: boolean, has_custom_resolution: boolean}} options The options
 */
function evaluateRules(rules, options){
	var allow = false;
	for(var i of rules){
		let pass = true;
		if(i.os){
			if(i.os.name && i.os.name != osConversions[os.type()]){
				pass = false;
			}
			else if(i.os.version && !semver.satisfies(semver.coerce(os.release()), i.os.version)){
				pass = false;
			}
			else if(i.os.arch && i.os.arch != archConversions[os.arch()]){
				pass = false;
			}
		}
		if(i.features){
			if(i.features.is_demo_user !== undefined && options.is_demo_user !== undefined && i.features.is_demo_user !== options.is_demo_user){
				pass = false;
			}
			else if(i.features.has_custom_resolution !== undefined && options.has_custom_resolution !== undefined && i.features.has_custom_resolution !== options.has_custom_resolution){
				pass = false;
			}
		}
		if(pass == true){
			allow = i.action.toLowerCase() == "allow";
		}
	}
	return allow;
}
/**
 * @param {Object} data 
 * @param {{accessToken: string, emailAddress: string, uuid: string, username: string}} account
 * @param {config.PartialClientInstance} instance 
 */
function generateArguments(data, account, instance){
	/**
	 * @type {String[]}
	 */
	var args = [];
	var needsClasspath = true;
	var jarPath = path.join(dirname, "versions", data.jar, data.jar+".jar");
	var classpath = jarPath+"";
	for(let i of data.libraries){
		if(!i.excludes){
			classpath += ";"+i.path;
		}
	}
	if(data.minecraftArguments){
		Array.prototype.push.apply(args, data.minecraftArguments.split(" "));
	}else if(data.arguments){
		if(data.arguments.jvm){
			Array.prototype.push.apply(args, data.arguments.jvm.filter(v => v != "-cp" && (typeof v != "string" || !v.includes("${classpath}"))));
			args.push("-cp", "${classpath}", "${MAINCLASS}");
			needsClasspath = false;
		}
		if(data.arguments.game){
			Array.prototype.push.apply(args, data.arguments.game);
		}
	}
	if(needsClasspath){
		args.unshift("-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump", "-Dminecraft.launcher.brand=${launcher_name}", "-Dminecraft.launcher.version=${launcher_version}", `-Dminecraft.client.jar="${jarPath}"`, "-Duser.dir=${game_directory}", "-Djava.library.path=${natives_directory}", "-Dminecraft.applet.TargetDirectory=${game_directory}", "-cp", "${classpath}", "${MAINCLASS}");
	}
	args.unshift(...config.client.customArguments.split(" ").filter(v => v == "" || v.startsWith("-Xms") || v.startsWith("-Xmx")));
	args.unshift(...instance.customArguments.split(" ").filter(v => v == "" || v.startsWith("-Xms") || v.startsWith("-Xmx")));
	args.unshift("-Xmx"+(instance.maximumRam || config.client.maximumRam)+"M");
	args.unshift("-Xms"+(instance.minimumRam || config.client.minimumRam)+"M");
	var nargs = [];
	for(let i of args){
		if(typeof i == "string"){
			nargs.push(i);
		}else if(evaluateRules(i.rules, {is_demo_user: false, has_custom_resolution: false})){
			nargs.push(...(typeof i.value == "string" ? [i.value] : i.value));
		}
	}
	for(let i in nargs){
		var arg = nargs[i];
		arg = arg.replace(/\${[^}]+}/g, function(substring){
			switch(substring){
				case "${launcher_name}":
					return "blast-launcher";
				case "${launcher_version}":
					return "1.0.0";
				case "${user_type}":
					return "mojang";
				case "${user_properties}":
					return "{}";
				case "${auth_access_token}":
				case "${auth_session}":
					return `"${account.accessToken}"`;
				case "${auth_uuid}":
					return `"${account.uuid}"`;
				case "${assets_index_name}":
					return `"${data.assets}"`;
				case "${auth_player_name}":
					return `"${account.username}"`;
				case "${version_name}":
					return `"${data.id}"`;
				case "${assets_root}":
				case "${game_assets}":
					return `"${data.assets == "legacy" ? path.join(dirname, "assets", "virtual", "legacy") : path.join(dirname, "assets")}"`;
				case "${game_directory}":
					return `"${path.join(dirname, "instances", instance.name)}"`;
				case "${natives_directory}":
					return `"${path.join(dirname, "versions", data.id, "natives")}"`;
				case "${classpath}":
					return `"${classpath}"`;
				case "${MAINCLASS}":
					return `"${data.mainClass}"`;
				default:
					return `""`;
			}
		});
		nargs[i] = arg;
	}
	console.log(nargs);
	return nargs.join(" ");
}
module.exports=generateArguments;