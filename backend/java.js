const os = require("os");
const path = require("path");

const {fs, http} = require("utilities");
const {download, request} = http;

const arch = {x32: "x86", x64: "x86"};
const arch32 = ["x32","arm"];
const dirname = process.cwd();
const osconv = {Windows_NT: "windows", Darwin: "macos", Linux: "linux"}

module.exports = {
	/**
	 * @param {Number} version
	 */
	async download(version){
		const jdkPath = path.join(dirname, "launcher", "jdk"+version);
		const jrePath = path.join(dirname, "launcher", "jre"+version);
		var filePath = "";
		await fs.remove(jdkPath);
		await fs.mkdir(jdkPath, {recursive: true});
		if(version < 8){
			let architecture = arch[os.arch()];
			let bitness = arch32.includes(os.arch()) ? 32 : 64;
			let response = await request("https://api.azul.com/zulu/download/community/v1.0/bundles/latest/?jdk_version="+version+"&os="+osconv[os.type()]+"&arch="+architecture+"&hw_bitness="+bitness+"&bundle_type=jdk", {mime: "application/json"});
			let data = response.data;
			let downloadResponse = await download(data.url, path.join(jdkPath, data.name), {hash: data.md5_hash});
			if(downloadResponse){
				throw new Error(downloadResponse+": Failed to download JDK version "+version);
			}
			filePath = path.join(jdkPath, data.name);
		}else{
			let response = await request(`https://api.adoptopenjdk.net/v3/assets/latest/${version}/hotspot`);
			let data = response.data;
			data = data.find(v => (v.binary.architecture == os.arch() && v.binary.image_type == "jdk" && v.binary.os == osconv[os.type()]));
			if(!data){
				throw new Error("NoEntryFoundError: Failed to download JDK version "+version);
			}
			data = data.binary.package;
			let downloadResponse = await download(data.link, path.join(jdkPath, data.name), {hash: data.checksum, size: data.size});
			if(downloadResponse){
				throw new Error(downloadResponse+": Failed to download JDK version "+version);
			}
			filePath = path.join(jdkPath, data.name);
		}
		await fs.decompress(filePath, jdkPath);
		await fs.remove(filePath);
		let entries = await fs.readdir(jdkPath);
		await fs.remove(jrePath);
		await fs.rename(entries.length === 1 ? path.join(jdkPath, entries[0], "jre") : path.join(jdkPath, "jre"), jrePath);
		await fs.remove(jdkPath);
	}
}