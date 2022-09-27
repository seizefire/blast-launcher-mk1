const _path = require("path");

const AdmZip = require("adm-zip");
const cheerio = require("cheerio");

const {fs, http} = require("utilities");
const {request} = http;

const dirname = process.cwd();
const downloadPath = _path.join(dirname, "launcher", "modloader");
const manifestPath = _path.join(dirname, "launcher", "modloader_manifest.json");
const launcherPath = _path.dirname(downloadPath);

var manifest = {};

if(fs.filetypeSync(manifestPath) == "file"){
	try {
		manifest = JSON.parse(fs.readFileSync(manifestPath));
	}catch(err){
		manifest = {};
		err.toString();
	}
}

if(!manifest.modloader) manifest.modloader = {};
if(!manifest.modloadermp) manifest.modloadermp = {};

/**
 * @param {String} version 
 * @param {boolean} mp 
 */
async function download(version, mp){
	var slug = mp ? "modloadermp" : "modloader";
	var entry = manifest[slug][version];
	var result = await download(entry.direct_url, entry.path, {hash: entry.hash});
	if(result){
		if(entry.indirect_url && result != "FailedDownloadError"){
			if(/^https?:\/\/(www\.)?mediafire\.com\/file\//.test(entry.indirect_url)){
				let resp = await request(entry.indirect_url, {mime: "text/html"});
				if(resp.error){
					throw new Error(result+": Failed to download ModLoader "+version+" (URL="+entry.indirect_url+")");
				}
				let $ = cheerio.load(resp.data);
				let directUrl = $("a#downloadButton").attr("href");
				result = await download(directUrl, entry.path, {hash: entry.hash});
				if(result){
					throw new Error(result+": Failed to download ModLoader "+version+" (URL="+entry.indirect_url+")");
				}
			}else{
				throw new Error("UnknownError: Unsupported indirect URL (URL="+entry.indirect_url+")");
			}
		}else{
			throw new Error(result+": Failed to download ModLoader "+version+" (URL="+entry.direct_url+")");
		}
	}
	return entry.path;
}

module.exports = {
	/**
	 * Downloads a ModLoader file
	 * @param {string} version The version
	 * @returns {Promise<String>}
	 */
	downloadModLoader(version){
		return download(version, false);
	},
	/**
	 * Downloads a ModLoaderMP file
	 * @param {string} version The version
	 * @returns {Promise<String>}
	 */
	downloadModLoaderMP(version){
		return download(version, true);
	},
	/**
	 * 
	 * @param {String|AdmZip} path 
	 * @param {String} version 
	 * @param {boolean} mp 
	 */
	async inject(path, version, mp=false){
		/** @type {AdmZip} */
		var jar = typeof path == "string" ? new AdmZip(path) : path;
		var slugs = ["modloader"];
		if(mp === true){
			slugs.push("modloadermp");
		}
		for(let slug of slugs){
			let zipPath = _path.join(dirname, "launcher", "modloader", slug + version + ".zip");
			if(fs.filetypeSync(zipPath) != "file"){
				await fs.remove(zipPath);
				throw new Error("NotExistantError: Failed to inject ModLoader "+version+" (SLUG="+slug+")");
			}
			let zip = new AdmZip(zipPath);
			for(let i of zip.getEntries()){
				if(i.entryName.endsWith("/")){
					if(!jar.getEntry(i.entryName)){
						jar.addFile(i.entryName, null);
					}
				}else{
					await new Promise(resolve=>{
						i.getDataAsync(function(data){
							if(jar.getEntry(i.entryName)){
								jar.updateFile(i.entryName, data);
							}else{
								jar.addFile(i.entryName, data);
							}
							resolve();
						});
					});
				}
			}
		}
		for(let entry of jar.getEntries()){
			if(entry.entryName.startsWith("META-INF/") && entry.entryName != "META-INF/" && entry.entryName != "META-INF/MANIFEST.MF"){
				jar.deleteFile(entry);
			}
		}
		if(typeof path == "string"){
			jar.writeZip();
		}
	},
	/**
	 * Loads the metadata
	 */
	async loadMetadata(){
		try {
			for(var slug of ["modloader","modloadermp"]){
				let response = await request("https://mcarchive.net/api/v1/mods/by_slug/"+slug, {
					mime: "application/json",
					headers: {
						'X-Fields': '{"mod_versions":[]}'
					}
				});
				if(response.error){
					throw response.error;
				}
				for(var i of response.data.mod_versions){
					let f = i.files.find(v=>!v.name.toLowerCase().includes("javadoc") && !v.name.toLowerCase().includes("server"));
					let v = i.game_versions[0].name;
					if(!f){
						continue;
					}
					manifest[slug][v] = {
						path: _path.join(downloadPath, slug + v + f.name.match(/\.\D+/)[0]),
						hash: f.sha256,
						direct_url: f.archive_url||encodeURI(`https://b2.mcarchive.net/file/mcarchive/${f.sha256}/${f.name}`),
						indirect_url: f.redirect_url
					};
				}
			}
			if(fs.filetypeSync(launcherPath) != "directory"){
				await fs.remove(launcherPath);
				await fs.mkdir(downloadPath, {recursive: true});
			}else if(fs.filetypeSync(downloadPath) != "directory"){
				await fs.remove(downloadPath);
				await fs.mkdir(downloadPath);
			}
			await fs.writeFile(manifestPath, JSON.stringify(manifest));
		}catch(err){
			if(fs.filetypeSync(manifestPath) != "file"){
				await fs.remove(manifestPath);
				throw new Error(err+": Failed to load ModLoader manifest");
			}
			try {
				manifest = JSON.parse(fs.readFileSync(manifestPath));
			}catch(e){
				await fs.remove(manifestPath);
				throw new Error(err+": Failed to load ModLoader manifest");
			}
		}	
	}
}