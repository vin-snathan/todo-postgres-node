const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const db = require('./db.js');
const middleware = require('./middleware')(db);
const PORT = process.env.PORT || 3000;

const app = express();

/*--------------

TEMPLATE ENGINE

--------------*/
app.set('view engine', 'ejs');

/*--------------

   MIDDLEWARE

--------------*/
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

/*--------------

   TODO ROUTES

--------------*/
app.get('/users/register', (request, response) => {
	response.render('register');
});

app.get('/todos', (request, response) => {
	const query = request.query.value;

	if(query === 'complete') {
		db.Todo.findAll({where: {completed: true}})
		.then(completedTodos => response.render('index', {todos: completedTodos}))
		.catch(e => response.status(500).send());
		// toDoDisplay = todos.filter(todo => todo.completed === true)
	} else if(query === 'incomplete') {
		db.Todo.findAll({where: {completed: false}})
		.then(incompleteTodos => response.render('index', {todos: incompleteTodos}))
		.catch(e => response.status(500).send());
		// toDoDisplay = todos.filter(todo => todo.completed === false)
	} else {
		db.Todo.findAll()
		.then(todos => {
			todos.forEach(el => console.log(el.toJSON()));
			return response.render('index', {todos})
		})
		.catch(e => response.status(500).send());
	}

	// response.render('index', {todos: toDoDisplay});
});

app.post('/todos', (request, response) => {
	let body = request.body;
	body.description = body.description.trim();

	db.Todo.create(body)
	.then(todo => console.log(todo.toJSON()))
	.catch(err => console.log(err));

	response.redirect('/todos');

	// let body = request.body;
	// body.completed = false;
	// body.id = id;
	// id++;
	// todos.push(body);
	
});

app.delete('/todos', (request, response) => {
		db.Todo.destroy({truncate: true})
		.then(numRows => {
			console.log(numRows);
			response.redirect('/todos');
		})
		.catch(err => console.log(err));
});

app.delete('/todos/:id', (request, response) => {
	const requestID = parseInt(request.params.id, 10);

	db.Todo.destroy({
		where: {
			id: requestID
		}
	})
	.then(() => response.redirect('/todos'))
	.catch(e => console.log(e));
	// const id = parseInt(request.params.id, 10);
	// todos = todos.filter(item => item.id !== id);
	// response.redirect('/todos');
});

app.get('/todos/:id', (request, response) => {
	const requestID = parseInt(request.params.id, 10);

	db.Todo.findById(requestID)
	.then(foundTodo => {
		if(foundTodo) {
			response.render('editTodo', {foundTodo})
		} else {
			response.redirect('/todos')
		}
	})
	.catch(e => console.log(e));
	// const id = parseInt(request.params.id, 10);
	// const foundTodo = todos.find(todo => todo.id === id);
	// response.render('editTodo', {foundTodo});
});

app.put('/todos/:id', (request, response) => {
	const requestID = parseInt(request.params.id, 10);
	const where = {id: requestID};
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

	// todos = todos.map(todo => {
	// 	return todo.id === id ? {...todo, ...body} : todo;
	// });

	// response.redirect('/todos');

});

/*--------------

  USER ROUTES

--------------*/
app.post('/users', (request, response) => {
	const user = request.body;

	db.User.create(user)
	.then(() => response.redirect('/'))
	.catch(e => response.status(400).json(e));
});

app.post('/users/login', (request, response) => {
	const body = _.pick(request.body, 'email', 'password');

	db.User.authenticate(body)
	.then(user => {
		let token = user.generateToken('authentication');

		return db.Token.create({
			token: token
		})
		
	})
	.then(tokenInstance => response.header('Auth', tokenInstance.get('token')).send())
	.catch(e => response.status(401).send());
});

app.delete('/users/login', middleware.requireAuthentication, (request, response) => {
	request.token.destroy()
	.then(() => response.status(204).send())
	.catch(() => response.status(500).send())
});

/*--------------

DATABASE/SERVER

--------------*/
db.sequelize.sync({force: true}).then(() => {
	app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
});