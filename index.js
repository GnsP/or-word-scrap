import axios from 'axios';
import cheerio from 'cheerio';
import qs from 'qs';
import { writeFile } from 'fs';

const failureStack = [];
const pageCounts = {};
let words = {};

const host = `http://indradhanush.unigoa.ac.in/odiawordnet/public/glossary`;
const AJAX = 'ajax', GET = 'get', POST = 'post', EMPTY = '';

const log = (type, data) => console.log(`${type}\t${data}\n`);
const failed = what => how => failureStack.push({ what, how });
const errorlog = err => log('[-] error', err);
const error = what => how => errorlog(`${what}\n${how}`);

const extractHTML = ({ data }) => data;
const extractLinks = str => cheerio.load(str)('a').get().map( el => el.attribs.href );

const ajaxThrottle = 10000;
let ajaxCounter = 0;

const ajax = url => data => new Promise( (resolve, reject) => { 
	const timeout = ajaxThrottle * ((ajaxCounter++) % 97) + ajaxCounter * 100;

	console.log(`${url} ${data} -- ${timeout}`)
	setTimeout( _ =>  
		axios({
			method: POST,
			url: `${host}/${url}`,
			headers: { "Content-type": "application/x-www-form-urlencoded" },
			data: qs.stringify(data)
		}).then( extractHTML )
			.then( resolve )
			.catch( reject )
			.catch( failed({ AJAX, url, data }) ), 
		timeout	
	)
});


const getCharacters = (xmlfile, idno, _, __) => ajax ('createGlossary.php')({ xmlfile, idno });
const getPages = (letter, _) => ajax ('createPaging.php')({ letter });
const getGloss = (letter, page) => ajax ('createGloss.php')({ letter, page });
const getGlossProxy = (letter, page) => {
  const pageNo = parseInt(page, 10);
  if (!pageCounts[letter]) {
    pageCounts[letter] = 0;
  }
  if (pageCounts[letter] < pageNo) {
    pageCounts[letter] = pageNo;
  }
  return Promise.resolve(EMPTY);
}

const getPageRange = (key, _1, _2, total, _3, _4) => {
  pageCounts[key] = parseInt(total, 10);
  return Promise.resolve(EMPTY);
};

const linkHandlers = [
  {
    name: 'getCharacters',
    match: /getCharacters/,
    handle: getCharacters
  },
  {
    name: 'getPages',
    match: /getPages/,
    handle: getPages
  },
  {
    name: 'getGloss',
    match: /getGloss/,
    handle: getGlossProxy
  },
  {
    name: 'getPageRange',
    match: /getPageRange/,
    handle: getPageRange
  },
];

const processLink = link => {
  for (let type of linkHandlers) {
    if (type.match.test(link)) {
      //console.log(link);
      const js = link.split(';');
      const last = js.pop().trim();
      const argstr = last.length ? last : js.pop().trim();
      const args = argstr.split('(')[1].split(',').map( x => x.replace(/['\)]/g, "").trim() );
      log(`[+] ${type.name}`, args);
      return type.handle.apply(null, args)
        .then( extractLinks )
        .then( processLinks )
        .catch( error(`-- ${type.name} ${args} --`) );
    }
  }
  return Promise.resolve(EMPTY);
}

const extractWords = links => links.map( link => qs.parse(link.split('?')[1]).searchword || 0).filter( w => !!w );
const storeWords = letter => ws => {
  if (words[letter]) {
    words[letter] = [...words[letter], ...ws];
  }
  else {
    words[letter] = [];
  }
  return ws;
}

const logger = data => {
  console.log(data);
  return data;
}

const gatherWords = pageCounts => {
  const pages = Object.keys(pageCounts).map( letter => {
    return Promise.all( Array(pageCounts[letter]).fill(1).map( (_, i) =>
      getGloss(letter, i+1)
        .then( extractLinks )
        .then( extractWords )//.then( logger )
        .then( storeWords(letter) )
        .catch( error(`-- ${letter} ${i+1} --`) )
    ));
  });
  return Promise.all(pages).then(pgs => {
    //console.log(pgs);
    return pgs;
  });
}

const processLinks = links => Promise.all(links.map(processLink));

axios.get(`${host}/glossary.php`)
  .then( extractHTML )
  .then( extractLinks )
  .then( processLinks )
  .then( _ => {
    console.log(pageCounts);
    return pageCounts;
  })
  .then( gatherWords )
  .then( _ => {
    //console.log(words);
    writeFile('./words_new.json', JSON.stringify(words, 2), _ => 1);
  })
  .catch( errorlog );
