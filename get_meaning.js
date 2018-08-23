import axios from 'axios';
import cheerio from 'cheerio';
import qs from 'qs';
import { writeFile, readFile } from 'fs';

const failureStack = [];

const host = `http://indradhanush.unigoa.ac.in/odiawordnet/public/wordnet`;
const AJAX = 'ajax', GET = 'get', POST = 'post', EMPTY = '';

const log = (type, data) => console.log(`${JSON.stringify(type)}\t${JSON.stringify(data)}\n`);
const failed = what => how => console.log({ what });
const errorlog = err => log('[-] error', JSON.stringify(err));
const error = what => how => errorlog(`${what}\n${how}`);

const extractHTML = ({ data }) => data;
const extractLinks = str => cheerio.load(str)('a').get().map( el => el.attribs.href );

const ajaxThrottle = 0;
let ajaxCounter = 0;

const ajax = (url, get=false) => data => new Promise( (resolve, reject) => { 
	const timeout = ajaxThrottle * (ajaxCounter++);

	setTimeout( _ =>  
		axios({
			method: get ? GET : POST,
			url: `${host}/${url}${get ? `?${qs.stringify(data)}` : ''}`,
			headers: get ? undefined : { "Content-type": "application/x-www-form-urlencoded" },
			data: get ? undefined : qs.stringify(data)
		}).then( x => {
				//console.log(`${url} ${data} -- ${timeout}`);
				return x;
			})
			.then( resolve )
			//.catch( reject )
			.catch( failed({ AJAX, url, data }) ), 
		timeout	
	)
});


let dict = {};
function _pseries(list) {  
	var p = Promise.resolve();
	let conn = 0;
	let buffer = [];
	return list.reduce(function(pacc, fn) {
		if (conn < 2) {
			console.log(conn);
			buffer.push(fn());
			conn++;
			return pacc;
		}
		else {
			buffer.push(fn());
			conn = 0;
			pacc = pacc.then(_ => Promise.all([...buffer]));
			buffer = [];
			return pacc;
		}
	}, p);
}

function pseries(list) {  
	  var p = Promise.resolve();
		  return list.reduce(function(pacc, fn) {
				    return pacc = pacc.then(fn);
						  }, p);
}

readFile('./model_new.json', 'utf8', (err, str) => {
	const model = JSON.parse(str);

	//console.log(qs.stringify({ phase: 'meaning' }));

	const processed = Promise.all( Object.keys(model).slice(0).map((key, index) => {
		const words = model[key].data.map( x => x.str );
		dict[key] = { len: model[key].len, words, data: {}};
		return pseries( words.slice(0).map( word => {
			const searchword = word.replace(/^\s+|\s+$/g, '').replace(/ /g,"_");
			return _ => ajax ('getsynsetsofword.php') ({ searchword })
				.then( extractHTML )
				.then( _data => {
					const data = typeof _data === 'string' ? JSON.parse(_data) : _data;
					let id = data.Adjective || data.Adverb || data.Noun || data.Verb;
					if (typeof id === 'string') {
						id = parseInt( id.split(',')[0], 10);
					}
					dict[key].data[word] = {};
					dict[key].data[word].ref = id;
					dict[key].data[word].self = word;

					if(data.Failure) {
						failureStack.push(word);
						//console.log('FAILED TO GET MEANING OF ', word);
						return false;
					}

					return id;
				})
				.then(synid => Promise.all([
					synid ? ajax('getsynsetinformation.php', true) ({ synid })
						.then( extractHTML )
						.then( str => [
							cheerio.load(str)('.synsGramInfo').text().split(':').map(x => x.trim()).filter(x => x != '' ),
							cheerio.load(str)('.synsInfo').text().split('.').map(x => x.trim()).filter(x => x != '' ),
						])
						.then( arrs => {
							dict[key].data[word][arrs[0][0]] = arrs[1][0];
							dict[key].data[word][arrs[0][1]] = arrs[1][1].split(',').map(x => x.trim()).filter(x => x != '' );
							dict[key].data[word][arrs[0][2]] = arrs[1].length == 3 ? '' : arrs[1][2];
							dict[key].data[word][arrs[0][3]] = arrs[1].length == 3 ? arrs[1][2] : arrs[1][3];
							process.stdout.write(JSON.stringify(dict[key].data[word], null, 2));
							return 0;
						})
						.catch( error({ word }))
					: Promise.resolve(0)
				]))
				.catch( error({ word }) );
		}));
	}));

	return processed.then( _ => {
		writeFile('dict.json', JSON.stringify(dict, null, 2), 'utf8', _ => 1);
		//console.log(failureStack.length);
		writeFile('failed.json', JSON.stringify(failureStack, null, 2), 'utf8', _ => 1);
	});
});
