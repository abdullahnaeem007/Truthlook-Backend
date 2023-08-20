const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cheerio = require('cheerio');
const { Configuration, OpenAIApi } = require("openai");

const googlekey = "GOOGLE KEY";
const searchEngineId = "SEARCH ENGINE ID";
const openaiapikey = "YOUR OPEN AI KEY";
const port = 8008;   

const app = express();
app.use(cors());
app.use(bodyParser.json());


const configuration = new Configuration({
    apiKey: openaiapikey,
});

const openai = new OpenAIApi(configuration);

async function fetchWebpage(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        $('script, style, .navbar, .header, .footer').remove();
        let text = $('body').text().replace(/\s+/g, ' ');

        return text;
    } catch (error) {
        //console.error(`Error fetching webpage: ${error.message}`);
        console.log(url);
        return null;
    }
}

async function CheckBiassness(DataArr, query) {
    try {
        const chat_completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo-16k",
            messages: [{ role: "user", content: DataArr }, {
                role: "system", content: `I want you to Check if the content is Biased or not.if the content is Biased against this user input ${query} then the response should be Yes else No.Important : Response Should be yes or no. You must return response yes or no in each case.
                Response Template : if the content is Biased against this user input ${query} then the response should return Yes or No.
                `
            }],
        });

        return chat_completion.data.choices[0].message.content;
    }
    catch (err) {
        //console.log(err);
        return null;
    }
}

async function processLink(item, query) {

    
    const textContent = await fetchWebpage(item.link);

    let BiasedContent = "Maybe";
    try{
        if (textContent != null) {
            const Biased = await CheckBiassness(textContent, query);
            if (Biased.toLowerCase().includes("yes")) {
                BiasedContent = "Yes";
            }
            else if (Biased.toLowerCase().includes("no")) {
                BiasedContent = "No";
            }
            console.log(" Iterative Result : " + Biased);
        }
    }
    catch(c){
        
        console.log(c);
    }
    return {
        ...item,
        BiasedContent,
    };
}

const runSearch = async (query) => {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
            key: googlekey,
            cx: searchEngineId,
            q: query,
            filter: '1',
        },
    });

    let dataarr = response.data.items;
    dataarr = dataarr.map(item => {
        const { cacheId, htmlTitle, pagemap, kind, htmlSnippet, htmlFormattedUrl, formattedUrl, ...rest } = item;
        return rest;
    });

    let Results = await Promise.all(dataarr.map((datamember) => processLink(datamember, query)));
    //console.log(Results);
    console.log("----------------------------------------------------------");

    // const Obj = await gptBiasedContentRemover(Results);
    // console.log(Obj);

    // return Obj;
    return Results;
};

app.get('/', (req, res) => {
    res.send('Welcome to Truth Lookup API.');
});

app.get('/search', (req, res) => {
    res.send('Kindly send a POST request to this endpoint with the query in the body.');
});

app.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        console.log("Request Received with the Query : " + query);
        try {
            let dataarr = await runSearch(query);

            console.log(dataarr);
            console.log("Data is going to send from the API.");
            res.send(dataarr);

        } catch (error) {
            console.error(error);
            res.status(500).send('An error occurred while processing your request.');
        }
    } catch (err) {
        res.status(500).send('An error occurred while processing your request.');
    }
});

app.listen(port);