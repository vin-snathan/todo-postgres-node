require('dotenv').config({ silent: process.env.NODE_ENV === 'production' })

const express = require('express'),
 	  bodyParser = require('body-parser'),
 	  cookieParser = require('cookie-parser'),
 	  methodOverride = require('method-override'),
 	  cryptojs = require('crypto-js'),
 	  path = require('path'),
 	  db = require('./db.js'),
 	  middleware = require('./middleware')(db),
 	  PORT = process.env.PORT || 3000,
 	  app = express();

/*--------------

TEMPLATE ENGINE

--------------*/
app.set('view engine', 'ejs');

/*--------------

   MIDDLEWARE

--------------*/
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

/*--------------

   TODO ROUTES

--------------*/
app.get('/', (request, response) => {
	var token = request.cookies.Auth_token || '';
	
	if(!token) {
		return response.render('landing');
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

		return db.User.findByToken(token);
	
	})
	.then(() => response.redirect('/todos'))
	.catch(e => {
		response.clearCookie('Auth_token');
		response.render('landing')
	});

});

app.get('/todos', middleware.requireAuthentication, (request, response) => {
	const query = request.query.value;
	let count;
	let where = {};
	where.userId = request.user.get('id');

	if(query === 'complete') {
		where.completed = true;
		db.Todo.findAll({where})
		.then(completedTodos => response.render('index', {todos: completedTodos, status: `COMPLETE`}))
		.catch(e => response.status(500).send());
	} else if(query === 'incomplete') {
		where.completed = false;
		db.Todo.findAll({where})
		.then(incompleteTodos => response.render('index', {todos: incompleteTodos, status: `INCOMPLETE`}))
		.catch(e => response.status(500).send());
	} else {
		db.Todo.findAll({where})
		.then(todos => response.render('index', {todos, status: `ALL`}))
		.catch(e => response.status(500).send());
	}
});

app.post('/todos', middleware.requireAuthentication, (request, response) => {
	let body = request.body;
	body.description = body.description.trim();
	
	db.Todo.create(body)
	.then(todo => {
		request.user.addTodo(todo)
		.then(() => todo.reload())
		.then(todo => response.redirect('/todos'))
	})
	.catch(e => response.status(400).json(e));
	
});

app.delete('/todos', middleware.requireAuthentication, (request, response) => {
		let where = {};
		where.userId = request.user.get('id');

		db.Todo.destroy({where})
		.then(numRows => {
			console.log(numRows);
			response.redirect('/todos');
		})
		.catch(err => console.log(err));
});

app.delete('/todos/:id', middleware.requireAuthentication, (request, response) => {
	const requestId = parseInt(request.params.id, 10);

	db.Todo.destroy({
		where: {
			id: requestId,
			userId: request.user.get('id')
		}
	})
	.then(() => response.redirect('/todos'))
	.catch(e => console.log(e));
});

app.get('/todos/:id', middleware.requireAuthentication, (request, response) => {
	const requestId = parseInt(request.params.id, 10);

	if(!requestId) {
		return response.redirect('/todos');
	}

	let where = {};
	where.userId = request.user.get('id');
	where.id = requestId;

	db.Todo.findOne({where})
	.then(foundTodo => {
		if(!!foundTodo) {
			response.render('editTodo', {foundTodo})
		} else {
			response.redirect('/todos')
		}
	})
	.catch(e => console.log(e));
});

app.put('/todos/:id', middleware.requireAuthentication, (request, response) => {
	const requestID = parseInt(request.params.id, 10);
	let where = {};
	where.userId = request.user.get('id');
	where.id = requestID;
	const body = request.body;
	const {completed} = body;
	
	if(completed === 'true') {
		body.completed = true;
	} else {
		body.completed = false;
	}

	db.Todo.update(body, {where})
	.then(updated => response.redirect('/todos'))
	.catch(e => console.log(e));

});

/*--------------

  USER ROUTES

--------------*/
app.get('/users/register', (request, response) => {
	var token = request.cookies.Auth_token || '';
	
	if(!token) {
		return response.render('register');
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

		return db.User.findByToken(token);
	
	})
	.then(() => response.redirect('/todos'))
	.catch(e => {
		response.clearCookie('Auth_token');
		response.render('register')
	});
});

app.post('/users', (request, response) => {
	const user = request.body;

	db.User.create(user)
	.then(() => response.redirect('/'))
	.catch(e => response.redirect('/users/register'));
});

app.post('/users/login', (request, response) => {
	const body = request.body;

	db.User.authenticate(body)
	.then(user => {
		let token = user.generateToken('authentication');
		return db.Token.create({
			token: token
		})
		
	})
	.then(tokenInstance => {
		response.cookie('Auth_token', tokenInstance.get('token'));
		response.header('Auth', tokenInstance.get('token'));
		response.redirect('/todos');
	})
	.catch(e => response.redirect('/'));
});

app.delete('/users/login', middleware.requireAuthentication, (request, response) => {
	response.clearCookie('Auth_token');
	request.token.destroy()
	.then(() => response.redirect('/'))
	.catch(err => console.log(err))
});

/*--------------

DATABASE/SERVER

--------------*/
db.sequelize.sync().then(() => {
	app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
});