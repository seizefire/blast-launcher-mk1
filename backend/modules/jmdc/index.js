// Packages
const fs = require("fs");
const javaClassTools = require("java-class-tools");

var fileReader = new javaClassTools.JavaClassFileReader();

class ClassInfo {
	#class;
	fields;

	constructor(path){
		this.#class = fileReader.readFromFile(path);
		for(var i of this.#class.fields){
			console.log(i);
		}
	}
}

new ClassInfo("CoreFMLLibraries.class");