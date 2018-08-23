import { readFile, writeFile } from 'fs';

readFile('./words_new.json', 'utf8', (err, data) => {
  console.log(data);
  const model = JSON.parse(data);
  let x = {};
  Object.keys(model).map( k => {
    x[k] = {
      len: model[k].length,
      data: model[k].map(w => ({ str: w }))
    };
  })
  writeFile('./model_new.json', JSON.stringify(x, null, 2), _ => 1);
})
