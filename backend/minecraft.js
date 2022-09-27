const os = require("os");
const jcl = require("java-class-tools");
const path = require("path");
const AdmZip = require("adm-zip");
const config = require("./config");
const semver = require("semver");
const modloader = require("./modloader");
const childProcess = require("child_process");

const {fs, http} = require("utilities");
const { request, download } = http;
const generateArguments = require("./minecraft/general");

const archConversions = {x32: "32", x64: "64"};
const classLoader = new jcl.JavaClassFileReader();
const dirname = process.cwd();
const forgeMetaPath = path.join(dirname, "launcher", "forgeversion_meta.json");
const mojangMetaPath = path.join(dirname, "launcher", "mojang_version_meta.json");
const versionMapPath = path.join(dirname, "launcher", "version_map.json");
const osConversions = {Linux: "linux", Darwin: "osx", Windows_NT: "windows"};

var accounts = {};
var accountArray = [];
var forgeMetadata = {};
var latestRelease = "";
var latestSnapshot = "";
var vanillaVersions = [];
var versions = {};
var versionMap = {forge: {}};

function insert(array, value, sorter){
	for(var i = 0; i < array.length; i+=2){
		if(sorter(array[i], value)){
			if(i > 0 && sorter(array[i-1], value)){
				--i;
			}
			array.splice(i, 0, value);
			return i;
		}
	}
	if(array.length%2 > 0){
		let ind = array.length-1;
		if(sorter(array[ind], value)){
			array.splice(ind, 0, value);
			return ind;
		}
	}
	array.push(value);
	return array.length-1;
}
function getAssetPath(name, hash, id){
	return id == "legacy" ? path.join(dirname, "assets", "virtual", "legacy", name) : path.join(dirname, "assets", "objects", hash.substr(0, 2), hash);
}
function getDataFromMeta(data, version, key){
	let extension = Object.keys(data.classifiers[key])[0];
	return [`https://files.minecraftforge.net/maven/net/minecraftforge/forge/${version}/forge-${version}-${key}.${extension}`, data.classifiers[key][extension]];
}
function getEntryData(entry){
	return new Promise(function(resolve){
		entry.getDataAsync(function(data){
			resolve(data);
		})
	})
}
async function generateFMLLibraries(libs, hashes){
	var libraries = [];
	for(var i in libs){
		let req = await request(`https://files.minecraftforge.net/fmllibs/${libs[i]}`, {method: "HEAD"});
		if(req.error){
			throw new Error(`${req.error}: Failed to download FML libraries (URL=https://files.minecraftforge.net/fmllibs/${libs[i]})`);
		}else if(req.status == 200){
			libraries.push({
				downloads: {
					artifact: {
						url: `https://files.minecraftforge.net/fmllibs/${libs[i]}`,
						path: `fmllibs/${libs[i]}`,
						sha1: hashes[i]
					}
				}
			});
		}else{
			libraries.push({
				downloads: {
					artifact: {
						url: `https://files.minecraftforge.net/fmllibs/${libs[i]}.stash`,
						path: `fmllibs/${libs[i]}`,
						sha1: hashes[i]
					}
				}
			});
		}
	}
	return libraries;
}
function readVanillaMetadata(code){
	if(fs.filetypeSync(mojangMetaPath) == "file"){
		try {
			var json = JSON.parse(fs.readFileSync(mojangMetaPath));
			latestRelease = json.latestRelease;
			latestSnapshot = json.latestSnapshot;
			vanillaVersions = json.versions;
			return;
		}catch(err){
			err.toString();
			throw new Error(`${code}: Failed to load the Mojang metadata`);
		}
	}else{
		throw new Error(`${code}: Failed to load the Mojang metadata`);
	}
}
function readForgeMetadata(code){
	if(fs.filetypeSync(forgeMetaPath) == "file"){
		try {
			var json = JSON.parse(fs.readFileSync(forgeMetaPath));
			forgeMetadata = json;
			return;
		}catch(err){
			err.toString();
			throw new Error(`${code}: Failed to load the Forge metadata`);
		}
	}else{
		throw new Error(`${code}: Failed to load the Forge metadata`);
	}
}
async function downloadForgeUniversal(version, vanilla, archivePath){
	var [releaseVersion, buildNumber] = version.split("-");
	let versionName = `${releaseVersion}-forge${version}`;
	let verPath = path.join(dirname, "versions", versionName);
	let jarPath = path.join(verPath, versionName+".jar");
	await vanilla.downloadClient();
	if(fs.filetypeSync(verPath) != "directory"){
		await fs.remove(verPath);
		await fs.mkdir(verPath);
	}
	await fs.copyFile(path.join(dirname, "versions",  releaseVersion, releaseVersion+".jar"), jarPath);
	let jar = new AdmZip(jarPath);
	let archive = new AdmZip(archivePath);
	if(semver.lt(semver.coerce(releaseVersion), "1.3.2")){
		let withMp = semver.lt(semver.coerce(releaseVersion), "1.2.3");
		await modloader.downloadModLoader(releaseVersion);
		if(withMp){
			await modloader.downloadModLoaderMP(releaseVersion);
		}
		await modloader.inject(jar, releaseVersion, withMp);
	}
	var libraries = undefined;
	for(let entry of archive.getEntries()){
		if(entry.entryName.trim().endsWith("/")){
			if(!jar.getEntry(entry.entryName)){
				jar.addFile(entry.entryName, Buffer.from([0]));
			}
		}else{
			let data = await getEntryData(entry);
			if(entry.entryName.endsWith("/CoreFMLLibraries.class")){
				let fmlClass = classLoader.read(data);
				let values = fmlClass.constant_pool.map(v => v.bytes ? Buffer.from(v.bytes).toString() : "");
				let libs = values.filter(v => /\.(jar|zip)$/.test(v));
				let hashes = values.filter(v => /[\dabcdef]{40}/.test(v));
				libraries = await generateFMLLibraries(libs, hashes);
			}
			if(jar.getEntry(entry.entryName)){
				jar.updateFile(entry.entryName, data);
			}else{
				jar.addFile(entry.entryName, data);
			}
		}
	}
	for(let entry of jar.getEntries()){
		if(entry.entryName.startsWith("META-INF/")){
			jar.deleteFile(entry);
		}
	}
	await new Promise(function(resolve, reject){
		jar.writeZip(undefined, function(err){
			if(err) return reject(err);
			resolve();
		});
	});
	var oldMeta = vanilla.getOriginalMetadata();
	var newMeta = {
		id: versionName,
		assets: oldMeta.assets,
		jar: versionName,
		inheritsFrom: releaseVersion,
		libraries: libraries
	};
	if(semver.lt(semver.coerce(releaseVersion), "1.3.2")){
		newMeta.javaVersion = 6;
	}
	await fs.writeFile(path.join(dirname, "versions", versionName, versionName+".json"), JSON.stringify(newMeta, null, 4));
	await fs.remove(archivePath);
	return versionName;
}
async function downloadForgeInstaller(version, archivePath){
	var zip = new AdmZip(archivePath);
	var manifestText = zip.getEntry("install_profile.json").getData().toString();
	var manifest = JSON.parse(manifestText).versionInfo;
	var id = manifest.id;
	if(manifest.libraries){
		for(var i = 0; i < manifest.libraries.length; ++i){
			let j = manifest.libraries[i];
			if(j.clientreq || j.serverreq){
				j.url = j.url || "https://libraries.minecraft.net/";
				let sep = j.name.split(":");
				sep.unshift(...sep.shift().split("."));
				let lbfn = `${sep[sep.length-2]}-${sep[sep.length-1]}.jar`;
				manifest.libraries[i] = {
					name: j.name,
					downloads: {
						artifact: {
							url: j.url + sep.join("/") + "/" + lbfn,
							path: path.join(...sep, lbfn).replaceAll("\\","/")
						}
					}
				}
			}else{
				manifest.libraries[i] = {
					name: j.name
				};
			}
		}
	}
	if(fs.filetypeSync(path.join(dirname, "versions", id)) != "directory"){
		await fs.remove(path.join(dirname, "versions", id));
		await fs.mkdir(path.join(dirname, "versions", id), {recursive: true});
	}
	await fs.remove(path.join(dirname, "versions", id, id+".json"));
	await fs.writeFile(path.join(dirname, "versions", id, id+".json"), JSON.stringify(manifest, null, 4));
	for(var i of zip.getEntries()){
		if(i.entryName.startsWith("forge-") && i.entryName.endsWith(".jar") && !i.entryName.includes("/")){
			let filePath = path.join(dirname, "libraries", "net", "minecraftforge", "forge", version, "forge-"+version+".jar");
			let folderPath = path.dirname(filePath);
			if(fs.filetypeSync(folderPath) != "directory"){
				await fs.remove(folderPath);
				await fs.mkdir(folderPath, {recursive: true});
			}
			await fs.remove(filePath);
			await fs.writeFile(filePath, i.getData());
		}
	}
	await fs.remove(archivePath);
	return id;
}
function saveVersionMap(){
	fs.writeFileSync(versionMapPath, JSON.stringify(versionMap));
}

class MCAccount {
	#name = "";
	constructor(name){
		this.#name = name;
	}
	get accessToken(){
		return config.client.accounts[this.#name].accessToken;
	}
	get emailAddress(){
		return config.client.accounts[this.#name].user.username;
	}
	get uuid(){
		return config.client.accounts[this.#name].selectedProfile.id;
	}
	get username(){
		return config.client.accounts[this.#name].selectedProfile.name;
	}
	/**
	 * Invalidates the access token (and removes the account from the config)
	 * @returns {Promise<boolean>} Whether or not the token was able to be invalidated
	 */
	async invalidate(){
		var account = config.client.accounts[this.#name];
		var accessToken = account.accessToken.includes(".") ? JSON.parse(atob(account.accessToken.split(".")[1])).yggt : account.accessToken;
		var response = await request("https://authserver.mojang.com/invalidate", {
			data: {
				accessToken: accessToken,
				clientToken: config.client.clientToken
			},
			method: "POST",
			mime: "application/json"
		});
		delete config.client.accounts[this.#name];
		delete accounts[this.#name];
		var index = accountArray.indexOf(this);
		if(index > -1){
			accountArray.splice(index, 1);
		}
		config.save();
		return true;
	}
	/**
	 * Reauthenticates only using a password
	 * @param {string} password
	 * @returns {Promise<boolean>} 
	 */
	async reauthenticate(password){
		var response = await request("https://authserver.mojang.com/authenticate", {
			method: "POST",
			mime: "application/json",
			data: {
				agent: {
					name: "Minecraft",
					version: 1
				},
				username: this.#name,
				password: password,
				clientToken: config.client.clientToken,
				requestUser: true
			}
		});
		if(response.error){
			if(response.data && response.data.error == "ForbiddenOperationException" && response.data.errorMessage == "Invalid credentials. Invalid username or password."){
				return false;
			}else{
				throw new Error(`${response.error}: Failed to reauthenticates an account (USERNAME=${this.username})`);
			}
		}
		delete response.data.clientToken;
		config.client.accounts[email] = response.data;
		config.save();
		return true;
	}
	/**
	 * Refreshes the access token
	 * @param {boolean} force Whether or not to skip the check for the previous token's validity. Defaults to `false`.
	 * @returns {Promise<boolean>} Whether or not the token was able to be refreshed
	 */
	async refresh(force=false){
		if(force == false){
			try {
				if(await this.validate() === true){
					return true;
				}
			}catch(err){
				throw err;
			}
		}
		var response = await request("https://authserver.mojang.com/refresh", {
			data: {
				accessToken: config.client.accounts[this.#name].accessToken,
				clientToken: config.client.clientToken
			},
			method: "POST"
		});
		if(response.error){
			if(response.data?.error === "ForbiddenOperationException" || response.data?.error === "IllegalArgumentException"){
				return false;
			}else{
				throw new Error(`${response.error}: Failed to refresh an account (USERNAME=${this.username})`);
			}
		}
		config.client.accounts[this.#name].accessToken = response.data.accessToken;
		config.save();
		return true;
	}
	/**
	 * Checks if the access token is valid
	 * @returns {Promise<boolean>} Whether or not the token is valid
	 */
	async validate(){
		var response = await request("https://authserver.mojang.com/validate", {
			data: {
				accessToken: config.client.accounts[this.#name].accessToken,
				clientToken: config.client.clientToken
			},
			method: "POST"
		});
		if(response.status == 403){
			return false;
		}else if(response.status == 204){
			return true;
		}else{
			throw new Error(`${response.error}: Failed to vaidate an account (USERNAME=${this.username})`);
		}
	}
}
class MCVersion {
	#data = {};

	/**
	 * @param {Object} data 
	 * @param {string} version 
	 */
	constructor(data, version){
		while(data.inheritsFrom){
			let inheritedData = JSON.parse(fs.readFileSync(path.join(dirname, "versions", data.inheritsFrom, data.inheritsFrom+".json")));
			if(inheritedData.downloads){
				if(data.inheritsFrom === data.jar){
					inheritedData.downloads.VERSION = data.inheritsFrom;
				}else{
					delete inheritedData.downloads;
				}
			}
		 	for(var i in data){
				if(i == "inheritsFrom"){
					continue; // This will cause an infinite loop of inheritance otherwise
				}else if(inheritedData[i] instanceof Array){
					if(data[i] instanceof Array){
						Array.prototype.push.apply(inheritedData[i], data[i]);
					}else{
						inheritedData[i].push(data[i]);
					}
				}else{
					inheritedData[i] = data[i];
				}
			}
			data = inheritedData;
		}
		if(data.downloads && data.downloads.client){
			let ver = data.downloads.VERSION ? data.downloads.VERSION : version;
			data.client = {
				url: data.downloads.client.url,
				path: path.join(dirname, "versions", ver, ver+".jar"),
				hash: data.downloads.client.sha1,
				size: data.downloads.client.size
			};
			delete data.downloads;
		}
		if(data.libraries){
			var libraries = [];
			for(let i of data.libraries){
				if(i.rules){
					let allow = false;
					for(let j of i.rules){
						if(j.os && j.os.name != osConversions[os.type()]){
							continue;
						}
						allow = j.action == "allow";
					}
					if(allow === false){
						continue;
					}
				}
				if(i.downloads){
					if(i.downloads.artifact){
						let artifact = i.downloads.artifact;
						libraries.push({
							name: i.name,
							url: artifact.url,
							path: path.join(dirname, "libraries", ...artifact.path.split("/").filter(v=>v.length>0)),
							hash: artifact.sha1,
							size: artifact.size
						});
					}
					if(i.downloads.classifiers && i.natives){
						let nativeKey = i.natives[osConversions[os.type()]];
						if(nativeKey){
							nativeKey = nativeKey.replace(/\${arch}/g, archConversions[os.arch()]);
							if(i.downloads.classifiers[nativeKey]){
								let native = i.downloads.classifiers[nativeKey];
								libraries.push({
									name: i.name,
									url: native.url,
									path: path.join(dirname, "libraries", ...native.path.split("/").filter(v=>v.length>0)),
									hash: native.sha1,
									size: native.size,
									excludes: i.extract ? i.extract.exclude : undefined
								});
							}
						}
					}
				}else{
					let sep = i.name.split(":");
					sep.unshift(...sep.shift().split("."));
					let lbfn = `${sep[sep.length-2]}-${sep[sep.length-1]}.jar`;
					libraries.push({
						name: i.name,
						path: path.join(dirname, "libraries", ...sep, lbfn)
					});
				}
			}
			data.libraries = libraries;
		}
		if(data.assetIndex){
			data.assetIndex = {
				url: data.assetIndex.url,
				path: path.join(dirname, "assets", "indexes", data.assetIndex.id+".json"),
				hash: data.assetIndex.sha1,
				size: data.assetIndex.size
			};
		}
		if(data.logging){
			if(data.logging.client){
				let logconf = data.logging.client;
				data.logging = {
					url: logconf.file.url,
					path: path.join(dirname, "assets", "log_configs", logconf.file.id),
					hash: logconf.file.sha1,
					size: logconf.file.size,
					argument: logconf.argument
				};
			}
		}
		data.jar = data.jar ? data.jar : version;
		this.#data = data;
	}
	/**
	 * Downloads the assets required to run this version of Minecraft
	 * @returns {Promise<{value: number, max: number}>}
	 */
	async downloadAssets(){
		var results = [];
		if(this.#data.assetIndex){
			let result = await download(this.#data.assetIndex.url, this.#data.assetIndex.path, {hash: this.#data.assetIndex.hash, size: this.#data.assetIndex.size});
			if(result){
				throw new Error(`${result}: Failed to download asset index (URL="${this.#data.assetIndex.url}")`);
			}
		}
		if(this.#data.assets){
			let manifestPath = path.join(dirname, "assets", "indexes", this.#data.assets+".json");
			if(fs.filetypeSync(manifestPath) != "file"){
				await fs.remove(manifestPath);
				throw new Error(`NotExistantError: Asset index doesn't exist (PATH="${manifestPath}")`);
			}
			let manifest;
			try {
				manifest = JSON.parse(fs.readFileSync(manifestPath).toString());
			}catch(err){
				await fs.remove(manifestPath);
				throw new Error(`NotExistantError: Asset index doesn't exist (PATH="${manifestPath}")`);
			}
			for(let name in manifest.objects){
				let obj = manifest.objects[name];
				results.push(await download(`http://resources.download.minecraft.net/${obj.hash.substr(0, 2)}/${obj.hash}`, getAssetPath(name, obj.hash, this.#data.assets), {hash: obj.hash, name: name}));
			}
		}
		return {value: results.filter(v=>v===undefined).length, max: results.length};
	}
	/**
	 * Downloads the client jar file required to run this version of Minecraft
	 * @returns {Promise<void>}
	 */
	async downloadClient(){
		if(this.#data.client){
			var result = await download(this.#data.client.url, this.#data.client.path, {hash: this.#data.client.hash, size: this.#data.client.size});
			if(result){
				throw new Error(`${result}: Failed to download client .jar (URL="${this.#data.client.url}")`);
			}
		}
	}
	/**
	 * Downloads the libraries required to run this version of Minecraft
	 * @returns {Promise<{value: number, max: number}>}
	 */
	async downloadLibraries(){
		var results = [];
		if(this.#data.logging && this.#data.logging.url){
			results.push(await download(this.#data.logging.url, this.#data.logging.path, {hash: this.#data.logging.hash, size: this.#data.logging.size}));
		}
		for(let i of this.#data.libraries){
			if(!i.url){
				continue;
			}
			results.push(await download(i.url, i.path, {hash: i.hash, size: i.size, name: i.name}));
		}
		return {value: results.filter(v=>v === undefined).length, max: results.length};
	}
	getMetadata(){
		return this.#data;
	}
	getOriginalMetadata(){
		return JSON.parse(fs.readFileSync(path.join(dirname, "versions", this.#data.id, this.#data.id+".json")));
	}
	/**
	 * Extract native files required to run this version of Minecraft
	 * @returns {Promise<void>}
	 */
	async extractNatives(){
		var nativesPath = path.join(dirname, "versions", this.#data.id, "natives");
		await fs.remove(nativesPath);
		await fs.mkdir(nativesPath);
		for(var i of this.#data.libraries.filter(v=>v.excludes)){
			let zip = new AdmZip(i.path);
			let entries = zip.getEntries();
			for(let entry of entries){
				if(entry.entryName.startsWith("META-INF/")){
					continue;
				}
				let fullPath = path.join(nativesPath, entry.entryName);
				if(entry.entryName.endsWith("/")){
					if(fs.filetypeSync(fullPath) != "directory"){
						await fs.remove(fullPath);
						await fs.mkdir(fullPath);
					}
				}else{
					await new Promise(function(resolve, reject){
						entry.getDataAsync(function(data){
							fs.remove(fullPath).then(function(){
								fs.writeFile(fullPath, data).then(function(err){
									if(err) return reject(err);
									resolve();
								});
							});
						});
					})
				}
			}
		}
	}
	/**
	 * Launches the game using the given instance
	 * @param {string} instance 
	 * @param {string} [account]
	 * @returns {Promise<childProcess.ChildProcess>}
	 */
	async launch(instance, account=config.client.defaultAccount){
		var instIndex = config.client.instances.findIndex(v => v.name == instance);
		var inst = config.client.instances[instIndex];
		var acc = accounts[account];
		var gameDir = path.join(dirname, "instances", inst.name);
		var javaPath = path.join(dirname, "launcher", "jre" + (this.#data.javaVersion || 8), "bin", os.type() == "Windows_NT" ? "javaw.exe" : "java");
		var jarPath = path.join(dirname, "versions", this.#data.jar, this.#data.jar+".jar");
		if(fs.filetypeSync(javaPath) != "file"){
			throw new Error("Java executable not found");
		}
		if(fs.filetypeSync(jarPath) != "file"){
			throw new Error("Jar not found");
		}
		if(fs.filetypeSync(gameDir) != "directory"){
			await fs.remove(gameDir);
			await fs.mkdir(gameDir, {recursive: true});
		}
		// https://bugs.mojang.com/browse/MCL-3732
		if(fs.filetypeSync(path.join(gameDir, "server-resource-packs"))){
			await fs.remove(path.join(gameDir, "server-resource-packs"));
			await fs.mkdir(path.join(gameDir, "server-resource-packs"));
		}
		var proc = childProcess.exec(`"${javaPath}" ${generateArguments(this.#data, acc, inst)}`);
		config.client.instances[instIndex].lastUsed = new Date().getTime();
		config.save();
		return proc;
	}
	/**
	 * Removes the native files (should be ran after the client has been exited)
	 * @returns {Promise<void>}
	 */
	async removeNatives(){
		await fs.remove(path.join(dirname, "natives", this.#data.id, "natives"));
	}
}
class MCForgeVersion extends MCVersion {
	/**
	 * @param {Object} data 
	 * @param {String} version 
	 */
	constructor(data, version){
		super(data, version);
	}
}
(function loadAccounts(){
	for(var i in config.client.accounts){
		let j = new MCAccount(i);
		accounts[i] = j;
		accountArray.push(j);
	}
	if(accountArray.length < 2){
		return;
	}
	accountArray = accountArray.sort(function(a, b){
		return a.username > b.username;
	});
})();
(function loadVersionMap(){
	try {
		versionMap = JSON.parse(fs.readFileSync(versionMapPath));
		if(!versionMap.forge){
			versionMap.forge = {};
		}
	}catch(err){
		versionMap = {forge: {}};
	}
})();
module.exports = {
	/** @returns {MCAccount} */
	get defaultAccount(){
		return config.client.defaultAccount.length == 0 ? undefined : accounts[config.client.defaultAccount];
	},
	get forgeMetadata(){
		return forgeMetadata;
	},
	get latestReleaseVersion(){
		return latestRelease;
	},
	get latestSnapshotVersion(){
		return latestSnapshot;
	},
	get vanillaVersions(){
		return vanillaVersions;	
	},
	/**
	 * Authenticates using an email and password
	 * @param {string} email 
	 * @param {string} password
	 * @returns {Promise<MCAccount>} 
	 */
	async authenticate(email, password){
		if(accounts[email]){
			return accounts[email];
		}
		var response = await request("https://authserver.mojang.com/authenticate", {
			method: "POST",
			mime: "application/json",
			data: {
				agent: {
					name: "Minecraft",
					version: 1
				},
				username: email,
				password: password,
				clientToken: config.client.clientToken,
				requestUser: true
			}
		});
		if(response.data && response.data.error == "ForbiddenOperationException" && response.data.errorMessage == "Invalid credentials. Invalid username or password."){
			return;
		}else if(response.error){
			throw new Error(`${response.error}: Failed to authenticate`);
		}
		delete response.data.clientToken;
		config.client.accounts[email] = response.data;
		let account = new MCAccount(email);
		accounts[email] = account;
		insert(accountArray, account, (a,b)=>a.username>b.username);
		config.save();
		return account;
	},
	/**
	 * Gets an account from the email
	 * @param {String} email 
	 * @returns {MCAccount}
	 */
	getAccount(email){
		return accounts[email];
	},
	/**
	 * Lists all stored accounts
	 * @returns {MCAccount[]}
	 */
	listAccounts(){
		return accountArray;
	},
	/**
	 * @param {string} version 
	 * @returns {Promise<MCForgeVersion>}
	 */
	async loadForgeBuild(version){
		if(versions[version]){
			return versions[version];
		}
		var json, localVersion;
		try {
			if(!versionMap.forge[version]){
				throw new Error("");
			}
			localVersion = versionMap.forge[version];
			let file = path.join(dirname, "versions", localVersion, localVersion);
			json = JSON.parse(fs.readFileSync(file+".json").toString());
			if(json.jar == localVersion && fs.filetypeSync(file+".jar") != "file"){
				await fs.remove(file+".jar");
				throw new Error("");
			}
		}catch(err){
			err.toString();
			var releaseVersion = version.split("-")[0];
			var legacy = true;
			var meta = await request(`https://files.minecraftforge.net/maven/net/minecraftforge/forge/${version}/meta.json`, {mime: "application/json"});
			if(meta.error){
				throw new Error(`${meta.error}: Failed to download Forge build meta (URL=https://files.minecraftforge.net/maven/net/minecraftforge/forge/${version}/meta.json)`);
			}
			var downloadData = [];
			if(meta.data.classifiers["installer"]){
				downloadData = getDataFromMeta(meta.data, version, "installer");
				legacy = false;
			}else if(meta.data.classifiers["universal"]){
				downloadData = getDataFromMeta(meta.data, version, "universal");
			}else{
				downloadData = getDataFromMeta(meta.data, version, "client");
			}
			var archivePath = path.join(dirname, downloadData[0].split("/").splice(-1, 1)[0]);
			var result = await download(downloadData[0], archivePath, {hash: downloadData[1]});
			if(result){
				throw new Error(`${result}: Failed to download Forge build (URL=${downloadData[0]})`);
			}
			var vanilla = await this.loadVanillaVersion(releaseVersion);
			localVersion = await (legacy === true ? downloadForgeUniversal(version, vanilla, archivePath) : downloadForgeInstaller(version, archivePath));
			versionMap.forge[version] = localVersion;
			saveVersionMap();
			json = JSON.parse(fs.readFileSync(path.join(dirname, "versions", localVersion, localVersion+".json")));
		}
		return versions[version] = new MCForgeVersion(json, localVersion);
	},
	async loadForgeMetadata(){
		var req = await request("https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.json", {mime: "application/json"});
		if(req.error){
			readForgeMetadata(req.error);
			return;
		}
		forgeMetadata = req.data;
		if(fs.filetypeSync(path.join(dirname, "launcher")) != "directory"){
			await fs.remove(path.join(dirname, "launcher"));
			await fs.mkdir(path.join(dirname, "launcher"));
		}
		await fs.writeFile(mojangMetaPath, JSON.stringify(forgeMetadata));
	},
	/**
	 * Loads a vanilla Minecraft version
	 * @param {String} version 
	 * @returns {Promise<MCVersion>}
	 */
	async loadVanillaVersion(version){
		if(versions[version]){
			return versions[version];
		}
		let file = path.join(dirname, "versions", version, version+".json");
		let item = vanillaVersions.find(v=>v.id==version);
		if(item === undefined){
			console.warn("Unable to confirm "+path.basename(file));
		}else{
			let result = await download(item.url, file, {hash: item.sha1});
			if(result){
				throw new Error(`${result}: Failed to download vanilla version JSON (URL="${item.url}")`);
			}
		}
		var json;
		try {
			json = JSON.parse(fs.readFileSync(file).toString());
		}catch(err){
			throw new Error(err.name+": Failed to load vanilla version (VERSION="+version+")");
		}
		return versions[version] = new MCVersion(json, version);
	},
	/**
	 * Loads the vanilla metadata
	 * @returns {Promise<void>}
	 */
	async loadVanillaMetadata(){
		var req = await request("https://launchermeta.mojang.com/mc/game/version_manifest.json", {mime: "application/json"});
		if(req.error){
			readVanillaMetadata(req.error);
			return;
		}
		var json = req.data;
		if(!json.latest || !json.versions){
			readVanillaMetadata("BadBodyError");
			return;
		}
		latestRelease = json.latest.release;
		latestSnapshot = json.latest.snapshot;
		vanillaVersions = [];
		for(var i of json.versions){
			vanillaVersions.push({
				id: i.id,
				type: i.type,
				url: i.url,
				sha1: i.url.split("/").splice(-2, 1)[0],
				time: i.time,
				releaseTime: i.releaseTime
			});
		}
		if(fs.filetypeSync(path.join(dirname, "launcher")) != "directory"){
			await fs.remove(path.join(dirname, "launcher"));
			await fs.mkdir(path.join(dirname, "launcher"));
		}
		await fs.writeFile(mojangMetaPath, JSON.stringify({
			latestRelease: latestRelease,
			latestSnapshot: latestSnapshot,
			versions: vanillaVersions
		}));
	}
}