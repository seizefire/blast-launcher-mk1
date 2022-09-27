// Packages
const config = require("../../backend/config");
const minecraft = require("../../backend/minecraft");
const components = require("./components");

var elements = {};

function createAccountEntry(k){
	var acc = typeof k == "string" ? minecraft.getAccount(k) : k;
	var key = acc.emailAddress;
	var $e = $(`<tr><td>${acc.username}</td><td>${acc.emailAddress}</td><td><button class="select"><i class="check circle icon"></i> Select</button></td><td><button class="remove"><i class="trash icon"></i> Remove</button>`)
	var $sb = $e.find("button.select");
	var $rb = $e.find("button.remove");
	var timeout;
	if(config.client.defaultAccount === key){
		$sb.prop("disabled", true);
		$sb.html(`<i class="check icon"></i> Selected`);
	}
	$sb.on("click", function(){
		if(config.client.defaultAccount === key){
			return;
		}
		if(config.client.defaultAccount.length > 0){
			let $psb = elements[config.client.defaultAccount].find("button.select");
			$psb.prop("disabled", false);
			$psb.html(`<i class="check circle icon"></i> Select`);
		}
		$sb.prop("disabled", true);
		$sb.html(`<i class="check icon"></i> Selected`);
		config.client.defaultAccount = key;
	});
	$rb.on("click", function(){
		if(timeout !== undefined){
			clearTimeout(timeout);
			$e.remove();
			delete elements[key];
			if(config.client.defaultAccount === key){
				config.client.defaultAccount = "";
			}
			acc.invalidate();
		}else{
			$rb.html(`<i class="trash icon"></i> Click again`);
			timeout = setTimeout(function(){
				timeout = undefined;
				$rb.html(`<i class="trash icon"></i> Remove`);
			}, 3000);
		}
	});
	$("div#accounts tbody").append($e);
	return $e;
}

window.addEventListener("DOMContentLoaded", function(){
	for(var i in config.client.accounts){
		elements[i] = createAccountEntry(i);
	}
	$("div#add-new-account").on("click", function(){
		components.showOverlay("mojang-login-window", true);
	});
	$("div#mojang-login-window>form").on("submit", function(evt){
		evt.preventDefault();
		var email = $("input#mojang-login-email").val();
		var password = $("input#mojang-login-password").val();
		if(email.length == 0){
			$("span#mojang-login-error").text("Enter an email address");
		}else if(password.length == 0){
			$("span#mojang-login-error").text("Enter a password");
		}else if(config.client.accounts[email]){
			$("span#mojang-login-error").text("This account has already been added");
		}else{
			minecraft.authenticate(email, password).then(function(account){
				if(!account){
					$("span#mojang-login-error").text("Incorrect email or password");
					return;
				}
				elements[email] = createAccountEntry(account);
				$("span#mojang-login-error").text("");
				$("input#mojang-login-email").val("");
				$("input#mojang-login-password").val("");
				components.hideOverlay();
			}).catch(function(){
				$("span#mojang-login-error").text("An error occured while logging in. Check your connection.");
			})
		}
		return false;
	})
});