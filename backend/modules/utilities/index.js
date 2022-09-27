module.exports = {
	fs: require("./fs"),
	http: require("./http"),
	timeout(milliseconds){
		return new Promise(function(resolve){
			setTimeout(function(){
				resolve();
			}, milliseconds);
		});
	}
};