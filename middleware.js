const cryptojs = require('crypto-js');

module.exports = function(db) {
	return {
		requireAuthentication: function(request, response, next) {

			// Extracts the token from the 'Auth' property from the request's header
			var token = request.cookies.Auth_token || '';

			if(!token) {
				response.render('errorPage');
			}

			db.Token.findOne({
				where: {
					tokenHash: cryptojs.MD5(token).toString()
				}
			})
			.then(tokenInstance => {
				if(!tokenInstance) {
					throw new Error();
				}

				request.token = tokenInstance; // For request.token.destroy() in app.js route: app.delete('users/login')
				return db.User.findByToken(token);
			
			})
			.then(user => {
				request.user = user;
				next();
			})
			.catch(e => {
				response.clearCookie('Auth_token');
				
				if(request.token) {
					request.token.destroy()
					.then(() => response.render('errorPage'))
					.catch(err => console.log(err))	
				} else {
					response.render('errorPage');
				}
				
			});
		}
	}
}