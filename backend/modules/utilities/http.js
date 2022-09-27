const _path = require("path");

const fs = require("fs");
const dns = require("dns");
const axios = require("axios").default;
const crypto = require("crypto");
const AxiosHTTP = require("axios/lib/adapters/http");

const hashLength = {32: "md5", 40: "sha1", 64: "sha256", 128: "sha512"}

function checkInternet(){
	return new Promise(function(resolve){
		dns.lookup("www.google.com", function(err, address, family){
			resolve(!err || err.code != "ENOTFOUND");
		});
	});
}
function hash(path, algorithm){
	return new Promise(function(resolve, reject){
		var readStream = fs.createReadStream(path);
		var hashStream = crypto.createHash(algorithm);
		readStream.on("end", function(){
			hashStream.end(function(){
				resolve(hashStream.digest().toString("hex").toLowerCase());
			});
		});
		hashStream.on("error", function(err){
			err.toString();
			resolve("");
		})
		readStream.on("error", function(err){
			err.toString();
			resolve("");
		})
		readStream.pipe(hashStream);
	});
}

var mexports =  {
	async download(url, path, options={}){
		if(fs.existsSync(path) && fs.lstatSync(path).isFile()){
			var pass = true;
			if(options.size && options.size != fs.lstatSync(path).size){
				pass = false;
			}
			if(pass && options.hash && options.hash.toLowerCase() != await hash(path, hashLength[options.hash.length])){
				pass = false;
			}
			if(pass && (options.size || options.hash)){
				return;
			}
		}
		options.responseType = "stream";
		var request = await mexports.request(url, options);
		if(request.error){
			return request.error;
		}
		let parentDirectory = _path.dirname(path);
		if(fs.existsSync(parentDirectory) && !fs.lstatSync(parentDirectory).isDirectory()){
			await fs.promises.rm(parentDirectory);
		}
		if(!fs.existsSync(parentDirectory)){
			await fs.promises.mkdir(parentDirectory, {recursive: true});
		}
		return await new Promise(function(resolve){
			var writeStream = fs.createWriteStream(path);
			var hashStream = options.hash ? crypto.createHash(hashLength[options.hash.length]) : undefined;
			request.data.on("end", function(){
				writeStream.end(function(){
					if(options.hash){
						if(options.hash.toLowerCase() !== hashStream.digest().toString("hex").toLowerCase()){
							return resolve("BadBodyError");
						}
						hashStream.end();
					}
					resolve();
				});
			});
			request.data.pipe(writeStream);
			if(options.hash){
				request.data.pipe(hashStream);
			}
		});
	},
	async request(url, options={}){
		if(await checkInternet() === false){
			return {error: "NoInternetError"};
		}
		options.url = url;
		options.adapter = AxiosHTTP;
		if(!options.method){
			options.method = "get";
		}
		var request;
		try {
			request = await axios.request(options);
			if(!request.data && options.method.toLowerCase() != "head"){
				return {...request, error: "BadBodyError"};
			}
			if(options.mime !== undefined && options.mime !== request.headers["content-type"]){
				return {...request, error: "BadBodyError"};
			}
			if(options.size !== undefined && options.size !== parseInt(request.headers["content-length"])){
				return {...request, error: "BadBodyError"};
			}
			return request;
		}catch(err){
			err.toString();
			if(err.response){
				return err.response;
			}
			return {error: err};
		}
	}
}
module.exports = mexports;