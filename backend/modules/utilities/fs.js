const _path = require("path");

const fs = require("fs");
const tar = require("tar-stream");
const zlib = require("zlib");
const crypto = require("crypto");
const AdmZip = require("adm-zip");

var hashLength = [];
hashLength[32] = "md5";
hashLength[40] = "sha1";
hashLength[64] = "sha256";
hashLength[128] = "sha512";

function extractTar(output){
	let extract = tar.extract();
	extract.on("entry", function(headers, stream, next){
		var entryPath = path.join(output, ...headers.name.split("/").filter(v=>v!=""));
		switch(headers.type){
			case "file":
				var writeStream = fs.createWriteStream(entryPath);
				stream.on("end", function(){
					writeStream.end(function(){
						next();
					});
				});
				stream.pipe(writeStream);
				break;
			case "directory":
				fs.mkdir(entryPath, function(){
					next();
				});
				break;
			case "symlink":
				fs.symlinkSync(headers.linkname, entryPath);
				next();
				break;
			default:
				console.log("WeirdHeaders", headers);
				next();
				break;
		}
	});
	return extract;
}

var exp = {
	async deescFolder(folder){
		var list = await fs.promises.readdir(folder);
		while(list.length == 1 && this.filetypeSync(_path.join(folder, list[0])) == "directory"){
			let f0 = _path.join(folder, list[0]);
			list = await fs.promises.readdir(f0);
			for(var i of list){
				await fs.promises.rename(_path.join(f0, i), _path.join(folder, i));
			}
			await fs.promises.rmdir(f0, {recursive: true});
		}
	},
	deescFolderSync(folder){
		var list = fs.readdirSync(folder);
		while(list.length == 1 && this.filetypeSync(_path.join(folder, list[0])) == "directory"){
			let f0 = _path.join(folder, list[0]);
			list = fs.readdirSync(f0);
			for(var i of list){
				fs.renameSync(_path.join(f0, i), _path.join(folder, i));
			}
			fs.rmSync(f0, {recursive: true, force: true});
		}
	},
	decompress(input, output){
		output = _path.resolve(output);
		return new Promise(function(resolve, reject){
			try {
				var extension = input.match(/(\.[a-zA-Z]+)+$/)[0];
				if(extension == ".zip"){
					let zip = new AdmZip(input);
					if(exp.filetypeSync(output) != "directory"){
						exp.removeSync(output);
					}
					zip.extractAllTo(output);
					resolve();
				}else if(extension == ".tar.gz" || extension == ".tgz"){
					let readStream = fs.createReadStream(input);
					let gunzip = zlib.createGunzip();
					let extract = extractTar(output);
					extract.on("finish", function(){
						resolve();
					});
					readStream.pipe(gunzip);
					gunzip.pipe(extract);
				}else if(extension == ".tar"){
					let readStream = fs.createReadStream(input);
					let extract = extractTar(output);
					extract.on("finish", function(){
						resolve();
					});
					readStream.pipe(extract);
				}else{
					throw new Error("Invalid file type: "+extension);
				}
			}catch(err){
				reject(err);
			}
		});
	},
	async filetype(path){
		if(!fs.existsSync(path)) return "none";
		var stat = await fs.stat(path);
		if(stat.isFile()) return "file";
		if(stat.isDirectory()) return "directory";
	},
	filetypeSync(path){
		if(!fs.existsSync(path)) return "none";
		var stat = fs.statSync(path);
		if(stat.isFile()) return "file";
		if(stat.isDirectory()) return "directory";
	},
	hashFile(path, algorithm, encoding){
		return new Promise(function(resolve, reject){
			var hash = crypto.createHash(algorithm);
			var stream = fs.createReadStream(path);
			stream.on("close", function(){
				resolve(encoding ? hash.digest(encoding) : hash.digest());
			});
			stream.on("error", function(err){
				reject(err);
			})
			hash.on("error", function(err){
				reject(err);
			});
			stream.pipe(hash);
		});
	},
	hashFileSync(path, algorithm, encoding){
		var hash = crypto.createHash(algorithm);
		hash.update(fs.readFileSync(path));
		return encoding ? hash.digest(encoding) : hash.digest();
	},
	async remove(path){
		if(fs.existsSync(path)){
			if(fs.lstatSync(path).isDirectory()){
				await fs.promises.rmdir(path, {recursive: true});
			}else{
				await fs.promises.unlink(path);
			}
		}
	},
	removeSync(path){
		if(fs.existsSync(path)){
			if(fs.lstatSync(path).isDirectory()){
				fs.rmdirSync(path, {recursive: true});
			}else{
				fs.unlinkSync(path);
			}
		}
	}
};
for(let i of Object.keys(fs.promises)){
	exp[i] = fs.promises[i];
}
for(let i of Object.keys(fs)){
	if(!exp[i]){
		exp[i] = fs[i];
	}
}
module.exports = exp;