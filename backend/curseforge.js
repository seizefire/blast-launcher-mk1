const path = require("path");
const AdmZip = require("adm-zip");
const config = require("./config");
const utilities = require("utilities");

const {fs, http} = utilities;

const dirname = process.cwd();

const generateInstanceName = function(base, checkBase=true){
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

module.exports = {
	async installZip(file){
		var zip = new AdmZip(file);
		var manifestEntry = zip.getEntry("manifest.json");
		var manifest = JSON.parse(manifestEntry.getData().toString());
		var name = generateInstanceName(manifest.name);
		var instancePath = path.join(dirname, "instances", name);
		var modsPath = path.join(instancePath, "mods");
		await fs.remove(instancePath);
		await fs.mkdir(instancePath, {recursive: true});
		await fs.remove(modsPath);
		await fs.mkdir(modsPath, {recursive: true});
		for(let i of manifest.files){
			let response = await http.request(`https://addons-ecs.forgesvc.net/api/v2/addon/${i.projectID}/file/${i.fileID}`);
			let result = await http.download(response.data.downloadUrl, path.join(modsPath, response.data.fileName), {size: response.data.fileLength});
			if(result){
				throw new Error(`Failed to download "https://addons-ecs.forgesvc.net/api/v2/addon/${i.projectID}/file/${i.fileID}": ${result}`);
			}
		}
		var override = manifest.overrides+"/";
		for(let i of zip.getEntries()){
			if(!i.entryName.endsWith("/")){
				let j = i.getData();
				if(j !== undefined){
					let filePath = path.resolve(instancePath, i.entryName.substring(override.length));
					let folderPath = path.dirname(filePath);
					if(fs.filetypeSync(folderPath) != "directory"){
						fs.removeSync(folderPath);
						fs.mkdirSync(folderPath, {recursive: true});
					}
					fs.removeSync(filePath);
					fs.writeFileSync(filePath, j);
				}
			}
		}
		var modpackMeta = await http.request(`https://addons-ecs.forgesvc.net/api/v2/addon/${manifest.projectID}`);
		var imageUrl = modpackMeta.data.attachments[0].url;
		var suffix = imageUrl.substring(imageUrl.lastIndexOf("."));
		var imagePath = path.join(instancePath, "blast_modpack_icon"+suffix);
		if(fs.filetypeSync(imagePath) != "file"){
			await fs.remove(imagePath);
			let result = await http.download(imageUrl, imagePath);
			if(result){
				throw new Error(`Failed to download "${imageUrl}": ${result}`);
			}
		}
		return {
			name: name,
			author: manifest.author,
			image: "{instance_path}\\blast_modpack_icon"+suffix,
			type: "forge",
			version: manifest.minecraft.version+"-"+manifest.minecraft.modLoaders[0].id.split("-")[1],
			displayVersion: `${manifest.version} (${manifest.minecraft.version})`,
			modpack: true,
			lastUsed: new Date().getTime(),
			customArguments: ""
		}
	}
}