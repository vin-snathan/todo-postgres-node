const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';

let sequelize;

if(env === 'production') {
	sequelize = new Sequelize(process.env.DATABASE_URL, {
		dialect: 'postgres'
	});
} else {
	sequelize = new Sequelize('database', 'username', 'password', {
		dialect: 'sqlite',
		storage: __dirname + '/db/todoDatabase.sqlite'
	});
}

let db = {};

db.Todo = sequelize.import(__dirname + '/models/todo');
db.User = sequelize.import(__dirname + '/models/user');
db.Token = sequelize.import(__dirname + '/models/token.js');
db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.Todo.belongsTo(db.User);
db.User.hasMany(db.Todo);

module.exports = db;