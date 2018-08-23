import { readFile } from 'fs';

readFile ('./model_new.json', 'utf8', (err, data) => {
	const model = JSON.parse(data);

	// count words
	let total = 0;
	Object.keys(model).map( (key, index) => {
		console.log(`${key} : ${model[key].data.length} words`);
		total = total + model[key].data.length;
	});
	console.log(`Total : ${total} words`);


});

readFile ('./dict.json', 'utf8', (err, data) => {
	const model = JSON.parse(data);

	// count words
	let total = 0;
	Object.keys(model).map( (key, index) => {
		console.log(`${key} : ${model[key].data.length} words`);
		total = total + model[key].data.length;
	});
	console.log(`Total : ${total} words`);


});
