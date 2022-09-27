// Packages
const fs = require("fs");
// Constants
const configPath = "config.json";

// Create file if it doesn't exist
if(!fs.existsSync(configPath)){
	fs.writeFileSync(configPath, "{}");
}

// Functions
function hex(length){
	var str = "";
	for(var i = 0; i < length; ++i){
		str += "0123456789abcdef"[Math.floor(Math.random()*16)]
	}
	return str;
}

// Type Definitions
/**
 * @typedef {{id: string, name: string, userId?: string, createdAt?: number, legacyProfile?: boolean, suspended?: boolean, paid?: boolean, migrated?: boolean, legacy?: boolean}} Profile
 * @typedef {{accessToken: string, availableProfiles: Profile[], selectedProfile: Profile, user?: {id: string, email?: string, username: string, registerIp?: string, migratedFrom?: string, migratedAt?: number, registeredAt?: number, passwordChangedAt?: number, dateOfBirth?: number, suspended?: boolean, blocked?: boolean, secured?: boolean, migrated?: boolean, emailVerified?: boolean, legacyUser?: boolean, verifiedByParent?: boolean, properties?: {name: string, value: string}[]}}} Account
 * @typedef {{name: string, image: string, author: string, type: "vanilla" | "forge", path?: string, version: string, tag?: string, lastUsed: Number, displayVersion?: String, minimumRam: number, maximumRam: number, customArguments: string}} PartialClientInstance
 * @typedef {{client: {accounts: Object.<string, Account>, instances: PartialClientInstance[], clientToken: string, defaultAccount: string, minimumRam: number, maximumRam: number, customArguments: string}, save: ()=>void}} BaseConfig
 */

// Config Variable
/** @type {BaseConfig} */
var config = JSON.parse(fs.readFileSync(configPath));

// Adding save function
config.save = function(){
	fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
};

// Fix configurations
if(!config.client) config.client = {};
if(!config.client.instances) config.client.instances = [];
if(!config.client.accounts) config.client.accounts = {};
if(!config.client.clientToken) config.client.clientToken = hex(32);
if(!config.client.defaultAccount) config.client.defaultAccount = "";
if(!config.client.minimumRam) config.client.minimumRam = 1024;
if(!config.client.maximumRam) config.client.maximumRam = 2048;
config.save();

// Exports
module.exports = config;