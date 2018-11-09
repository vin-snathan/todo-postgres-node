const bcrypt = require('bcrypt');
const cryptojs = require('crypto-js');
const jwt = require('jsonwebtoken');

module.exports = (sequelize, DataTypes) => {
	var User = sequelize.define('user', {
		email: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
			validate: {
				isEmail: true,
				isLowercase: true
			}
		},

		salt: DataTypes.STRING,

		password_hash: DataTypes.STRING,

		password: {
			type: DataTypes.VIRTUAL,
			allowNull: false,
			validate: {
				len: [7, 100]
			},
			set(value) {
				var salt = bcrypt.genSaltSync(10);
				var hashedPassword = bcrypt.hashSync(value, salt);

				this.setDataValue('password', value);
				this.setDataValue('salt', salt);
				this.setDataValue('password_hash', hashedPassword);
			}
		}
	});

	User.authenticate = function(body) {
		return new Promise(function(resolve, reject) {

			User.findOne({ where: {email: body.email} })
			.then(user => {
				if(!user || !bcrypt.compareSync(body.password, user.get('password_hash'))) {
					return reject();
				}

				resolve(user);
			})
			.catch(e => reject());
		
		})
	}

	User.findByToken = function(token) {
		return new Promise(function(resolve, reject) {
			try {
				var decodedJWT = jwt.verify(token, process.env.JWT_SIG);
				var bytes = cryptojs.AES.decrypt(decodedJWT.token, process.env.CRYPTOJS_SIG);
				var tokenData = JSON.parse(bytes.toString(cryptojs.enc.Utf8));

				User.findById(tokenData.id)
				.then(user => {
					if(user) {
						resolve(user);
					} else {
						reject();
					}
				})
				.catch(e => reject());
			} catch(e) {
				reject();
			}
		});
	}

	User.prototype.generateToken = function(type) {
		try {
			var stringData = JSON.stringify({id: this.get('id'), type: type});
			var encryptedData = cryptojs.AES.encrypt(stringData, process.env.CRYPTOJS_SIG).toString();
			
			var token = jwt.sign({
				token: encryptedData,
			}, process.env.JWT_SIG);

			return token;

		} catch(e) {
			return undefined;
		}
	};

	return User;
}